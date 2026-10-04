"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Bookmark, Plus, Search, X } from "lucide-react";
import { useApp } from "./app-context";
import { LibraryPreparationAction } from "./library-preparation-action";
import { notecardStatus, paperDisplayTitle, paperSummary } from "./paper-card-copy";

const Diagram = dynamic(() => import("./diagram").then(module => module.Diagram), {
  loading: () => <div className="diagram diagram-loading" aria-label="Loading diagram" />,
});

export function Library() {
  const { state, openAdd } = useApp();
  const [q, setQ] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("recent");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!state) return null;
  const entries = Object.values(state.entries);
  const pairs = entries
    .map((e) => ({ e, p: state.papers.find((p) => p.id === e.paperId)! }))
    .filter((x) => x.p);
  const results = pairs
    .filter(
      ({ e, p }) =>
        (filter === "all" ? e.status !== "archived" : e.status === filter) &&
        [
          p.title,
          p.authors,
          p.topics.join(" "),
          p.abstract,
          p.recall?.idea,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.p.title.localeCompare(b.p.title)
        : Date.parse(b.e.savedAt) - Date.parse(a.e.savedAt),
    );
  return (
    <div className="page">
      <div className="page-intro compact">
        <h1>Ideas, kept close.</h1>
        <p>The papers you follow. The ideas worth returning to.</p>
      </div>
      <section className="search-panel panel">
        <div className="section-heading">
          <label className="eyebrow" htmlFor="library-search">
            Find an idea
          </label>
          <span className="eyebrow keyboard-hint">PRESS / TO FOCUS</span>
        </div>
        <div className="search-input">
          <Search size={23} />
          <input
            id="library-search"
            ref={input}
            placeholder="Search papers, concepts, ideas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setQ("")}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="filter-row">
          <div className="filters">
            {[
              ["all", "All"],
              ["saved", "To read"],
              ["reading", "Reading"],
              ["read", "Read"],
              ...(entries.some((e) => e.status === "archived")
                ? [["archived", "Archived"]]
                : []),
            ].map(([key, label]) => (
              <button
                className={filter === key ? "selected" : ""}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                key={key}
              >
                {label}
                <span>
                  {key === "all"
                    ? entries.filter((e) => e.status !== "archived").length
                    : entries.filter((e) => e.status === key).length}
                </span>
              </button>
            ))}
          </div>
          <span className="eyebrow matches" role="status" aria-live="polite" aria-atomic="true">
            {results.length} {results.length === 1 ? "MATCH" : "MATCHES"}
          </span>
        </div>
      </section>
      <div className="section-heading library-heading">
        <h2 className="library-title">Notecards</h2>
        <label className="sort">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recently added</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
      {results.length ? (
        <div className="library-grid">
          {results.map(({ p, e }) => (
            <article
              className={`library-card ${p.accent}`}
              key={p.id}
              aria-label={p.title}
            >
              <div className="card-top">
                <span className={`notecard-status ${p.recall ? "ready" : p.generationStatus}`}>
                  <span aria-hidden="true" />{notecardStatus(p)}
                </span>
                <span className="status-label">{e.status === "saved" ? "To read" : e.status === "reading" ? "Reading" : e.status === "archived" ? "Archived" : "Read"}</span>
              </div>
              <div className="library-card-preview">
                <Diagram paper={p} thumbnail />
                <LibraryPreparationAction paper={p} />
              </div>
              <h2 title={p.title}><Link className="library-card-link" href={`/papers/${encodeURIComponent(p.id)}`}>{paperDisplayTitle(p.title)}</Link></h2>
              <p>{p.recall?.idea || paperSummary(p.abstract)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty library-empty">
          <Bookmark size={26} strokeWidth={1.5} className="empty-icon" aria-hidden="true" />
          <h2>
            {q || filter !== "all"
              ? "No ideas here, just yet."
              : "A home for what you read."}
          </h2>
          <p>
            {q || filter !== "all"
              ? "Try a different search or filter."
              : "Add your first paper, or save one from your reading shortlist."}
          </p>
          <button
            className="button"
            onClick={
              q || filter !== "all"
                ? () => {
                    setQ("");
                    setFilter("all");
                  }
                : openAdd
            }
          >
            {q || filter !== "all" ? "Clear filters" : "Add your first paper"}
            {q || filter !== "all" ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}
