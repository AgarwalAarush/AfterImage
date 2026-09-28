import { authenticated, sameOrigin } from "@/lib/auth";
import { deleteDocument, getDocument, getDocumentMetadata } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: Context) {
  if (!(await authenticated())) return Response.json({ error: "Sign in to your library." }, { status: 401 });
  try {
    const url = new URL(request.url);
    if (url.searchParams.has("meta")) {
      const metadata = await getDocumentMetadata((await params).id);
      return metadata ? Response.json({ document: metadata }, { headers: privateHeaders })
        : Response.json({ error: "Document not found." }, { status: 404 });
    }
    const document = await getDocument((await params).id);
    if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
    if (document.kind === "pdf" || url.searchParams.has("download")) {
      const filename = document.filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
      return new Response(new Uint8Array(document.content), {
        headers: { ...privateHeaders,
          "Content-Type": document.kind === "pdf" ? "application/pdf" : "text/markdown; charset=utf-8",
          "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
          "X-Frame-Options": "SAMEORIGIN",
          "X-Content-Type-Options": "nosniff" },
      });
    }
    const { content, ...metadata } = document;
    return Response.json({ document: metadata, markdown: content.toString("utf8") }, { headers: privateHeaders });
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 503 }); }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!(await authenticated())) return Response.json({ error: "Sign in to your library." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  try {
    await deleteDocument((await params).id);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 503 }); }
}
