import { randomUUID } from "node:crypto";

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_BYTES = 200 * 1024 * 1024; // 200MB

export interface GtfUploadSession {
  id: string;
  filename: string;
  createdAt: number;
  lastUsedAt: number;
  content: string;
}

const sessions = new Map<string, GtfUploadSession>();

function getLimits() {
  const ttlMs = Number(process.env.GTF_UPLOAD_TTL_MS ?? "") || DEFAULT_TTL_MS;
  const maxBytes = Number(process.env.GTF_UPLOAD_MAX_BYTES ?? "") || DEFAULT_MAX_BYTES;
  return { ttlMs, maxBytes };
}

function cleanupExpired() {
  const { ttlMs } = getLimits();
  const now = Date.now();
  for (const [id, sess] of sessions) {
    if (now - sess.lastUsedAt > ttlMs) sessions.delete(id);
  }
}

export function createGtfUploadSession(opts: {
  filename: string;
  content: string;
}): { id: string } {
  cleanupExpired();
  const { maxBytes } = getLimits();

  const bytes = Buffer.byteLength(opts.content, "utf8");
  if (bytes > maxBytes) {
    throw Object.assign(
      new Error(
        `GTF too large (${Math.round(bytes / 1024 / 1024)}MB). Increase GTF_UPLOAD_MAX_BYTES or use a smaller file.`
      ),
      { statusCode: 413 }
    );
  }

  const id = `session_${randomUUID()}`;
  const now = Date.now();
  sessions.set(id, {
    id,
    filename: opts.filename,
    createdAt: now,
    lastUsedAt: now,
    content: opts.content,
  });
  return { id };
}

export function getGtfUploadSession(id: string): GtfUploadSession | null {
  cleanupExpired();
  const sess = sessions.get(id);
  if (!sess) return null;
  sess.lastUsedAt = Date.now();
  return sess;
}

export function deleteGtfUploadSession(id: string): void {
  sessions.delete(id);
}
