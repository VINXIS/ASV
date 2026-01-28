export interface GtfInfo {
  id: string;
  name: string;
  species?: string;
  assembly?: string;
  source?: "default" | "upload";
}

export interface GtfExon {
  start: number;
  end: number;
  exon_number?: number;
}

export interface GtfTranscript {
  transcript_id: string;
  transcript_name?: string;
  gene_id?: string;
  gene_name?: string;
  seq_region_name: string;
  strand: "+" | "-";
  exons: GtfExon[];
}

export interface GtfGeneModel {
  gtf: Pick<GtfInfo, "id" | "name" | "species" | "assembly" | "source">;
  gene: {
    gene_id?: string;
    gene_name?: string;
    seq_region_name?: string;
    strand?: "+" | "-";
  };
  transcripts: GtfTranscript[];
}

const cache = {
  list: null as GtfInfo[] | null,
  geneModels: new Map<string, GtfGeneModel>(),
};

export async function getGtfList(): Promise<GtfInfo[]> {
  if (cache.list) return cache.list;
  const res = await fetch("/api/gtf/list");
  if (!res.ok) throw new Error(`Failed to fetch GTF list: ${res.status}`);
  const data = (await res.json()) as { gtfs: GtfInfo[] };
  cache.list = data.gtfs ?? [];
  return cache.list;
}

export async function getGtfGeneModel(opts: {
  id: string;
  geneName?: string;
  geneId?: string;
}): Promise<GtfGeneModel> {
  const key = `${opts.id}|${opts.geneId ?? ""}|${opts.geneName ?? ""}`;
  const hit = cache.geneModels.get(key);
  if (hit) return hit;

  const url = new URL("/api/gtf/gene", window.location.origin);
  if (opts.id.startsWith("session_")) url.searchParams.set("uploadId", opts.id);
  else url.searchParams.set("id", opts.id);
  if (opts.geneName) url.searchParams.set("gene", opts.geneName);
  if (opts.geneId) url.searchParams.set("geneId", opts.geneId);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch GTF gene model: ${res.status} ${text}`);
  }

  const model = (await res.json()) as GtfGeneModel;
  cache.geneModels.set(key, model);
  return model;
}

export async function importLocalGtf(opts: {
  filenameBase: string;
  content: string;
}): Promise<{ uploadId: string; filename: string }> {
  const res = await fetch("/api/gtf/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to import GTF: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { uploadId: string; filename: string };
  // refresh list on next call (defaults might change), and clear any gene model cache
  cache.list = null;
  cache.geneModels.clear();
  return { uploadId: data.uploadId, filename: data.filename };
}
