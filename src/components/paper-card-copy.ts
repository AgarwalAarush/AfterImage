import type { Paper } from "@/lib/types";

export function paperDisplayTitle(title: string) {
  const prefix = title.split(":", 1)[0].trim();
  return title.includes(":") && prefix.length <= 36 ? prefix : title;
}
export function notecardStatus(paper: Paper) {
  if (paper.recall) return "Notecard ready";
  if (paper.generationStatus === "queued") return "Queued for preparation";
  if (paper.generationStatus === "running") return {
    sources: "Gathering evidence", planning: "Planning the explanation",
    drafting: "Composing notecard", reviewing: "Reviewing notecard",
  }[paper.generationStep || "sources"];
  return paper.generationStatus === "failed" ? "Prepare again" : "Paper saved";
}
export function paperSummary(abstract: string) {
  const text = abstract.replace(/\s+/g, " ").trim();
  if (text.length <= 280) return text;
  const end = text.slice(0, 280).search(/[.!?](?:\s|$)/);
  return end >= 80 ? text.slice(0, end + 1) : text.slice(0, 277).replace(/\s+\S*$/, "") + "…";
}
