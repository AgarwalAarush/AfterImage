"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { ArrowRight, FileText, FileUp, Plus, Search, X } from "lucide-react";
import type { SavedDocument } from "@/lib/documents";

function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
export function Documents() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load documents.");
      setDocuments(data.documents);
      setError("");
    } catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function upload(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length || uploading) return;
    setError("");
    const failures: string[] = [];
    for (const [index, file] of selected.entries()) {
      setUploading(selected.length === 1 ? `Uploading ${file.name}…` : `Uploading ${index + 1} of ${selected.length}…`);
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/documents", { method: "POST", body });
        const data = await response.json();
        if (!response.ok) throw new Error(`${file.name}: ${data.error || "Upload failed."}`);
        setDocuments(current => [data.document, ...current]);
      } catch (cause) { failures.push((cause as Error).message); }
    }
    setUploading("");
    setError(failures.join(" "));
    if (input.current) input.current.value = "";
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { void upload(event.target.files || []); }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files);
  }
  const visible = documents.filter(document => `${document.title} ${document.filename} ${document.excerpt}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page documents-page">
    <div className="page-intro compact documents-intro">
      <span className="eyebrow intro-kicker">YOUR PERSONAL READING SHELF</span>
      <h1>Room for the longer read.</h1>
      <p>Keep the guides, articles, and essays you want to return to.</p>
    </div>
    <div className={`document-drop ${dragging ? "dragging" : ""}`}
      onDragEnter={event => { event.preventDefault(); setDragging(true); }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={onDrop}>
      <div className="document-drop-icon"><FileUp size={23} strokeWidth={1.5} /></div>
      <div className="document-drop-copy"><strong>Bring a document in.</strong><span>Drop Markdown or PDF files here, or choose them from your computer. Up to 4 MB each.</span></div>
      <button className="button primary" disabled={!!uploading} onClick={() => input.current?.click()}>
        <Plus size={16} />{uploading || "Choose files"}
      </button>
      <input ref={input} className="visually-hidden" type="file" accept=".md,.markdown,.pdf,text/markdown,application/pdf" multiple onChange={onFileChange} aria-label="Choose Markdown or PDF files" />
    </div>
    {error && <div className="document-error" role="alert">{error} <button onClick={() => { setError(""); void load(); }}>Retry</button></div>}
    <div className="documents-list-heading">
      <div><span className="eyebrow">DOCUMENTS</span><h2>On your shelf <span>{documents.length}</span></h2></div>
      <label className="document-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search documents" aria-label="Search documents" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
    </div>
    {loading ? <div className="document-empty" role="status">Opening your shelf…</div>
      : visible.length ? <div className="document-list">{visible.map(document => <Link className="document-row" href={`/documents/${document.id}`} key={document.id}>
        <span className={`document-file-icon ${document.kind}`}><FileText size={24} strokeWidth={1.4} /></span>
        <span className="document-row-main"><span className="document-row-meta">{document.kind === "pdf" ? "PDF" : "MARKDOWN"} <i /> {new Date(document.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><strong>{document.title}</strong><span className="document-row-excerpt">{document.excerpt}</span></span>
        <span className="document-row-end"><span>{document.wordCount ? `${Math.max(1, Math.round(document.wordCount / 250))} min read` : formatBytes(document.bytes)}</span><ArrowRight size={18} /></span>
      </Link>)}</div>
      : <div className="document-empty"><FileText size={26} strokeWidth={1.3} /><h2>{query ? "No matching documents." : "Your shelf starts here."}</h2><p>{query ? "Try a different search." : "Add a Markdown guide or PDF and settle in to read."}</p>{query && <button className="text-button" onClick={() => setQuery("")}>Clear search</button>}</div>}
  </div>;
}
