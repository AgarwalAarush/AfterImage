"use client";
import { MoreHorizontal } from "lucide-react";
import type { Feedback } from "@/lib/types";
import { useApp } from "./app";
export function usePaperFeedback(paperId: string) {
  const {act,toast} = useApp();
  return (value: Feedback["value"]) => {
    const eventId = crypto.randomUUID();
    void act({action: "feedback",paperId,value,eventId}).then(() => {
      toast(value === "irrelevant" ? "Dismissed. Finding another paper." : value === "later" ? "Saved to your Library." :
        value === "known" ? "Removed from suggestions." : value === "advanced" ? "Looking for a prerequisite paper." : "Noted for your next shortlist.",value === "irrelevant" ? {
          label: "Undo",run: () => {void act({action: "undo-feedback",paperId,eventId}).then(result => toast(result.feedbackUndone ? "Dismissal undone." : "Your newer feedback was kept.")).catch(() => {});},
        } : undefined);
    }).catch(() => {});
  };
}
export function PaperFeedback({paperId,saveForLater = false}: {paperId: string;saveForLater?: boolean}) {
  const {busy} = useApp(), feedback = usePaperFeedback(paperId);
  const items: [Feedback["value"],string][] = [["useful","Useful / More like this"],["irrelevant","Not for me"],
    ["advanced","Too advanced"],["known","Already know it"]];
  if (saveForLater) items.push(["later","Save for later"]);
  return <details className="suggestion-feedback" onKeyDown={event => {
    if (event.key === "Escape") {event.currentTarget.open = false;event.currentTarget.querySelector("summary")?.focus();}
  }} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;}}>
    <summary><MoreHorizontal size={18}/><span className="sr-only">Paper feedback</span></summary>
    <div>{items.map(([value,label]) => <button key={value} disabled={busy} onClick={event => {
      const menu = event.currentTarget.closest("details");if (menu) menu.open = false;feedback(value);
    }}>{label}</button>)}</div>
  </details>;
}
