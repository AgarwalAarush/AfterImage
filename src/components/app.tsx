"use client";
import {
  createContext,
  useContext,
  useEffect,
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
  Bookmark,
  Check,
  RefreshCw,
  Download,
  ChevronDown,
  Compass,
  BookOpen,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import type { AppState, Paper, Entry, Recommendation } from "@/lib/types";
import dynamic from "next/dynamic";
import { readLibrary, SessionExpired } from "@/lib/library-client";
import { LibraryContent } from "./library-content";
const Diagram = dynamic(() => import("./diagram").then(module => module.Diagram), {
  loading: () => <div className="diagram diagram-loading" aria-label="Loading diagram" />,
});
import { readerUrl } from "@/lib/identity";
import { download } from "@/lib/download";
const Context = createContext<{
  state: AppState | null;
  act: (body: Record<string, unknown>) => Promise<any>;
  busy: boolean;
  openAdd: () => void;
  toast: (s: string) => void;
}>({
  state: null,
  act: async () => {},
  busy: false,
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
        fill="white"
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
    [adding, setAdding] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter(),
    pathname = usePathname();
  const stateRef = useRef<AppState | null>(null),
    requestRef = useRef<AbortController | null>(null),
    busyRef = useRef(false),
    lastLoaded = useRef(0);
  const refresh = useCallback(async () => {
    if (busyRef.current || (requestRef.current && !requestRef.current.signal.aborted)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const data = await readLibrary(controller.signal);
      if (controller.signal.aborted) return;
      stateRef.current = data;
      lastLoaded.current = Date.now();
      setState(data);
      setError("");
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof SessionExpired) {
        stateRef.current = null;
        setState(null);
        router.replace("/login");
      } else setError((e as Error).message);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [router]);
  useEffect(() => {
    if (pathname === "/login") {
      requestRef.current?.abort();
      stateRef.current = null;
      lastLoaded.current = 0;
      setState(null);
      setError("");
    } else if (!stateRef.current || Date.now() - lastLoaded.current > 30000) void refresh();
  }, [refresh, pathname]);
  useEffect(() => () => { requestRef.current?.abort(); }, []);
  const activeJobs = state?.jobs.some(j => ["queued", "running"].includes(j.status)) || false;
  useEffect(() => {
    if (pathname === "/login") return;
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
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        stateRef.current = null;
        setState(null);
        router.replace("/login");
        throw new Error("Please sign in again.");
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      stateRef.current = data.state;
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
        openAdd: () => setAdding(true),
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
              ["/direction", "Direction"],
            ].map(([href, label]) => (
              <Link
                href={href}
                className={pathname === href ? "active" : ""}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
          <button
            className="button small add-nav"
            onClick={() => setAdding(true)}
          >
            <Plus size={16} />
            <span>Add a paper</span>
          </button>
        </div>
      </header>
      <main>
        <LibraryContent loaded={!!state} error={error} retry={refresh} loading={
          <div className="loading-state" role="status">
            <Mark />
            <p className="eyebrow">Opening your reading desk</p>
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
      {adding && <AddDialog close={() => setAdding(false)} />}
    </Context.Provider>
  );
}
function AddDialog({ close }: { close: () => void }) {
  const { act, busy } = useApp(),
    router = useRouter(),
    ref = useRef<HTMLDialogElement>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="modal"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const d = await act({ action: "import", url });
            close();
            router.push(`/papers/${encodeURIComponent(d.paperId)}`);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="section-heading">
          <span className="eyebrow">A PLACE FOR THE NEXT IDEA</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <h2>Add a paper.</h2>
        <p>
          Drop in an arXiv or alphaXiv link. We’ll keep the paper, and leave the
          reading to you.
        </p>
        <label htmlFor="paper-url">Paper link or arXiv ID</label>
        <input
          id="paper-url"
          autoFocus
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://arxiv.org/abs/…"
        />
        <small>For example: 2401.04088</small>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Finding the paper…" : "Add to my library"}
          <ArrowRight size={16} />
        </button>
      </form>
    </dialog>
  );
}
export function Home() {
  const { state, act, busy, openAdd, toast } = useApp();
  if (!state) return null;
  const recs = state.recommendations
    .map((r) => ({ r, p: state.papers.find((p) => p.id === r.paperId)! }))
    .filter((x) => x.p);
  const active = state.jobs.find(
    (j) => j.type === "recommend" && ["queued", "running"].includes(j.status),
  );
  const failed = state.jobs.filter((j) => j.type === "recommend").at(-1);
  const saved = Object.values(state.entries).filter(
    (e) => e.status !== "archived",
  );
  const revisit = saved
    .filter((e) => e.status === "read")
    .sort(
      (a, b) =>
        Date.parse(a.reviewedAt || a.updatedAt) -
        Date.parse(b.reviewedAt || b.updatedAt),
    )
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
      <div className="direction-strip">
        <div>
          <span className="eyebrow">CURRENT DIRECTION</span>
          <p>{state.direction.goal || "What are you trying to understand?"}</p>
        </div>
        <Link href="/direction">
          {state.direction.goal ? "Refine direction" : "Set your direction"}
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="section-heading shortlist-heading">
        <div>
          <span className="eyebrow">
            {state.recommendationSource === "starter"
              ? "A FEW STARTING POINTS"
              : "YOUR NEXT READS"}
          </span>
          <span className="muted section-sub">
            {state.recommendationSource === "starter"
              ? "An editorial selection to begin with."
              : "Selected around your goals. Kept here until you move on."}
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
            {active ? "Finding your next reads…" : "New shortlist"}
          </button>
        )}
      </div>
      {failed?.status === "failed" && (
        <p className="notice">
          The last shortlist couldn’t finish. {failed.error} Your previous
          selection is still here.
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
          <h2>A little room for a new direction.</h2>
          <p>Update your goal, then ask for your next reading list.</p>
          <Link className="button" href="/direction">
            Set direction
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="below-grid">
        <section className="return-section">
          <div className="section-heading">
            <span className="eyebrow">
              {revisit.length ? "LET IT COME BACK" : "MAKE ROOM FOR RECALL"}
            </span>
            <Link className="text-button" href="/library">
              Your library <ArrowRight size={14} />
            </Link>
          </div>
          {revisit.length ? (
            revisit.map((e) => {
              const p = state.papers.find((p) => p.id === e.paperId)!;
              return (
                <Link
                  className="revisit-row"
                  key={p.id}
                  href={`/papers/${encodeURIComponent(p.id)}`}
                >
                  <span className={`paper-dot ${p.accent}`} />
                  <div>
                    <h3>{p.title}</h3>
                    <p>
                      {e.takeaway || p.recall?.idea || "Return to the idea."}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              );
            })
          ) : (
            <div className="recall-empty">
              <div className="ghost-cards">
                <span />
                <span />
                <span>↺</span>
              </div>
              <div>
                <h3>The good ideas deserve a second visit.</h3>
                <p>
                  Mark a paper as read and it will find its way back here, with
                  a deeper recall and a visual refresher.
                </p>
              </div>
            </div>
          )}
        </section>
        <aside className="aside-note">
          <span className="eyebrow">A SMALL READING RITUAL</span>
          <h3>
            Read elsewhere.
            <br />
            Remember here.
          </h3>
          <p>
            Open a paper in alphaXiv. Follow your curiosity. Come back for the
            one idea you want to keep.
          </p>
          <button className="text-button" onClick={openAdd}>
            Bring a paper with you
            <Plus size={14} />
          </button>
        </aside>
      </div>
    </div>
  );
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
  const { state, act, toast } = useApp();
  const saved = !!state?.entries[p.id];
  return (
    <article className={`paper-card ${p.accent}`}>
      <div className="card-top">
        <span className="eyebrow">
          <span className="card-number">0{index + 1}</span>
          {r.role}
        </span>
        <button
          aria-label={saved ? `${p.title} saved` : `Save ${p.title}`}
          className={`icon-button bookmark ${saved ? "saved" : ""}`}
          onClick={() =>
            act({ action: "save", paperId: p.id })
              .then(() => toast("Saved to your library."))
              .catch(() => {})
          }
        >
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
        </button>
      </div>
      <Link
        className="card-art"
        href={`/papers/${encodeURIComponent(p.id)}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Diagram paper={p} thumbnail />
      </Link>
      <div className="card-content">
        <div className="eyebrow paper-meta">
          {p.year}
          <span>·</span>
          {p.topics[0] || "Research paper"}
        </div>
        <Link
          href={`/papers/${encodeURIComponent(p.id)}`}
          className="card-title"
        >
          <h2>{p.title}</h2>
        </Link>
        <p className="card-idea">
          {p.recall?.idea ||
            p.abstract.slice(0, 150).replace(/\s+\S*$/, "") + "…"}
        </p>
        <div className="why-block">
          <span className="eyebrow">WHY THIS PAPER</span>
          <p>{r.reason}</p>
        </div>
        <div className="focus-line">
          <span className="eyebrow">LOOK FOR</span>
          <p>{r.focus}</p>
        </div>
        <div className="card-actions">
          <Link
            href={`/papers/${encodeURIComponent(p.id)}`}
            className="text-button"
          >
            Open the notecard
            <ArrowUpRight size={15} />
          </Link>
          <span className="depth">{r.depth}</span>
        </div>
        <details className="feedback">
          <summary>
            Refine this suggestion
            <ChevronDown size={11} />
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
                onClick={() =>
                  act({ action: "feedback", paperId: p.id, value })
                    .then(() => toast("Noted for your next shortlist."))
                    .catch(() => {})
                }
              >
                {label}
              </button>
            ))}
          </div>
        </details>
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
          e.takeaway,
          e.question,
          e.why,
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
        <p>The papers you follow. The things you take away.</p>
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
                <span className="eyebrow">
                  {p.year} · {p.topics[0] || "Research paper"}
                </span>
                <span className="status-label">
                  {e.status === "saved"
                    ? "To read"
                    : e.status === "reading"
                      ? "Reading"
                      : e.status === "archived"
                        ? "Archived"
                        : "Read"}
                </span>
              </div>
              <Diagram paper={p} thumbnail />
              <h2>{p.title}</h2>
              <p>{e.takeaway || p.recall?.idea || p.abstract.slice(0, 170)}</p>
              <div className="library-card-bottom">
                <span>
                  {e.takeaway
                    ? "YOUR TAKEAWAY"
                    : p.recall
                      ? "VISUAL NOTECARD"
                      : "AWAITING A NOTECARD"}
                </span>
                <ArrowUpRight size={16} />
              </div>
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
          <p>Export your library, notes, and notecards.</p>
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
