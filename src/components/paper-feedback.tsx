"use client";
import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import type { Feedback } from "@/lib/types";
import { useApp } from "./app";
import styles from "./paper-feedback.module.css";

export function usePaperFeedback(paperId: string) {
  const {act, toast} = useApp();
  return (value: Feedback["value"]) => {
    const eventId = crypto.randomUUID();
    const focused = document.activeElement as HTMLElement | null;
    const card = focused?.closest(".next-read-card");
    const neighbor = card?.nextElementSibling ?? card?.previousElementSibling;
    const nextFocus = neighbor?.querySelector<HTMLElement>(".card-title") ?? document.querySelector<HTMLElement>(".shortlist-title h2");
    void act({action: "feedback", paperId, value, eventId}).then(() => {
      // A consumed card should not send keyboard users back to the top of the page.
      requestAnimationFrame(() => {
        if (focused && !focused.isConnected && document.activeElement === document.body) nextFocus?.focus();
      });
      toast(value === "irrelevant" ? "Recommendation dismissed." : value === "later" ? "Saved to your Library." :
        value === "known" ? "Marked as already known." : value === "advanced" ? "Noted. We’ll look for a starting point." : "Noted. More papers like this.", value === "irrelevant" ? {
          label: "Undo", run: () => {
            const returnToPaper = Boolean(document.activeElement?.closest(".toast"));
            void act({action: "undo-feedback", paperId, eventId}).then(result => {
              toast(result.feedbackUndone ? "Dismissal undone." : "Your newer feedback was kept.");
              if (returnToPaper) requestAnimationFrame(() => {
                const restored = document.querySelector<HTMLElement>(`a.card-title[href="/papers/${encodeURIComponent(paperId)}"]`);
                (restored ?? document.querySelector<HTMLElement>(".reader-feedback summary, .shortlist-title h2"))?.focus();
              });
            }).catch(() => {});
          },
        } : undefined);
    }).catch(() => {});
  };
}

export function PaperFeedback({paperId, paperTitle, saveForLater = false, compact = true}: {
  paperId: string; paperTitle?: string; saveForLater?: boolean; compact?: boolean;
}) {
  const {busy} = useApp();
  const feedback = usePaperFeedback(paperId);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const items: [Feedback["value"], string, string][] = [
    ["useful", "Useful / More like this", "Strengthen related suggestions"],
    ["irrelevant", "Not for me", "Dismiss and suggest fewer like this"],
    ["advanced", "Too advanced", "Look for a starting point"],
    ["known", "Already know it", "Skip this paper without a dislike"],
  ];
  if (saveForLater) items.push(["later", "Save for later", "Add to your Library"]);
  return <details ref={ref} className={`suggestion-feedback${compact ? "" : " reader-feedback"} ${styles.scope}`} onKeyDown={event => {
    const menu = event.currentTarget;
    if (event.key === "Escape") {
      event.preventDefault(); menu.open = false; menu.querySelector("summary")?.focus();
    } else if (event.target === menu.querySelector("summary") && event.key === "ArrowDown") {
      event.preventDefault(); menu.open = true; menu.querySelector("button")?.focus();
    }
  }} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;}}>
    <summary title="Paper feedback" aria-label={paperTitle ? `Paper feedback for ${paperTitle}` : "Paper feedback"}>
      <MoreHorizontal size={18} aria-hidden="true"/>{!compact && <span>Feedback</span>}
    </summary>
    <div className="paper-feedback-options">{items.map(([value, label, hint]) => <button key={value} type="button" disabled={busy} onClick={() => {
      if (ref.current) {ref.current.open = false; ref.current.querySelector("summary")?.focus();}
      feedback(value);
    }}><span>{label}</span><small>{hint}</small></button>)}</div>
  </details>;
}
