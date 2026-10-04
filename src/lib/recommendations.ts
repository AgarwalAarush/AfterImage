import { ensurePreferences, latestRatings, interestEligible } from "./preferences";
import { z } from "zod";
import { parsePaperId } from "./identity";
import type { AppState, Job, Recommendation } from "./types";

export const recommendationReceiptSchema = z.object({
  policy: z.literal("preferences-v1"), profileRevision: z.number().int().nonnegative(),
  preferenceInputs: z.array(z.object({id: z.string().max(60),strength: z.enum(["stronger","normal","less","off"])})).max(32),
  learningEnabled: z.boolean(),
  signals: z.array(z.object({paperId:z.string().max(40),signal:z.number().min(-0.5).max(4),metadataDigest:z.string().regex(/^[a-f0-9]{64}$/).nullable()})).max(2000),
  ranking: z.array(z.object({paperId: z.string().max(40),interestId: z.string().max(60).optional(),interestEvidence: z.array(z.string().min(12).max(800)).max(3).optional(),metadataDigest: z.string().regex(/^[a-f0-9]{64}$/),
    relevance: z.number().min(0).max(1),nextStep: z.number().min(0).max(1),
    citationCount: z.number().int().nonnegative().nullable(),normalizedPercentile: z.number().min(0).max(1).nullable(),
    openAlexId: z.string().max(160).nullable(),verifiedAt: z.string().datetime().nullable(),
    popularity: z.number().min(0).max(1).nullable(),adjustment: z.number().min(-0.05).max(0.05),score: z.number(),
  })).max(12),
  grounding: z.array(z.object({paperId: z.string().max(40),metadataDigest: z.string().regex(/^[a-f0-9]{64}$/),
    identity: z.boolean(),reason: z.boolean(),focus: z.boolean(),interest: z.boolean().optional(),respectsDisabledInterests: z.boolean().optional(),attempt: z.number().int().min(1).max(2),
  })).max(24),
});
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
  state: Pick<AppState, "entries" | "feedback"> & Pick<Partial<AppState>, "preferences">,
  now = Date.now(),
) {
  // Next reads is discovery, so every Library entry has already been chosen.
  const ids = new Set(Object.values(state.entries).map(e => e.paperId));
  const latest = new Map<string, AppState["feedback"][number]>();
  for (const feedback of state.feedback) {
    if (feedback.undoneAt) continue;
    const previous = latest.get(feedback.paperId);
    if (!previous || Date.parse(feedback.at) >= Date.parse(previous.at)) latest.set(feedback.paperId, feedback);
  }
  if (state.preferences) for (const e of latestRatings(state.preferences).values())
    latest.set(e.paperId, {paperId: e.paperId, value: e.value!, at: e.at});
  for (const feedback of latest.values()) {
    if (["known", "irrelevant", "advanced"].includes(feedback.value) ||
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

/** Queue one refill, coalescing actions while a worker is choosing replacements. */
export function queueRecommendationRefill(state: AppState, now: string, id: () => string) {
  const active = state.jobs.find(job => job.type === "recommend" && ["queued", "running"].includes(job.status));
  if (active) {
    if (active.status === "running") active.recommendationRefillRequested = true;
    return;
  }
  if (!shouldRefreshRecommendations(state, Date.parse(now))) return;
  state.jobs.push({id: id(), type: "recommend", status: "queued", createdAt: now, attempts: 0, recommendationMode: "refill"});
  state.jobs = state.jobs.slice(-100);
}

export function eligibleRecommendation(state: AppState, rec: Recommendation) {
  const profile = ensurePreferences(state);
  const assignment = state.recommendationInterestAssignments?.[rec.paperId];
  if (assignment && assignment !== "research-direction" && !profile.interests.some(i => i.id === assignment && i.strength !== "off")) return false;
  return interestEligible(profile,profile.features[rec.paperId]);
}
/** Remove consumed picks in the same write that saves or dismisses the paper. */
export function advanceRecommendations(state: AppState, now: string, id: () => string) {
  const excluded = excludedRecommendations(state, Date.parse(now));
  const remaining = state.recommendations.filter(rec => !excluded.has(rec.paperId) && eligibleRecommendation(state,rec));
  if (remaining.length === state.recommendations.length) return;
  state.recommendations = remaining;
  queueRecommendationRefill(state, now, id);
}

/** Recheck live state on publication: a late save/dismissal must never reappear. */
export function publishRecommendations(state: AppState, picks: Recommendation[], job: Job, now: string, id: () => string) {
  const excluded = excludedRecommendations(state, Date.parse(now));
  if (job.preferenceRevision !== undefined && job.preferenceRevision !== ensurePreferences(state).revision) {
    state.recommendations = state.recommendations.filter(r => !excluded.has(r.paperId) && eligibleRecommendation(state,r));
    job.status = "complete";
    delete job.recommendationRefillRequested;
    queueRecommendationRefill(state, now, id);
    return false;
  }
  const retained = job.recommendationMode === "refill" ? state.recommendations : [];
  const seen = new Set<string>();
  state.recommendations = [...retained, ...picks].filter(rec => {
    if (excluded.has(rec.paperId) || !eligibleRecommendation(state,rec) || seen.has(rec.paperId)) return false;
    seen.add(rec.paperId);
    return true;
  }).slice(0, 3);
  const needsRefill = state.recommendations.length < 3 &&
    (job.recommendationRefillRequested || picks.some(rec => excluded.has(rec.paperId)));
  job.status = "complete";
  delete job.recommendationRefillRequested;
  if (needsRefill) queueRecommendationRefill(state, now, id);
  return true;
}

/** Replacements run before queued long-form preparation; running work is untouched. */
export function nextQueuedJob(jobs: Job[], supportsInterests = true) {
  const queued = jobs.filter(job => job.status === "queued" && (supportsInterests || job.type !== "interests"));
  return queued.find(job => job.type === "recommend") || queued.find(job => job.type === "interests") || queued[0];
}
