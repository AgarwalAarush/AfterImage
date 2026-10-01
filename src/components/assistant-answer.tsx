"use client";
import { createContext, memo, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

export type CitationHandlers = {
  show: (id: string, anchor: HTMLButtonElement) => void;
  hide: () => void;
  keep: () => void;
  current: string | null;
};

// Controlled internal links let Markdown parse tables, lists and math without
// allowing model-supplied links, images, HTML or unknown source identifiers.
export function citationMarkdown(text: string) {
  return text.split(/((?:^|\n)(?:```|~~~)[\s\S]*?(?:\n(?:```|~~~)(?=\n|$)|$)|`+[^`\n]*`+)/g).map((part, index) => {
    if (index % 2) return part;
    return part.replace(/\\\(([\s\S]*?)\\\)/g, (_marker, math: string) => `$${math}$`)
      .replace(/\\\[([\s\S]*?)\\\]/g, (_marker, math: string) => `$$${math}$$`)
      .replace(/\$\$([\s\S]*?)\$\$/g, (_marker, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`)
      .replace(/\[source:([^\]\n]+)\]|\[notecard\]/g, (marker, id: string | undefined) =>
        `[${marker === "[notecard]" ? "notecard" : "source"}](#afterimage-cite-${encodeURIComponent(id || "notecard")})`
      ).replace(/\[(?:source:[^\]\n]*|notecard?)$/, "");
  }).join("");
}

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [[rehypeKatex, { trust: false, strict: "ignore", throwOnError: false, maxExpand: 500 }]] as NonNullable<Parameters<typeof ReactMarkdown>[0]["rehypePlugins"]>;

const CitationContext = createContext<{sources: string[]; citation: CitationHandlers} | null>(null);
function CitationLink({href, children}: {href?: string; children?: ReactNode}) {
  const {sources, citation} = useContext(CitationContext)!;
  const prefix = "#afterimage-cite-";
  if (!href?.startsWith(prefix)) return <>{children}</>;
  let id: string;
  try { id = decodeURIComponent(href.slice(prefix.length)); } catch { return <>[unverified citation]</>; }
  if (id !== "notecard" && !sources.includes(id)) return <>[unverified citation]</>;
  return <button className="assistant-citation" aria-haspopup="dialog" aria-expanded={citation.current === id} aria-controls={citation.current === id ? "assistant-source-preview" : undefined}
    onMouseEnter={e => citation.show(id, e.currentTarget)} onMouseLeave={citation.hide}
    onFocus={e => citation.show(id, e.currentTarget)} onBlur={citation.hide}
    onClick={e => citation.show(id, e.currentTarget)}>
    {id === "notecard" ? "notecard" : `source ${sources.indexOf(id) + 1}`}
  </button>;
}
const components: Components = {
  a: CitationLink,
  img() { return null; },
  table({ children }) { return <div className="assistant-table-scroll" tabIndex={0} role="region" aria-label="Answer table"><table>{children}</table></div>; },
};
export const AssistantMarkdown = memo(function AssistantMarkdown({text, sources, citation}: {
  text: string; sources: string[]; citation: CitationHandlers;
}) {
  return <CitationContext.Provider value={{sources, citation}}><ReactMarkdown skipHtml remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>{citationMarkdown(text)}</ReactMarkdown></CitationContext.Provider>;
});

export const AssistantAnswer = memo(function AssistantAnswer({ text, status, sources, citation, onReveal }: {
  text: string; status: string; sources: string[]; citation: CitationHandlers; onReveal: () => void;
}) {
  // Completed history appears immediately. Newly received cumulative snapshots
  // are revealed locally; the server answer remains the source of truth.
  const [shown, setShown] = useState(text);
  const shownRef = useRef(text), target = useRef(text), reveal = useRef(onReveal);
  target.current = text; reveal.current = onReveal;
  useEffect(() => {
    if (!text.startsWith(shownRef.current) || status === "cancelled" || status === "failed" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = text; setShown(text); reveal.current(); return;
    }
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      if (elapsed >= 30) {
        const remaining = target.current.length - shownRef.current.length;
        // Catch up large bursts within about a second without adding a long tail.
        const count = Math.max(1, Math.ceil(elapsed * Math.max(100, remaining / 0.8) / 1000));
        let end = Math.min(target.current.length, shownRef.current.length + count);
        const code = target.current.charCodeAt(end - 1);
        if (code >= 0xd800 && code <= 0xdbff) end++;
        shownRef.current = target.current.slice(0, end); setShown(shownRef.current); reveal.current(); last = now;
      }
      if (shownRef.current.length < target.current.length) frame = requestAnimationFrame(tick);
    };
    if (shownRef.current !== text) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, status]);
  const revealing = shown !== text;
  return <><AssistantMarkdown text={shown} sources={sources} citation={citation}/>{(revealing || Boolean(shown) && (status === "queued" || status === "running")) && <span className="stream-cursor" aria-label="Generating"/>}</>;
});
