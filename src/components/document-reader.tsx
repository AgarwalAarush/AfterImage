"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, List, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import GithubSlugger from "github-slugger";
import { clientRequest } from "@/lib/client-request";
import { LoadingStatus } from "./loading-status";
import type { SavedDocument } from "@/lib/documents";
import "katex/dist/katex.min.css";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "details", "summary", "sup", "sub"],
  attributes: { ...defaultSchema.attributes, a: [...(defaultSchema.attributes?.a || []), "id"] },
};
function readingOutline(markdown: string) {
  const slugger = new GithubSlugger();
  const text = markdown.replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~).*$/gm, "");
  return [...text.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(match => {
    const label = match[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "").trim();
    return { label, level: match[1].length, id: slugger.slug(label) };
  });
}
function readableMarkdown(markdown: string) {
  const withoutTitle = markdown.replace(/^#\s+.+\r?\n/, "");
  return withoutTitle.split(/((?:^|\n)(?:```|~~~)[\s\S]*?(?:\n(?:```|~~~)))/g).map(part =>
    /^(?:\n)?(?:```|~~~)/.test(part) ? part : part
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `$$${math}$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math}$`)
  ).join("");
}

export function DocumentReader({ id }: { id: string }) {
  const [document, setDocument] = useState<SavedDocument | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setDocument(null); setMarkdown(""); setError("");
    async function load() {
      try {
        const response = await clientRequest(`/api/documents/${encodeURIComponent(id)}?meta=1`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not open this document.");
        if (data.document.kind === "markdown") {
          const contentResponse = await clientRequest(`/api/documents/${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" });
          const content = await contentResponse.json();
          if (!contentResponse.ok) throw new Error(content.error || "Could not read this document.");
          setMarkdown(content.markdown);
        }
        if (!controller.signal.aborted) setDocument(data.document);
      } catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, loadVersion]);
  const body = useMemo(() => readableMarkdown(markdown), [markdown]);
  const outline = useMemo(() => readingOutline(body), [body]);
  async function remove() {
    if (!document || !window.confirm(`Remove “${document.title}” from Documents?`)) return;
    setDeleting(true);
    try {
      const response = await clientRequest(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error || "Could not remove the document.");
      router.push("/documents");
    } catch (cause) { setError((cause as Error).message); setDeleting(false); }
  }
  if (loading) return <div className="page document-reader-loading"><LoadingStatus label="Opening your document…" detail="Fetching the original file. This is taking longer than usual; you can retry if the connection times out." /></div>;
  if (!document) return <div className="page document-reader-loading"><h1>Couldn’t open this document.</h1><p>{error}</p><button className="button" onClick={() => setLoadVersion(value => value + 1)}>Try again</button><Link href="/documents" className="button"><ArrowLeft size={15} /> Back to Documents</Link></div>;
  return <div className="document-reader-page">
    <div className="document-reader-top"><Link href="/documents"><ArrowLeft size={15} /> Documents</Link><div><a href={`/api/documents/${encodeURIComponent(id)}?download=1`} className="text-button"><Download size={15} /> Download original</a><button className="text-button document-delete" disabled={deleting} onClick={remove}><Trash2 size={15} /> {deleting ? "Removing…" : "Remove"}</button></div></div>
    {error && <div className="document-error" role="alert">{error}</div>}
    <div className="document-reader-grid">
      <article className="document-sheet">
        <header className="document-sheet-header"><span className="eyebrow"><FileText size={14} /> {document.kind === "pdf" ? "PDF DOCUMENT" : "MARKDOWN DOCUMENT"} <span>·</span> {new Date(document.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span><h1>{document.title}</h1><p>{document.kind === "markdown" && document.wordCount ? `${document.wordCount.toLocaleString()} words · About ${Math.max(1, Math.round(document.wordCount / 250))} minutes` : document.filename}</p></header>
        {document.kind === "pdf" ? <div className="document-pdf"><iframe title={document.title} src={`/api/documents/${encodeURIComponent(id)}`} /><p>If the PDF does not display, <a href={`/api/documents/${encodeURIComponent(id)}?download=1`}>download the original file</a>.</p></div>
          : <div className="document-prose"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema], rehypeSlug, rehypeKatex]}
            components={{
              a({ href, children, ...props }) {
                const target = href?.startsWith("#dr-") ? `#user-content-${href.slice(1)}` : href;
                const external = Boolean(target && /^https?:\/\//i.test(target));
                return <a {...props} href={target} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{children}</a>;
              },
            }}>{body}</ReactMarkdown></div>}
      </article>
      <aside className="document-reader-aside"><div className="document-outline"><span className="eyebrow"><List size={14} /> {document.kind === "pdf" ? "ORIGINAL FILE" : "IN THIS DOCUMENT"}</span>{outline.length ? <nav aria-label="Document sections">{outline.filter(item => item.level === 2).map(item => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}</nav> : <p>{document.kind === "pdf" ? "A quiet space to read the original PDF." : "Read from beginning to end."}</p>}</div><div className="document-aside-note">Saved in your private collection.<br />Your original file stays available to download.</div></aside>
    </div>
  </div>;
}
