import fs from "fs/promises";
import path from "path";
import { type GtfInfo, type GtfManifestFile } from "./types";

const MANIFEST_PATH = "data/gtf/manifest.json";
const UPLOAD_DIR = "data/gtf/uploads";

function workspacePath(relativePath: string) {
  return path.resolve(process.cwd(), relativePath);
}

export async function loadGtfManifest(): Promise<GtfInfo[]> {
  let manifest: GtfManifestFile | null = null;
  try {
    const raw = await fs.readFile(workspacePath(MANIFEST_PATH), "utf8");
    manifest = JSON.parse(raw) as GtfManifestFile;
  } catch {
    manifest = { gtfs: [] };
  }

  const defaults = (manifest.gtfs ?? []).map((g) => ({ ...g, source: g.source ?? "default" }));

  // Add uploads (file-based; metadata is inferred from filename)
  let uploads: GtfInfo[] = [];
  try {
    const files = await fs.readdir(workspacePath(UPLOAD_DIR));
    uploads = files
      .filter((f) => f.endsWith(".gtf") || f.endsWith(".gtf.gz"))
      .map((filename) => {
        const id = filename.replace(/\.(gtf|gtf\.gz)$/i, "");
        return {
          id: `upload_${id}`,
          name: `Upload: ${id}`,
          path: path.posix.join(UPLOAD_DIR, filename),
          source: "upload" as const,
        };
      });
  } catch {
    uploads = [];
  }

  // De-dupe by id (uploads win)
  const byId = new Map<string, GtfInfo>();
  for (const g of defaults) byId.set(g.id, g);
  for (const g of uploads) byId.set(g.id, g);

  return [...byId.values()];
}

export async function saveUploadedGtf(opts: {
  filenameBase: string;
  content: string;
}): Promise<{ path: string }>{
  const allow = process.env.ALLOW_GTF_UPLOAD === "1";
  if (!allow) {
    throw Object.assign(new Error("GTF upload disabled"), { statusCode: 403 });
  }

  const safeBase = opts.filenameBase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!safeBase) {
    throw Object.assign(new Error("Invalid filename"), { statusCode: 400 });
  }

  const relPath = path.posix.join(UPLOAD_DIR, `${safeBase}.gtf`);
  await fs.mkdir(workspacePath(UPLOAD_DIR), { recursive: true });
  await fs.writeFile(workspacePath(relPath), opts.content, "utf8");
  return { path: relPath };
}
