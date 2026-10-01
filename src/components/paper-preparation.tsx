"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import type { PaperPreparationModel } from "@/lib/generation-progress";
import { useApp } from "./app";

export function PaperPreparation({
  paperId,
  model,
}: {
  paperId: string;
  model: PaperPreparationModel;
}) {
  const { act, busy, toast, refresh, refreshing } = useApp();
  const active = model.status === "queued" || model.status === "running";
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const elapsed = model.startedAt ? Math.max(0, Math.floor((now - Date.parse(model.startedAt)) / 1000)) : null;
  const activityAge = model.activityAt ? Math.max(0, Math.floor((now - Date.parse(model.activityAt)) / 1000)) : null;
  const offline = model.workerState === "offline" || (model.status === "running" && activityAge !== null && activityAge > 150);
  const duration = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;


  return (
    <section
      className={`paper-preparation ${model.status}${model.readable ? " readable" : ""}`}
      aria-busy={active}
    >
      <div className={`paper-preparation-main${active ? " has-orb" : ""}`}>
        {active && (
          <div className="preparation-orb">
            <ThinkingOrb
              state={model.orbState}
              size={64}
              speed={1}
              theme="light"
              aria-label={model.title}
            />
          </div>
        )}
        <div className="paper-preparation-copy">
          <span className="eyebrow">{model.readable ? active ? "NOTECARD READY · PREPARATION IN PROGRESS" : "NOTECARD READY · FINISH YOUR STUDY GUIDE" : active ? "PREPARING YOUR READING KIT" : "YOUR READING KIT"}</span>
          <h2 aria-live="polite">{model.title}</h2>
          <p>{model.detail}</p>
          {active && <div className="preparation-activity">
            <span className={`status-dot${offline ? " offline" : ""}`} />
            <strong role="status">{offline ? "Worker hasn’t checked in recently" : model.status === "queued" ? `Queue position ${model.queuePosition || 1}` : model.workerState === "online" ? "Worker connected" : "Waiting for a worker update"}</strong>
            {elapsed !== null && <span>{duration(elapsed)} {model.status === "queued" ? "waiting" : "elapsed"}</span>}
            {activityAge !== null && <span>Last activity {duration(activityAge)} ago</span>}
            {model.attempt && model.attempt > 1 && <span>Revision {model.attempt} of 3</span>}
            <button className="text-button" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={12} />{refreshing ? "Checking…" : "Check status"}</button>
          </div>}
          {active && <p className="preparation-expectation">{offline ? "The job may have paused. Status will recover automatically when the worker reconnects." : "Generation and independent review can take several minutes. You can leave this page; the work continues."}</p>}
          <div className="preparation-package" aria-label="Included when ready">
            <span>Notecard</span>
            <span>Visual guide</span>
            <span>Review questions</span>
          </div>
          {model.retryAction && (
            <button
              className="button primary preparation-action"
              disabled={busy}
              onClick={() =>
                act({ action: model.retryAction, paperId })
                  .then(() => toast("Preparation is queued. Your reviewed content stays available."))
                  .catch(() => {})
              }
            >
              <RefreshCw size={15} />
              {model.status === "failed" ? "Prepare again" : "Prepare reading kit"}
            </button>
          )}
        </div>
      </div>
      {active && <ol className="paper-preparation-steps" aria-label="Paper preparation progress">
        {model.steps.map((step) => (
          <li className={step.state} key={step.id}>
            <span aria-hidden="true" />
            {step.label}
          </li>
        ))}
      </ol>}
      {active && <p className="preparation-footnote">
        {model.readable ? "Read the reviewed notecard below. New visuals and questions appear after their own checks pass." : "Only reviewed content is published. Status updates automatically."}
      </p>}
    </section>
  );
}
