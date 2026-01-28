import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { type GtfGeneModel, type GtfInfo, type GtfTranscript } from "./types";

function workspacePath(relativePath: string) {
  return path.resolve(process.cwd(), relativePath);
}

function parseAttributes(attributes: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /([^\s]+)\s+"([^"]*)"\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attributes))) {
    map[match[1]] = match[2];
  }
  return map;
}

type CacheKey = string;
const geneCache = new Map<CacheKey, { at: number; value: GtfGeneModel }>();
const MAX_CACHE = 200;
const TTL_MS = 10 * 60 * 1000;

function getCached(key: CacheKey): GtfGeneModel | null {
  const hit = geneCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    geneCache.delete(key);
    return null;
  }
  // bump LRU
  geneCache.delete(key);
  geneCache.set(key, hit);
  return hit.value;
}

function setCached(key: CacheKey, value: GtfGeneModel) {
  geneCache.set(key, { at: Date.now(), value });
  while (geneCache.size > MAX_CACHE) {
    const firstKey = geneCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    geneCache.delete(firstKey);
  }
}

export async function loadGeneModelFromGtf(opts: {
  gtf: GtfInfo;
  geneName?: string;
  geneId?: string;
}): Promise<GtfGeneModel> {
  const geneName = opts.geneName?.trim();
  const geneId = opts.geneId?.trim();

  if (!geneName && !geneId) {
    throw Object.assign(new Error("Missing geneName/geneId"), { statusCode: 400 });
  }

  const cacheKey = `${opts.gtf.id}|${opts.gtf.path}|${geneId ?? ""}|${geneName ?? ""}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const fullPath = workspacePath(opts.gtf.path);
  const stream = fs.createReadStream(fullPath, { encoding: "utf8" });
  try {
    const result = await loadGeneModelFromLineStream({
      gtf: opts.gtf,
      geneName,
      geneId,
      input: stream,
      cacheKey,
    });
    return result;
  } finally {
    stream.close();
  }
}

export async function loadGeneModelFromGtfText(opts: {
  gtf: Pick<GtfInfo, "id" | "name" | "species" | "assembly" | "source">;
  cacheKeyPrefix: string;
  content: string;
  geneName?: string;
  geneId?: string;
}): Promise<GtfGeneModel> {
  const geneName = opts.geneName?.trim();
  const geneId = opts.geneId?.trim();
  if (!geneName && !geneId) {
    throw Object.assign(new Error("Missing geneName/geneId"), { statusCode: 400 });
  }

  const cacheKey = `${opts.cacheKeyPrefix}|${geneId ?? ""}|${geneName ?? ""}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Avoid splitting into an array of lines; let readline handle it.
  const input = Readable.from([opts.content]);
  return loadGeneModelFromLineStream({
    gtf: opts.gtf as GtfInfo,
    geneName,
    geneId,
    input,
    cacheKey,
  });
}

async function loadGeneModelFromLineStream(opts: {
  gtf: GtfInfo;
  geneName?: string;
  geneId?: string;
  input: NodeJS.ReadableStream;
  cacheKey: string;
}): Promise<GtfGeneModel> {
  const geneName = opts.geneName;
  const geneId = opts.geneId;

  const rl = readline.createInterface({ input: opts.input, crlfDelay: Infinity });
  const transcriptsById = new Map<string, GtfTranscript>();
  let geneMeta: { gene_id?: string; gene_name?: string; seq_region_name?: string; strand?: "+" | "-" } = {};

  try {
    for await (const line of rl) {
      if (!line || line.startsWith("#")) continue;

      const cols = line.split("\t");
      if (cols.length < 9) continue;

      const [seqname, , feature, startStr, endStr, , strandStr, , attributesStr] = cols;
      if (feature !== "exon" && feature !== "transcript") continue;

      const attrs = parseAttributes(attributesStr);
      const attrGeneId = attrs.gene_id;
      const attrGeneName = attrs.gene_name;

      const matchesGene =
        (!!geneId && attrGeneId === geneId) ||
        (!!geneName && attrGeneName === geneName) ||
        (!!geneName && attrGeneId === geneName) ||
        (!!geneId && attrGeneName === geneId);

      if (!matchesGene) continue;

      const transcriptId = attrs.transcript_id;
      if (!transcriptId) continue;

      const start = Number(startStr);
      const end = Number(endStr);
      const strand = (strandStr === "-" ? "-" : "+") as "+" | "-";

      if (!geneMeta.gene_id) geneMeta.gene_id = attrGeneId;
      if (!geneMeta.gene_name) geneMeta.gene_name = attrGeneName;
      if (!geneMeta.seq_region_name) geneMeta.seq_region_name = seqname;
      if (!geneMeta.strand) geneMeta.strand = strand;

      let transcript = transcriptsById.get(transcriptId);
      if (!transcript) {
        transcript = {
          transcript_id: transcriptId,
          transcript_name: attrs.transcript_name,
          gene_id: attrGeneId,
          gene_name: attrGeneName,
          seq_region_name: seqname,
          strand,
          exons: [],
        };
        transcriptsById.set(transcriptId, transcript);
      }

      if (feature === "exon") {
        const exonNum = attrs.exon_number ? Number(attrs.exon_number) : undefined;
        transcript.exons.push({
          start,
          end,
          exon_number: Number.isFinite(exonNum) ? exonNum : undefined,
        });
      }
    }
  } finally {
    rl.close();
  }

  const transcripts = [...transcriptsById.values()]
    .map((t) => ({
      ...t,
      exons: [...t.exons].sort((a, b) => a.start - b.start),
    }))
    .sort((a, b) => {
      const dividir = (x: GtfTranscript) => x.exons.reduce((sum, e) => sum + (e.end - e.start + 1), 0);
      return dividir(b) - dividir(a);
    });

  const result: GtfGeneModel = {
    gtf: {
      id: opts.gtf.id,
      name: opts.gtf.name,
      species: opts.gtf.species,
      assembly: opts.gtf.assembly,
      source: opts.gtf.source,
    },
    gene: geneMeta,
    transcripts,
  };

  setCached(opts.cacheKey, result);
  return result;
}
