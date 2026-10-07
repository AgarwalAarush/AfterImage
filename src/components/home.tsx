"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, BookOpen, Compass, RefreshCw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { Entry, Paper, Recommendation } from "@/lib/types";
import { useApp } from "./app-context";
import { PaperFeedback, usePaperFeedback } from "./paper-feedback";
import { paperDisplayTitle, paperSummary } from "./paper-card-copy";
import styles from "./home.module.css";

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
    <div className={`page home ${styles.scope}`}>
      <div className="page-intro">
        <div className="eyebrow intro-kicker">
          <span className="tiny-cross" aria-hidden="true">✳</span> YOUR READING COMPASS
        </div>
        <h1>Follow the thread.</h1>
        <p>
          A few papers worth your attention.
          <br className="mobile-break" /> A place for the ideas that stay.
        </p>
      </div>
      <div className="section-heading shortlist-heading">
        <div className="shortlist-title">
          <h2 tabIndex={-1}>Next reads</h2>
        </div>
        <div className="shortlist-actions">
          <Link className="text-button" href="/direction"><SlidersHorizontal size={14} />Reading direction</Link>
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
      </div>
      {latestRecommendationJob?.status === "failed" && (
        <p className="notice">
          Suggestions could not refresh. Try Refresh suggestions to find another paper.
        </p>
      )}
      <div className="recommendation-grid">
        {recs.map(({ r, p }, index) => (
          <RecommendationCard
            key={p.id}
            paper={p}
            recommendation={r}
            index={index}
          />
        ))}
      </div>
      {!recs.length && (
        <div className="empty panel">
          <Compass size={24} />
          <h2>{active ? "Finding your next papers…" : "Ready for a new thread?"}</h2>
          <p>{active ? "Your saved papers are in your Library. New suggestions will appear here." : state.direction.goal
            ? "Refresh suggestions to find papers beyond your Library."
            : "Add your reading direction to get personal suggestions."}</p>
        </div>
      )}
      <div className="below-grid">
        <section className="return-section">
          <div className="section-heading">
            <div className="recall-heading">
              <h2>Recall</h2>
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
function RecommendationCard({
  paper: p,
  recommendation: r,
  index,
}: {
  paper: Paper;
  recommendation: Recommendation;
  index: number;
}) {
  const { state, act, busy, toast, prepareKit, preparations } = useApp();
  const router = useRouter();
  const preparing = preparations[p.id]?.status === "submitting" || state?.jobs.some(j => j.paperId === p.id && j.type === "generate" && ["queued", "running"].includes(j.status));
  const paperHref = `/papers/${encodeURIComponent(p.id)}`;
  const prepare = () => {
    void prepareKit(p.id);
    router.push(paperHref);
  };
  const refine = usePaperFeedback(p.id);
  return (
    <article className={`paper-card next-read-card ${p.accent}`}>
      <div className="card-top">
        <span className="eyebrow">
          <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
          {r.role}
        </span>
        <div className="card-tools">
          <PaperFeedback paperId={p.id} paperTitle={p.title} saveForLater />
          <button
            aria-label={`Dismiss recommendation: ${p.title}`}
            title="Not for me"
            className="icon-button"
            disabled={busy}
            onClick={() => refine("irrelevant")}
          >
            <X size={16} />
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
          {r.reason || p.recall?.idea || paperSummary(p.abstract)}
        </p>
        {r.focus && <p className="card-reading-focus"><span>Read for</span>{r.focus}</p>}

        <div className="card-actions">
          {p.recall || preparing ? <Link href={paperHref} className="kit-action">
            {p.recall ? <BookOpen size={16} /> : <Sparkles size={16} />}{p.recall ? "Read notecard" : "View preparation"}<ArrowRight size={16} />
          </Link> : <button className="kit-action" disabled={busy} onClick={prepare}><Sparkles size={15} />Prepare reading kit<ArrowRight size={15} /></button>}
        </div>
      </div>
    </article>
  );
}
