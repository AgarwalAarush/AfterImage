import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { storageRequest } from "./storage-request";
import { macserverRequest } from "./macserver-client";

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export type DocumentKind = "markdown" | "pdf";
export type SavedDocument = {
  id: string;
  title: string;
  filename: string;
  kind: DocumentKind;
  excerpt: string;
  bytes: number;
  wordCount: number | null;
  createdAt: string;
};
export type DocumentRecord = SavedDocument & { content: Buffer };
type Row = {
  id: string; title: string; filename: string; kind: DocumentKind; excerpt: string;
  bytes: number; word_count: number | null; created_at: string; content: string; sha256: string;
};

let local: DatabaseSync | undefined;
function db() {
  if (!local) {
    if (process.env.VERCEL) throw new Error("Document storage is not configured.");
    const configured = process.env.AFTERIMAGE_SQLITE_PATH;
    if (process.env.NODE_ENV === "production" &&
      (!configured || !path.isAbsolute(configured) || !existsSync(configured)))
      throw new Error("Production document storage requires the existing SQLite library.");
    const location = configured || path.resolve(".data/afterimage.sqlite");
    mkdirSync(path.dirname(location), { recursive: true, mode: 0o700 });
    local = new DatabaseSync(location);
    chmodSync(location, 0o600);
    local.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL,
        kind TEXT NOT NULL, excerpt TEXT NOT NULL, bytes INTEGER NOT NULL,
        word_count INTEGER, created_at TEXT NOT NULL, sha256 TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL
      )`);
  }
  return local;
}
function mode(): "macserver" | "sqlite" | "supabase" {
  const selected = process.env.AFTERIMAGE_STORAGE;
  if (selected === "macserver") return "macserver";
  if (selected === "sqlite") {
    if (process.env.VERCEL) throw new Error("SQLite document storage cannot run on Vercel.");
    return "sqlite";
  }
  if (selected === "supabase") {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Supabase document storage is not configured.");
    return "supabase";
  }
  if (!selected && process.env.NODE_ENV !== "production" && !process.env.VERCEL) return "sqlite";
  throw new Error("Document storage is not configured.");
}
async function request(route: string, init: RequestInit = {}) {
  const response = await storageRequest(`${process.env.SUPABASE_URL}/rest/v1/afterimage_documents${route}`, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.code === "23505") throw new Error("This file is already in Documents.");
    throw new Error("Document storage is unavailable. Check the documents migration and storage connection.");
  }
  return response;
}
function metadata(row: Row): SavedDocument {
  return { id: row.id, title: row.title, filename: row.filename, kind: row.kind,
    excerpt: row.excerpt, bytes: Number(row.bytes), wordCount: row.word_count,
    createdAt: row.created_at };
}
function titleFromName(filename: string) {
  return filename.replace(/\.(md|markdown|pdf)$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}
export function prepareDocument(filename: string, content: Buffer): Row {
  const safeName = path.basename(filename).replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 180);
  const kind = /\.(md|markdown)$/i.test(safeName) ? "markdown" : /\.pdf$/i.test(safeName) ? "pdf" : null;
  if (!kind) throw new Error("Choose a Markdown (.md) or PDF (.pdf) file.");
  if (!content.length || content.length > MAX_DOCUMENT_BYTES)
    throw new Error("Choose a file between 1 byte and 4 MB.");
  let title = titleFromName(safeName);
  let excerpt = kind === "pdf" ? "PDF document" : "";
  let wordCount: number | null = null;
  if (kind === "pdf") {
    if (!content.subarray(0, 8).toString("latin1").startsWith("%PDF-"))
      throw new Error("This file does not appear to be a PDF.");
  } else {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(content); }
    catch { throw new Error("Markdown must be UTF-8 text."); }
    if (!text.trim() || text.includes("\u0000")) throw new Error("Markdown must contain readable text.");
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    title = heading || title;
    excerpt = text.replace(/^#\s+.+\r?\n/, "").split(/\n\s*\n/)
      .map(p => p.replace(/<[^>]*>/g, "").replace(/[#*_`>\[\]]/g, "").trim())
      .find(p => p.length > 80 && !/Citation preservation note/i.test(p))?.slice(0, 220) || "Markdown document";
    wordCount = text.trim().split(/\s+/).length;
  }
  return { id: randomUUID(), title: title.slice(0, 300), filename: safeName, kind,
    excerpt, bytes: content.length, word_count: wordCount, created_at: new Date().toISOString(),
    sha256: createHash("sha256").update(content).digest("hex"), content: content.toString("base64") };
}
export async function listDocuments(): Promise<SavedDocument[]> {
  const selected = mode();
  if (selected === "macserver") return macserverRequest({ action: "documentList" });
  if (selected === "supabase") {
    const rows = await (await request("?select=id,title,filename,kind,excerpt,bytes,word_count,created_at&order=created_at.desc")).json() as Row[];
    return rows.map(metadata);
  }
  return (db().prepare("SELECT id,title,filename,kind,excerpt,bytes,word_count,created_at FROM documents ORDER BY created_at DESC").all() as Row[]).map(metadata);
}
export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const selected = mode();
  if (selected === "macserver") {
    const row = await macserverRequest<(SavedDocument & { content: string }) | null>({ action: "documentGet", id });
    return row ? { ...row, content: Buffer.from(row.content, "base64") } : null;
  }
  const row = selected === "supabase"
    ? ((await (await request(`?id=eq.${encodeURIComponent(id)}&select=*`)).json()) as Row[])[0]
    : db().prepare("SELECT * FROM documents WHERE id=?").get(id) as Row | undefined;
  return row ? { ...metadata(row), content: Buffer.from(row.content, "base64") } : null;
}
export async function getDocumentMetadata(id: string): Promise<SavedDocument | null> {
  const selected = mode();
  if (selected === "macserver") return macserverRequest({ action: "documentMetadata", id });
  const columns = "id,title,filename,kind,excerpt,bytes,word_count,created_at";
  const row = selected === "supabase"
    ? ((await (await request(`?id=eq.${encodeURIComponent(id)}&select=${columns}`)).json()) as Row[])[0]
    : db().prepare(`SELECT ${columns} FROM documents WHERE id=?`).get(id) as Row | undefined;
  return row ? metadata(row) : null;
}
export async function saveDocument(row: Row): Promise<SavedDocument> {
  const selected = mode();
  if (selected === "macserver")
    return macserverRequest({ action: "documentSave", filename: row.filename, content: row.content });
  if (selected === "supabase") {
    await request("", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
  } else {
    try {
      db().prepare(`INSERT INTO documents (id,title,filename,kind,excerpt,bytes,word_count,created_at,sha256,content)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.title, row.filename, row.kind, row.excerpt,
        row.bytes, row.word_count, row.created_at, row.sha256, row.content);
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("This file is already in Documents.");
      throw error;
    }
  }
  return metadata(row);
}
export async function deleteDocument(id: string) {
  const selected = mode();
  if (selected === "macserver") await macserverRequest({ action: "documentDelete", id });
  else if (selected === "supabase") await request(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  else db().prepare("DELETE FROM documents WHERE id=?").run(id);
}
