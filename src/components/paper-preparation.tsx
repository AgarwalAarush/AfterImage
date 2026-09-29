"use client";

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
  const { act, busy, toast } = useApp();
  const active = model.status === "queued" || model.status === "running";

  return (
    <section
      className={`paper-preparation ${model.status}`}
      aria-live="polite"
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
          <span className="eyebrow">YOUR COMPLETE READING KIT</span>
          <h2>{model.title}</h2>
          <p>{model.detail}</p>
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
                  .then(() => toast("Your complete reading kit is queued."))
                  .catch(() => {})
              }
            >
              <RefreshCw size={15} />
              {model.status === "failed" ? "Try again" : "Prepare paper"}
            </button>
          )}
        </div>
      </div>
      <ol className="paper-preparation-steps" aria-label="Paper preparation progress">
        {model.steps.map((step) => (
          <li className={step.state} key={step.id}>
            <span aria-hidden="true" />
            {step.label}
          </li>
        ))}
      </ol>
      <p className="preparation-footnote">
        Nothing is revealed until every generated part passes review.
      </p>
    </section>
  );
}
