import type { APIRoute } from "astro";
import { loadGtfManifest } from "../../../server/gtf/manifest";
import { loadGeneModelFromGtf, loadGeneModelFromGtfText } from "../../../server/gtf/parser";
import { getGtfUploadSession } from "../../../server/gtf/sessionStore";

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id")?.trim() ?? "";
  const uploadId = url.searchParams.get("uploadId")?.trim() ?? "";
  const geneName = url.searchParams.get("gene")?.trim() ?? undefined;
  const geneId = url.searchParams.get("geneId")?.trim() ?? undefined;

  if (!id && !uploadId) {
    return new Response(JSON.stringify({ error: "Missing id/uploadId" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (uploadId) {
    const sess = getGtfUploadSession(uploadId);
    if (!sess) {
      return new Response(JSON.stringify({ error: `Unknown/expired uploadId: ${uploadId}` }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    try {
      const model = await loadGeneModelFromGtfText({
        gtf: {
          id: uploadId,
          name: `Upload: ${sess.filename}`,
          source: "upload",
        },
        cacheKeyPrefix: `${uploadId}|${sess.createdAt}`,
        content: sess.content,
        geneName,
        geneId,
      });

      return new Response(JSON.stringify(model), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (err: any) {
      const status = Number(err?.statusCode) || 500;
      return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  }

  const gtfs = await loadGtfManifest();
  const gtf = gtfs.find((g) => g.id === id);
  if (!gtf) {
    return new Response(JSON.stringify({ error: `Unknown GTF id: ${id}` }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  try {
    const model = await loadGeneModelFromGtf({ gtf, geneName, geneId });
    return new Response(JSON.stringify(model), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
