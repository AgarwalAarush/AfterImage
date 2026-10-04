"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, FilePlus2, Globe2, Search, X } from "lucide-react";
import type { Paper } from "@/lib/types";
import type { PaperSearchProvider, PaperSearchResult } from "@/lib/paper-search";
import { SessionExpired } from "@/lib/library-client";
import { useApp } from "./app-context";

function matchesPaperInput(value: string) {
  return /^(?:\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?|https?:\/\/(?:www\.)?(?:arxiv|alphaxiv)\.org\/)/i.test(value.trim());
}
export function PaperPalette({ close }: { close: () => void }) {
  const { state, act, busy, refresh } = useApp(),
    router = useRouter(),
    ref = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    [query, setQuery] = useState(""),
    [activeIndex, setActiveIndex] = useState(0),
    [error, setError] = useState(""),
    [remotePapers, setRemotePapers] = useState<PaperSearchResult[]>([]),
    [providers, setProviders] = useState<PaperSearchProvider[]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  useLayoutEffect(() => {
    ref.current?.showModal();
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      ref.current?.close();
    };
  }, []);
  useEffect(() => { if (!state) void refresh(); }, [refresh]);
  const normalizedQuery = query.trim().toLowerCase();
  const canImport = matchesPaperInput(query);
  useEffect(() => {
    setRemotePapers([]);
    setProviders([]);
    setSearchError("");
    if (normalizedQuery.length < 2 || canImport) {
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) throw new SessionExpired();
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Live paper search is unavailable.");
        if (controller.signal.aborted) return;
        const nextProviders: PaperSearchProvider[] = data.providers || [];
        setRemotePapers(data.results || []);
        setProviders(nextProviders);
        setSearchError(
          nextProviders.length && nextProviders.every((provider) => provider.status === "unavailable")
            ? "Live paper search is temporarily unavailable."
            : "",
        );
        setActiveIndex(0);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof SessionExpired) router.replace("/login");
        setSearchError(
          cause instanceof SessionExpired
            ? "Please sign in again."
            : "Live paper search is temporarily unavailable.",
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, canImport, query, router]);
  const papers = [...(state?.papers || [])]
    .filter((paper) => {
      if (!normalizedQuery) return true;
      const searchable = [
        paper.title,
        paper.authors,
        paper.arxivId,
        paper.topics.join(" "),
        paper.abstract,
        paper.recall?.idea || "",
      ]
        .join(" ")
        .toLowerCase();
      return normalizedQuery.split(/\s+/).every((term) => searchable.includes(term));
    })
    .sort((a, b) => {
      if (!normalizedQuery) return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      return Number(bTitle.startsWith(normalizedQuery)) - Number(aTitle.startsWith(normalizedQuery));
    })
    .slice(0, 7);
  const knownIds = new Set(state?.papers.map((paper) => paper.id) || []);
  const discoveries = remotePapers.filter((paper) => !knownIds.has(paper.id));
  const items: (
    | { kind: "import" }
    | { kind: "paper"; paper: Paper }
    | { kind: "discovery"; paper: PaperSearchResult }
  )[] = [
    ...(canImport ? [{ kind: "import" as const }] : []),
    ...papers.map((paper) => ({ kind: "paper" as const, paper })),
    ...discoveries.map((paper) => ({ kind: "discovery" as const, paper })),
  ];
  const activeItem = items[activeIndex];
  const select = async (item: (typeof items)[number]) => {
    if (item.kind === "paper") {
      close();
      router.push(`/papers/${encodeURIComponent(item.paper.id)}`);
      return;
    }
    try {
      setError("");
      const url = item.kind === "discovery"
        ? `https://arxiv.org/abs/${item.paper.id}`
        : query;
      const result = await act({ action: "import", url });
      close();
      router.push(`/papers/${encodeURIComponent(result.paperId)}`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="command-palette"
      aria-label="Find or add a paper"
    >
      <div className="command-palette-heading">
        <span className="eyebrow">Your research desk</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close paper search"
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      <div className="command-search">
        <Search size={20} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="paper-palette-results"
          aria-activedescendant={activeItem ? `paper-palette-item-${activeIndex}` : undefined}
          aria-label="Search papers or paste an arXiv link"
          placeholder="Search papers or paste an arXiv link…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && items.length) {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, items.length - 1));
            } else if (event.key === "ArrowUp" && items.length) {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && activeItem) {
              event.preventDefault();
              void select(activeItem);
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="icon-button"
            aria-label="Clear paper search"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              setError("");
            }}
          >
            <X size={17} />
          </button>
        ) : <kbd>esc</kbd>}
      </div>
      {error && <p className="command-error" role="alert">{error}</p>}
      <div id="paper-palette-results" className="command-results" role="listbox">
        {canImport && (
          <div className="command-group">
            <span className="command-group-label">ADD TO YOUR LIBRARY</span>
            <button
              type="button"
              id="paper-palette-item-0"
              role="option"
              aria-selected={activeIndex === 0}
              className={`command-item import ${activeIndex === 0 ? "active" : ""}`}
              disabled={busy}
              onMouseMove={() => setActiveIndex(0)}
              onClick={() => void select({ kind: "import" })}
            >
              <span className="command-item-icon"><FilePlus2 size={17} /></span>
              <span className="command-item-copy">
                <strong>{busy ? "Adding paper…" : "Add this paper"}</strong>
                <small>{query.trim()}</small>
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        {(papers.length > 0 || !normalizedQuery) && (
          <div className="command-group">
            <span className="command-group-label">
              {normalizedQuery ? "YOUR PAPERS" : "RECENT PAPERS"}
            </span>
            {papers.map((paper, index) => {
              const itemIndex = index + (canImport ? 1 : 0);
              const entry = state?.entries[paper.id];
              return (
                <button
                  type="button"
                  id={`paper-palette-item-${itemIndex}`}
                  role="option"
                  aria-selected={activeIndex === itemIndex}
                  className={`command-item ${activeIndex === itemIndex ? "active" : ""}`}
                  key={paper.id}
                  onMouseMove={() => setActiveIndex(itemIndex)}
                  onClick={() => void select({ kind: "paper", paper })}
                >
                  <span className={`paper-dot ${paper.accent}`} />
                  <span className="command-item-copy">
                    <strong>{paper.title}</strong>
                    <small>{paper.authors} · {paper.year}{entry ? ` · ${entry.status === "saved" ? "To read" : entry.status}` : " · Suggested"}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
          </div>
        )}
        {normalizedQuery.length >= 2 && !canImport && (
          <div className="command-group">
            <span className="command-group-label">
              {searching ? "SEARCHING ARXIV + OPENALEX" : "DISCOVER"}
            </span>
            {discoveries.map((paper, index) => {
              const itemIndex = papers.length + index;
              return (
                <button
                  type="button"
                  id={`paper-palette-item-${itemIndex}`}
                  role="option"
                  aria-selected={activeIndex === itemIndex}
                  className={`command-item ${activeIndex === itemIndex ? "active" : ""}`}
                  key={paper.id}
                  disabled={busy}
                  onMouseMove={() => setActiveIndex(itemIndex)}
                  onClick={() => void select({ kind: "discovery", paper })}
                >
                  <span className="command-item-icon discovery"><Globe2 size={16} /></span>
                  <span className="command-item-copy">
                    <strong>{paper.title}</strong>
                    <small>{paper.authors}{paper.year ? ` · ${paper.year}` : ""} · arXiv {paper.id}</small>
                  </span>
                  <FilePlus2 size={16} aria-label="Add paper" />
                </button>
              );
            })}
            {searching && (
              <p className="command-empty searching" role="status">Searching the scholarly corpus…</p>
            )}
            {!searching && !discoveries.length && (
              <p className="command-empty">
                {searchError
                  ? `${searchError} Paste an arXiv link to add it.`
                  : "No importable papers found. Try a title, author, or arXiv link."}
              </p>
            )}
            {!searching && discoveries.length > 0 && (
              <p className="command-provenance">
                Found via {providers
                  .filter((provider) => provider.status === "ok")
                  .map((provider) => provider.provider === "arxiv" ? "arXiv" : "OpenAlex")
                  .join(" + ") || "scholarly indexes"}. Selecting a paper adds its canonical arXiv record.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="command-footer" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> select</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </dialog>
  );
}
