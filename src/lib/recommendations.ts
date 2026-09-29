import { z } from "zod";
import { parsePaperId } from "./identity";
import type { AppState } from "./types";

export const recommendationRunSchema = z.object({
  candidateCount: z.number().int().min(0).max(2000),
  discoveredCount: z.number().int().min(0).max(2000).optional(),
  recentCandidateCount: z.number().int().min(0).max(2000).optional(),
  suggestedLinkCount: z.number().int().min(0).max(30),
  resolvedLinkCount: z.number().int().min(0).max(30),
  unresolvedIds: z.array(z.string().max(40)).max(30),
  searches: z.array(z.object({
    query: z.string().max(160),
    lane: z.enum(["relevance", "recent"]).optional(),
    status: z.enum(["ok", "unavailable"]),
    source: z.enum(["api", "website"]).optional(),
    providers: z.array(z.object({
      provider: z.enum(["arxiv-api", "arxiv-website", "openalex"]),
      status: z.enum(["ok", "unavailable"]),
      resultCount: z.number().int().min(0).max(1000),
      candidateCount: z.number().int().min(0).max(1000),
    })).max(3).optional(),
  })).max(6),
  directionUpdatedAt: z.string().max(40),
});

/** Suggestions are discovery inputs, never evidence that the owner read a paper. */
export function readingContextIds(text: string) {
  const ids = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/(?:www\.)?(?:arxiv\.org\/(?:abs|pdf|html)|alphaxiv\.org\/abs)\/([^\s?"<>\])]+)/gi)) {
    try { ids.add(parsePaperId(match[0].replace(/[.,;:!]+$/, ""))); } catch {}
    if (ids.size >= 30) break;
  }
  return [...ids];
}

/** Enforce exclusions both before ranking and again against current server state. */
export function excludedRecommendations(
  state: Pick<AppState, "entries" | "feedback">,
  now = Date.now(),
) {
  const ids = new Set(Object.values(state.entries)
    .filter(e => ["reading", "read", "archived"].includes(e.status))
    .map(e => e.paperId));
  const latest = new Map<string, AppState["feedback"][number]>();
  for (const feedback of state.feedback) {
    const previous = latest.get(feedback.paperId);
    if (!previous || Date.parse(feedback.at) >= Date.parse(previous.at)) latest.set(feedback.paperId, feedback);
  }
  for (const feedback of latest.values()) {
    if (["known", "irrelevant"].includes(feedback.value) ||
      (feedback.value === "later" && now - Date.parse(feedback.at) < 30 * 86400000)) ids.add(feedback.paperId);
  }
  return ids;
}

/** Reading-state changes refresh suggestions quietly when capacity is available. */
export function shouldRefreshRecommendations(
  state: Pick<AppState, "direction" | "jobs">,
  now = Date.now(),
) {
  return Boolean(
    state.direction.goal.trim() &&
      !state.jobs.some(
        (job) =>
          job.type === "recommend" &&
          ["queued", "running"].includes(job.status),
      ) &&
      state.jobs.filter(
        (job) => now - Date.parse(job.createdAt) < 60 * 60 * 1000,
      ).length < 12,
  );
}
