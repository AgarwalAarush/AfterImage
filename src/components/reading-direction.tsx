"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, LogOut } from "lucide-react";
import type { AppState } from "@/lib/types";
import { readLibrary } from "@/lib/library-client";
import { download } from "@/lib/download";
import { useApp } from "./app-context";
import { InterestControls } from "./reading-interests";
import styles from "./reading-direction.module.css";

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
  const draftRevision = useRef(0);
  const markDirty = () => {draftRevision.current += 1;setDirty(true);};
  const job = s.jobs.find(
    (j) => j.type === "recommend" && ["queued", "running"].includes(j.status),
  );
  async function save(generate = false) {
    const submittedRevision = draftRevision.current;
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
      if (draftRevision.current === submittedRevision) setDirty(false);
      if (draftRevision.current !== submittedRevision) {
        toast("Direction saved. Your newer edits still need saving.");
        return;
      }
      if (generate) {
        await act({ action: "recommend" });
        if (draftRevision.current !== submittedRevision) {
          toast("Suggestions queued. Your newer edits still need saving.");
          return;
        }
        router.push("/");
      } else toast("Your direction is saved.");
    } catch {}
  }
  return (
    <div className={`page direction-page ${styles.scope}`}>
      <div className="page-intro compact">
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
          <header className="direction-form-heading"><h2>Research direction</h2><span>{dirty ? "Unsaved changes" : s.direction.goal ? "Saved direction" : "Not saved yet"}</span></header>
          <label>
            Your research background
            <textarea
              maxLength={3000}
              rows={3}
              value={background}
              onChange={(e) => { setBackground(e.target.value); markDirty(); }}
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
                markDirty();
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
                markDirty();
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
                markDirty();
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
              onChange={(e) => { setReadingContext(e.target.value); markDirty(); }}
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
        <aside className="direction-aside">
          <InterestControls />
          <section className="direction-help" aria-labelledby="direction-help-heading">
          <h2 id="direction-help-heading">How your next reads work</h2>
          <p>Your direction and paper feedback shape each shortlist. Every suggestion includes a reason and a reading focus.</p>
          <p>Save, prepare or dismiss a paper to make room for another. Refresh suggestions replaces the whole shortlist.</p>
          <div className="worker-status">
            <span
              className={`status-dot ${s.workerSeenAt && Date.now() - Date.parse(s.workerSeenAt) < 180000 ? "online" : ""}`}
            />
            {s.workerSeenAt && Date.now() - Date.parse(s.workerSeenAt) < 180000
              ? "Your research worker is connected."
              : "Suggestions and reading kits are queued until your research worker connects."}
          </div>
          </section>
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
