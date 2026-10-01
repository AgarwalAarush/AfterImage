"use client";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Search,
  FilePlus2,
  Bookmark,
  Check,
  RefreshCw,
  Download,
  ChevronDown,
  Compass,
  BookOpen,
  SlidersHorizontal,
  LogOut,
  Globe2,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import type { AppState, Paper, Entry, Recommendation } from "@/lib/types";
import type { PaperSearchProvider, PaperSearchResult } from "@/lib/paper-search";
import dynamic from "next/dynamic";
import { clientRequest } from "@/lib/client-request";
import { readLibrary, readLibraryUpdate, SessionExpired } from "@/lib/library-client";
import { LoadingStatus } from "./loading-status";
import { LibraryContent } from "./library-content";
import { ThemeControl } from "./theme-control";
const Diagram = dynamic(() => import("./diagram").then(module => module.Diagram), {
  loading: () => <div className="diagram diagram-loading" aria-label="Loading diagram" />,
});
import { readerUrl } from "@/lib/identity";
import { download } from "@/lib/download";
const Context = createContext<{
  state: AppState | null;
  act: (body: Record<string, unknown>) => Promise<any>;
  busy: boolean;
  refresh: () => Promise<void>;
  refreshing: boolean;
  openAdd: () => void;
  toast: (s: string) => void;
}>({
  state: null,
  act: async () => {},
  busy: false,
  refresh: async () => {},
  refreshing: false,
  openAdd: () => {},
  toast: () => {},
});
export const useApp = () => useContext(Context);
export function Mark() {
  return (
    <svg viewBox="0 0 36 36" width="33" height="33" aria-hidden="true">
      <path
        d="M9 6h18v23H9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5 10h18v23H5z"
        fill="var(--canvas)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M13 3h18v23H13z"
        fill="var(--paper)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle
        cx="22"
        cy="14"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M22 9v10" stroke="currentColor" />
    </svg>
  );
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [paletteOpen, setPaletteOpen] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter(),
    pathname = usePathname();
  const stateRef = useRef<AppState | null>(null),
    requestRef = useRef<AbortController | null>(null),
    busyRef = useRef(false),
    versionRef = useRef<number | null>(null),
    lastLoaded = useRef(0);
  const refresh = useCallback(async () => {
    if (busyRef.current || (requestRef.current && !requestRef.current.signal.aborted)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setError("");
    try {
      const {state: data, version, workerSeenAt} = await readLibraryUpdate(
        controller.signal, stateRef.current && versionRef.current !== null ? versionRef.current : undefined,
      );
      if (controller.signal.aborted) return;
      versionRef.current = version;
      lastLoaded.current = Date.now();
      if (data) {
        stateRef.current = data;
        setState(data);
      } else if (stateRef.current && stateRef.current.workerSeenAt !== workerSeenAt) {
        stateRef.current = {...stateRef.current, workerSeenAt};
        setState(stateRef.current);
      }
      setError("");
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof SessionExpired) {
        stateRef.current = null;
        versionRef.current = null;
        setState(null);
        router.replace("/login");
      } else setError((e as Error).message);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setRefreshing(false); }
    }
  }, [router]);
  useEffect(() => {
    if (pathname === "/login") {
      requestRef.current?.abort();
      stateRef.current = null;
      versionRef.current = null;
      lastLoaded.current = 0;
      setState(null);
      setError("");
    } else if (!pathname.startsWith("/documents") && (!stateRef.current || Date.now() - lastLoaded.current > 30000)) void refresh();
  }, [refresh, pathname]);
  useEffect(() => () => { requestRef.current?.abort(); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (pathname === "/login") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pathname]);
  const activeJobs = state?.jobs.some(j => ["queued", "running"].includes(j.status)) || false;
  useEffect(() => {
    if (pathname === "/login" || pathname.startsWith("/documents")) return;
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh();
    };
    const resume = () => { if (Date.now() - lastLoaded.current > 10000) poll(); };
    const t = setInterval(poll, activeJobs ? 5000 : error ? 15000 : 60000);
    window.addEventListener("online", poll);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", poll);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh, activeJobs, pathname, error]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);
  const act = useCallback(async (body: Record<string, unknown>) => {
    busyRef.current = true;
    requestRef.current?.abort();
    setBusy(true);
    try {
      const r = await clientRequest("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        stateRef.current = null;
        versionRef.current = null;
        setState(null);
        router.replace("/login");
        throw new Error("Please sign in again.");
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      stateRef.current = data.state;
      versionRef.current = null;
      lastLoaded.current = Date.now();
      setState(data.state);
      setError("");
      return data;
    } catch (e) {
      setMessage((e as Error).message);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [router]);
  if (pathname === "/login") return children;
  return (
    <Context.Provider
      value={{
        state,
        act,
        busy,
        refresh,
        refreshing,
        openAdd: () => setPaletteOpen(true),
        toast: setMessage,
      }}
    >
      <header className="site-header">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <Mark />
            <span>
              afterimage<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            {[
              ["/", "For you"],
              ["/library", "Library"],
              ["/documents", "Documents"],
            ].map(([href, label]) => (
              <Link
                href={href}
                className={pathname === href || (href === "/documents" && pathname.startsWith("/documents/")) ? "active" : ""}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <button
              className="button small add-nav"
              aria-label="Add a paper"
              onClick={() => setPaletteOpen(true)}
            >
              <Plus size={16} />
              <span>Add a paper</span>
            </button>
            <ThemeControl />
          </div>
        </div>
      </header>
      <main>
        <LibraryContent loaded={pathname.startsWith("/documents") || !!state} error={pathname.startsWith("/documents") ? "" : error} retry={refresh} loading={
          <div className="loading-state">
            <Mark />
            <LoadingStatus label="Opening your reading desk" detail="Fetching your private library. This is taking longer than usual; the connection will time out and offer a retry." />
            <div className="skeleton" />
          </div>
        }>{children}</LibraryContent>
      </main>
      <footer className="site-footer">
        <span>
          <span className="footer-mark">◌</span> A little less forgotten.
        </span>
        <span className="eyebrow">YOUR PERSONAL RESEARCH COMPANION</span>
      </footer>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {paletteOpen && <PaperPalette close={() => setPaletteOpen(false)} />}
    </Context.Provider>
  );
}
function matchesPaperInput(value: string) {
  return /^(?:\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?|https?:\/\/(?:www\.)?(?:arxiv|alphaxiv)\.org\/)/i.test(value.trim());
}
function PaperPalette({ close }: { close: () => void }) {
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
        <span className="eyebrow">YOUR RESEARCH DESK</span>
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
export function Home() {
  const { state, act, busy, toast } = useApp();
  if (!state) return null;
  const recs = state.recommendations
    .map((r) => ({ r, p: state.papers.find((p) => p.id === r.paperId)! }))
    .filter((x) => x.p);
  const active = state.jobs.find(
    (j) => j.type === "recommend" && ["queued", "running"].includes(j.status),
  );
  const latestRecommendationJob = state.jobs.filter((j) => j.type === "recommend").at(-1);
  const saved = Object.values(state.entries).filter(
    (e) => e.status !== "archived",
  );
  const recall = saved
    .map((e) => ({ e, p: state.papers.find((p) => p.id === e.paperId) }))
    .filter(
      (item): item is { e: Entry; p: Paper } =>
        Boolean(
          item.p?.recall,
        ),
    )
    .sort((a, b) => {
      const priority = { read: 0, reading: 1, saved: 2, archived: 3 };
      const status = priority[a.e.status] - priority[b.e.status];
      return status || Date.parse(b.e.reviewedAt || b.e.updatedAt) - Date.parse(a.e.reviewedAt || a.e.updatedAt);
    })
    .slice(0, 3);
  return (
    <div className="page home">
      <div className="page-intro">
        <div className="eyebrow intro-kicker">
          <span className="tiny-cross">✳</span> YOUR READING COMPASS
        </div>
        <h1>Follow the thread.</h1>
        <p>
          A few papers worth your attention.
          <br className="mobile-break" /> A place for the ideas that stay.
        </p>
      </div>
      <div className="section-heading shortlist-heading">
        <div className="shortlist-title">
          <h2>Next reads</h2>
          <span className="muted section-sub">
            {state.recommendationSource === "starter"
              ? "A few strong places to begin."
              : "Shaped by what you save, read, and skip."}
          </span>
        </div>
        {state.direction.goal && (
          <button
            className="text-button"
            disabled={busy || !!active}
            onClick={() =>
              act({ action: "recommend" })
                .then(() => toast("Your next reading list is queued."))
                .catch(() => {})
            }
          >
            <RefreshCw size={14} className={active ? "spin" : ""} />
            {active ? "Updating suggestions…" : "Refresh suggestions"}
          </button>
        )}
      </div>
      {latestRecommendationJob?.status === "failed" && (
        <p className="notice">
          Suggestions could not refresh. Your previous picks are still here.
        </p>
      )}
      <div className="recommendation-grid">
        {recs.map(({ r, p }, i) => (
          <RecommendationCard
            key={p.id}
            paper={p}
            recommendation={r}
            index={i}
          />
        ))}
      </div>
      {!recs.length && (
        <div className="empty panel">
          <Compass size={24} />
          <h2>Your next papers are being chosen.</h2>
          <p>Your library stays available while suggestions refresh.</p>
        </div>
      )}
      <div className="below-grid">
        <section className="return-section">
          <div className="section-heading">
            <div className="recall-heading">
              <h2>Recall</h2>
              <span className="muted section-sub">Reviewed notecards ready for a quick return.</span>
            </div>
            <Link className="text-button" href="/library">
              Your library <ArrowRight size={14} />
            </Link>
          </div>
          {recall.length ? (
            recall.map(({ e, p }) => (
              <Link
                className="revisit-row"
                key={p.id}
                href={`/papers/${encodeURIComponent(p.id)}`}
              >
                <span className={`paper-dot ${p.accent}`} />
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.recall?.idea || "Return to the idea."}</p>
                </div>
                <span className="revisit-status">
                  {e.status === "read"
                    ? "Read"
                    : e.status === "reading"
                      ? "In progress"
                      : "Saved"}
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <div className="recall-empty">
              <div>
                <h3>A place to return to an idea.</h3>
                <p>Save a paper and prepare its reading kit to keep its notecard here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function paperDisplayTitle(title: string) {
  const prefix = title.split(":", 1)[0].trim();
  return title.includes(":") && prefix.length <= 36 ? prefix : title;
}
function notecardStatus(paper: Paper) {
  if (paper.recall) return "Notecard ready";
  if (paper.generationStatus === "queued") return "Queued for preparation";
  if (paper.generationStatus === "running") return {
    sources: "Gathering evidence", planning: "Planning the explanation",
    drafting: "Composing notecard", reviewing: "Reviewing notecard",
  }[paper.generationStep || "sources"];
  return paper.generationStatus === "failed" ? "Prepare again" : "Paper saved";
}
function paperSummary(abstract: string) {
  const text = abstract.replace(/\s+/g, " ").trim();
  if (text.length <= 280) return text;
  const end = text.slice(0, 280).search(/[.!?](?:\s|$)/);
  return end >= 80 ? text.slice(0, end + 1) : text.slice(0, 277).replace(/\s+\S*$/, "") + "…";
}
function RecommendationCard({
  paper: p,
  recommendation: r,
  index,
}: {
  paper: Paper;
  recommendation: Recommendation;
  index: number;
}) {
  const { state, act, busy, toast } = useApp();
  const router = useRouter();
  const saved = !!state?.entries[p.id];
  const preparing = state?.jobs.some(j => j.paperId === p.id && j.type === "generate" && ["queued", "running"].includes(j.status));
  const paperHref = `/papers/${encodeURIComponent(p.id)}`;
  const prepare = () => act({action: "generate", paperId: p.id})
    .then(() => { toast("Reading kit queued and saved to your library."); router.push(paperHref); })
    .catch(() => {});
  return (
    <article className={`paper-card next-read-card ${p.accent}`}>
      <div className="card-top">
        <span className="eyebrow">
          <span className="card-number">0{index + 1}</span>
          {r.role}
        </span>
        <div className="card-tools">
          <details
            className="suggestion-feedback"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }}
          >
            <summary>
              <MoreHorizontal size={18} />
              <span className="sr-only">Refine this suggestion</span>
            </summary>
            <div>
              {[
                ["useful", "Useful"],
                ["known", "Already know it"],
                ["advanced", "Too advanced"],
                ["irrelevant", "Not for me"],
                ["later", "Save for later"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  disabled={busy}
                  onClick={(event) => {
                    const menu = event.currentTarget.closest("details");
                    if (menu) menu.open = false;
                    void act({ action: "feedback", paperId: p.id, value })
                      .then(() => toast("Noted for your next shortlist."))
                      .catch(() => {});
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>
          <button
            aria-label={saved ? `${p.title} saved` : `Save ${p.title}`}
            className={`icon-button bookmark ${saved ? "saved" : ""}`}
            disabled={busy || saved}
            onClick={() =>
              act({ action: "save", paperId: p.id })
                .then(() => toast("Saved to your library."))
                .catch(() => {})
            }
          >
            {saved ? <Check size={16} /> : <Bookmark size={16} />}
          </button>
        </div>
      </div>
      <div className="card-content">
        <Link
          href={`/papers/${encodeURIComponent(p.id)}`}
          className="card-title"
        >
          <h2 title={p.title}>{paperDisplayTitle(p.title)}</h2>
        </Link>
        <p className="card-idea">
          {p.recall?.idea || paperSummary(p.abstract)}
        </p>

        <div className="card-actions">
          {p.recall || preparing ? <Link href={paperHref} className="kit-action">
            {p.recall ? <BookOpen size={16} /> : <Sparkles size={16} />}{p.recall ? "Read notecard" : "View preparation"}<ArrowRight size={16} />
          </Link> : <button className="kit-action" disabled={busy} onClick={prepare}><Sparkles size={15} />Prepare reading kit<ArrowRight size={15} /></button>}
        </div>
      </div>
    </article>
  );
}
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
        <div className="eyebrow intro-kicker">YOUR GROWING COLLECTION</div>
        <h1>Ideas, kept close.</h1>
        <p>The papers you follow. The ideas worth returning to.</p>
      </div>
      <section className="search-panel panel">
        <div className="section-heading">
          <label className="eyebrow" htmlFor="library-search">
            FIND AN IDEA
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
          <span className="eyebrow matches">
            {results.length} {results.length === 1 ? "MATCH" : "MATCHES"}
          </span>
        </div>
      </section>
      <div className="section-heading library-heading">
        <span className="eyebrow">YOUR NOTECARDS</span>
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
            <Link
              href={`/papers/${encodeURIComponent(p.id)}`}
              className={`library-card ${p.accent}`}
              key={p.id}
            >
              <div className="card-top">
                <span className={`notecard-status ${p.recall ? "ready" : p.generationStatus}`}>
                  <span aria-hidden="true" />{notecardStatus(p)}
                </span>
                <span className="status-label">{e.status === "saved" ? "To read" : e.status === "reading" ? "Reading" : e.status === "archived" ? "Archived" : "Read"}</span>
              </div>
              <Diagram paper={p} thumbnail />
              <h2 title={p.title}>{paperDisplayTitle(p.title)}</h2>
              <p>{p.recall?.idea || paperSummary(p.abstract)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty library-empty">
          <div className="ghost-cards">
            <span />
            <span />
            <span>
              <Bookmark size={22} />
            </span>
          </div>
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
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
export function Direction() {
  const { state, act, busy, toast } = useApp();
  if (!state) return null;
  return <DirectionForm initial={state} act={act} busy={busy} toast={toast} />;
}
function DirectionForm({
  initial: s,
  act,
  busy,
  toast,
}: {
  initial: AppState;
  act: (v: Record<string, unknown>) => Promise<any>;
  busy: boolean;
  toast: (v: string) => void;
}) {
  const [goal, setGoal] = useState(s.direction.goal),
    [background, setBackground] = useState(s.direction.background || ""),
    [readingContext, setReadingContext] = useState(s.direction.readingContext || ""),
    [questions, setQuestions] = useState(s.direction.questions),
    [topics, setTopics] = useState(s.direction.topics.join(", ")),
    [dirty, setDirty] = useState(false);
  const router = useRouter();
  const job = s.jobs.find(
    (j) => j.type === "recommend" && ["queued", "running"].includes(j.status),
  );
  async function save(generate = false) {
    try {
      await act({
        action: "direction",
        direction: {
          goal,
          background,
          readingContext,
          questions,
          topics: topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      setDirty(false);
      if (generate) {
        await act({ action: "recommend" });
        router.push("/");
      } else toast("Your direction is saved.");
    } catch {}
  }
  return (
    <div className="page direction-page">
      <div className="page-intro compact">
        <span className="eyebrow intro-kicker">
          GIVE YOUR CURIOSITY A DIRECTION
        </span>
        <h1>What’s on your mind?</h1>
        <p>A reading list is better when it knows where you’re going.</p>
      </div>
      <div className="direction-grid">
        <form
          className="panel direction-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Your research background
            <textarea
              maxLength={3000}
              rows={3}
              value={background}
              onChange={(e) => { setBackground(e.target.value); setDirty(true); }}
              placeholder="I do MoE research. Focus on routing, conditional compute, and the systems tradeoffs behind efficient models."
            />
            <small>Tell us what you work on and already understand. This sets the level of your recommendations.</small>
          </label>
          <label>
            What are you trying to understand?
            <textarea
              required
              maxLength={3000}
              rows={4}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setDirty(true);
              }}
              placeholder="I want to understand how to make language models cheaper to train and run, without losing capability."
            />
          </label>
          <label>
            What questions are you carrying?
            <textarea
              maxLength={3000}
              rows={4}
              value={questions}
              onChange={(e) => {
                setQuestions(e.target.value);
                setDirty(true);
              }}
              placeholder="How does sparse routing actually work? When should I reach for LoRA rather than full fine-tuning?"
            />
          </label>
          <label>
            Threads you’re following
            <input
              maxLength={700}
              value={topics}
              onChange={(e) => {
                setTopics(e.target.value);
                setDirty(true);
              }}
              placeholder="Efficient models, representation learning, systems"
            />
            <small>Separate topics with commas. Up to 12.</small>
          </label>
          <label>
            Reading paths and suggestions
            <textarea
              maxLength={20000}
              rows={7}
              value={readingContext}
              onChange={(e) => { setReadingContext(e.target.value); setDirty(true); }}
              placeholder="Paste a conversation, reading-group list, or proposed paper sequence. Include arXiv links where you have them."
            />
            <small>Suggestions guide discovery. Linked papers are verified before selection; this does not mark them as read.</small>
          </label>
          <div className="direction-buttons">
            <button
              className="button primary"
              type="button"
              disabled={!goal.trim() || busy || !!job}
              onClick={() => save(true)}
            >
              {job ? "Finding your next reads…" : "Find my next reads"}
              <ArrowRight size={16} />
            </button>
            <button className="text-button" disabled={busy || !dirty}>
              Save direction
            </button>
          </div>
        </form>
        <aside>
          <div className="direction-illustration">
            <svg viewBox="0 0 300 190" aria-hidden="true">
              <path
                d="M35 150C65 120 98 178 132 109S208 53 265 35"
                stroke="#a695c7"
                fill="none"
                strokeWidth="1.5"
                strokeDasharray="4 5"
              />
              <circle cx="35" cy="150" r="6" fill="#eee9f6" stroke="#967eb8" />
              <circle cx="132" cy="109" r="9" fill="#eee9f6" stroke="#967eb8" />
              <circle cx="265" cy="35" r="17" fill="none" stroke="#967eb8" />
              <circle cx="265" cy="35" r="4" fill="#967eb8" />
            </svg>
          </div>
          <span className="eyebrow">A COMPASS, NOT A CURRICULUM</span>
          <h2>
            Enough direction.
            <br />
            Room for a detour.
          </h2>
          <p>
            Your goals, reading history, and feedback help shape each shortlist.
            You’ll see why a paper belongs and what to look for.
          </p>
          <p>
            Suggestions stay put until you ask for new ones. There’s no feed to
            keep up with.
          </p>
          <div className="worker-status">
            <span
              className={`status-dot ${s.workerSeenAt && Date.now() - Date.parse(s.workerSeenAt) < 180000 ? "online" : ""}`}
            />
            {s.workerSeenAt && Date.now() - Date.parse(s.workerSeenAt) < 180000
              ? "Your research worker is connected."
              : "Generation will start when your Mac server connects."}
          </div>
        </aside>
      </div>
      <section className="settings-row">
        <div>
          <span className="eyebrow">YOURS TO KEEP</span>
          <p>Export your library and notecards.</p>
        </div>
        <button
          className="button"
          onClick={async () => {
            try {
              const full = await readLibrary(new AbortController().signal, fetch, true);
              download("afterimage-library.json", JSON.stringify(full, null, 2), "application/json");
            } catch { toast("Could not export the complete library. Please try again."); }
          }}
        >
          Export library
          <Download size={15} />
        </button>
        <button
          className="icon-button"
          aria-label="Sign out"
          onClick={async () => {
            await fetch("/api/auth", { method: "DELETE" });
            router.push("/login");
          }}
        >
          <LogOut size={17} />
        </button>
      </section>
    </div>
  );
}
export function Login() {
  const [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="login-wrap">
      <div className="login-theme"><ThemeControl /></div>
      <Link className="brand" href="/">
        <Mark />
        <span>afterimage.</span>
      </Link>
      <form
        className="panel login-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            router.replace("/");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">YOUR PERSONAL READING DESK</span>
        <h1>
          A little less
          <br />
          forgotten.
        </h1>
        <p>
          Welcome back to your papers, your questions, and the ideas that stay.
        </p>
        <label>
          Access key
          <input
            type="password"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="button primary full">
          {busy ? "Opening…" : "Open my library"}
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
