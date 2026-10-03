"use client";

import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import type { PaperPreparationModel } from "@/lib/generation-progress";
import { useApp } from "./app";

const duration = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export function PaperPreparation({ paperId, model }: { paperId: string; model: PaperPreparationModel }) {
  const { prepareKit, busy, refresh, refreshing } = useApp();
  const active = ["submitting", "queued", "running"].includes(model.status);
  const confirmed = model.status === "queued" || model.status === "running";
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const elapsed = model.startedAt ? Math.max(0, Math.floor((now - Date.parse(model.startedAt)) / 1000)) : null;
  const activityAge = model.activityAt ? Math.max(0, Math.floor((now - Date.parse(model.activityAt)) / 1000)) : null;
  const offline = model.workerState === "offline" || (model.status === "running" && activityAge !== null && activityAge > 150);
  const status = model.status === "submitting" ? "Confirming request"
    : offline ? "Waiting for worker"
    : model.status === "queued" ? model.queuePosition ? `Queue position ${model.queuePosition}` : "Waiting to begin"
    : model.workerState === "online" ? "Worker connected" : "Waiting for an update";

  return (
    <section className={`paper-preparation ${model.status}${model.readable ? " readable" : ""}`} aria-label="Reading kit preparation">
      <div className="paper-preparation-main">
        <div className="paper-preparation-copy">
          <h2 aria-live="polite">{model.title}</h2>
          <p>{model.detail}</p>
        </div>
        {(active || model.status === "unconfirmed") && <div className="preparation-activity">
          {active && <>
            <strong role="status"><span className={`status-dot${offline ? " offline" : ""}`} />{status}</strong>
            <span className="preparation-timing">
              {elapsed !== null && <span>{duration(elapsed)} {model.status === "queued" ? "waiting" : "elapsed"}</span>}
              {model.status === "running" && activityAge !== null && <span>Activity {duration(activityAge)} ago</span>}
              {model.attempt && model.attempt > 1 && <span>Revision {model.attempt} of 3</span>}
            </span>
          </>}
          {model.status !== "submitting" && <button className="text-button" disabled={refreshing || busy} onClick={() => void refresh()}>
            <RefreshCw size={13} />{refreshing ? "Checking…" : "Check status"}
          </button>}
        </div>}
      </div>
      {active && model.steps.length > 0 && <ol className="paper-preparation-steps" aria-label="Paper preparation stages">
        {model.steps.map(step => (
          <li className={step.state} key={step.id} aria-current={step.state === "active" && model.status === "running" ? "step" : undefined}>
            <span className="preparation-step-marker" aria-hidden="true">{step.state === "complete" && <Check size={13} />}</span>
            <span>{step.label}</span>
            <span className="sr-only">{step.state === "complete" ? "Complete" : step.state === "active" && model.status === "running" ? "In progress" : "Waiting"}</span>
          </li>
        ))}
      </ol>}
      {confirmed && <p className="preparation-footnote">{offline
        ? "Preparation will resume when the worker reconnects. This page updates automatically."
        : model.readable
          ? "Read your reviewed notecard below. Visuals and questions appear after review."
          : "This can take several minutes. You can leave this page; preparation continues and updates automatically."}</p>}
      {model.retryComponents?.map(component => <button key={component.id} className="text-button preparation-action" disabled={busy} onClick={() => void prepareKit(paperId, "component", component.id)}><RefreshCw size={13} />Retry {component.label.toLowerCase()}</button>)}
      {model.retryAction && <button className="button primary preparation-action" disabled={busy} onClick={() => void prepareKit(paperId, model.retryAction!)}>
        <RefreshCw size={15} />{model.status === "failed" ? "Prepare again" : "Prepare reading kit"}
      </button>}
    </section>
  );
}
