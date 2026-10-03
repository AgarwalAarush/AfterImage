import { preferenceSummary } from "./preferences";
import type { AppState } from "./types";
import { excludedRecommendations, eligibleRecommendation } from "./recommendations";

/** Source excerpts are for the worker and full export, not every browser refresh. */
export function publicState(s: AppState, includeExcerpts = false): AppState {
  const excluded = excludedRecommendations(s);
  return {
    ...s,
    assistantRequests: undefined,
    preferences: undefined,
    recommendationReceipts: undefined,
    recommendationSearchCycle: undefined,
    recommendationInterestAssignments: undefined,
    preferenceSummary: preferenceSummary(s),
    recommendations: s.recommendations.filter(rec => !excluded.has(rec.paperId) && eligibleRecommendation(s,rec)),
    papers: s.papers.map(({generationError, ...p}) => ({
      ...p,
      sources: includeExcerpts ? p.sources : p.sources.map(source => ({...source, excerpt: ""})),
    })),
    jobs: s.jobs.map(({leaseToken, leaseUntil, error, recommendationMode, recommendationRefillRequested, preferenceRevision, interestEvidenceFingerprint, interestFollowup, searchCycle, ...job}) => ({
      ...job,
      heartbeatAt: job.heartbeatAt || (job.status === "running" && leaseUntil && Number.isFinite(Date.parse(leaseUntil))
        ? new Date(Date.parse(leaseUntil) - 15 * 60000).toISOString() : undefined),
    })),
  };
}
