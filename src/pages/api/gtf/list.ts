import type { APIRoute } from "astro";
import { loadGtfManifest } from "../../../server/gtf/manifest";

export const GET: APIRoute = async () => {
  const gtfs = await loadGtfManifest();
  return new Response(JSON.stringify({ gtfs }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
