import type { APIRoute } from "astro";
import { createGtfUploadSession } from "../../../server/gtf/sessionStore";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as {
      filenameBase?: string;
      content?: string;
    };

    if (!body?.filenameBase || !body?.content) {
      return new Response(JSON.stringify({ error: "Missing filenameBase/content" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const filename = `${body.filenameBase}.gtf`;
    const session = createGtfUploadSession({ filename, content: body.content });

    return new Response(JSON.stringify({ ok: true, uploadId: session.id, filename }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
