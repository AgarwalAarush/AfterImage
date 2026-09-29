import { authenticated, sameOrigin } from "@/lib/auth";
import { listDocuments, MAX_DOCUMENT_BYTES, prepareDocument, saveDocument } from "@/lib/documents";
import { StorageError } from "@/lib/storage-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!(await authenticated())) return Response.json({ error: "Sign in to your library." }, { status: 401 });
  try { return Response.json({ documents: await listDocuments() }, { headers: privateHeaders }); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!(await authenticated())) return Response.json({ error: "Sign in to your library." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_DOCUMENT_BYTES + 100_000)
    return Response.json({ error: "Choose a file smaller than 4 MB." }, { status: 413 });
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size > MAX_DOCUMENT_BYTES) return Response.json({ error: "Choose a file smaller than 4 MB." }, { status: 413 });
    const document = await saveDocument(prepareDocument(file.name, Buffer.from(await file.arrayBuffer())));
    return Response.json({ document }, { status: 201, headers: privateHeaders });
  } catch (error) {
    const message = (error as Error).message;
    return Response.json({ error: message }, {
      status: error instanceof StorageError ? 503 : message.includes("already") ? 409 : 400,
    });
  }
}
