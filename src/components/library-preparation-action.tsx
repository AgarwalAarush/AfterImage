"use client";

import { RefreshCw, Clock3 } from "lucide-react";
import type { Paper } from "@/lib/types";
import { paperPreparationModel, withPreparationRequest } from "@/lib/generation-progress";
import { useApp } from "./app";

export function LibraryPreparationAction({ paper }: { paper: Paper }) {
  const { state, prepareKit, preparations, busy, refresh, refreshing } = useApp();
  if (!state) return null;
  const model = withPreparationRequest(paperPreparationModel(paper, state.jobs, state.workerSeenAt), preparations[paper.id]);
  const active = ["submitting", "queued", "running"].includes(model.status);
  const unconfirmed = model.status === "unconfirmed";
  if (!model.retryAction && !active && !unconfirmed) return null;
  const label = model.status === "submitting" ? "Starting…"
    : model.status === "queued" ? "Queued"
    : model.status === "running" ? "Preparing…"
    : unconfirmed ? refreshing ? "Checking…" : "Check status"
    : model.status === "failed" ? "Prepare again" : "Prepare reading kit";

  return (
    <div className="library-preparation-action" data-visible={model.status === "submitting" || unconfirmed} aria-live="polite">
      <button
        type="button"
        className="button"
        aria-label={`${label}: ${paper.title}`}
        disabled={busy || active || (unconfirmed && refreshing)}
        onClick={() => {
          if (unconfirmed) void refresh();
          else if (model.retryAction) void prepareKit(paper.id, model.retryAction);
        }}
      >
        {active ? <Clock3 size={15} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
        {label}
      </button>
    </div>
  );
}
