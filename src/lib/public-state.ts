import type { AppState } from "./types";
import { excludedRecommendations } from "./recommendations";

/** Source excerpts are for the worker and full export, not every browser refresh. */
export function publicState(s: AppState, includeExcerpts = false): AppState {
  const excluded = excludedRecommendations(s);
  return {
    ...s,
    assistantRequests: undefined,
    recommendations: s.recommendations.filter(rec => !excluded.has(rec.paperId)),
    papers: s.papers.map(({generationError, ...p}) => ({
      ...p,
      sources: includeExcerpts ? p.sources : p.sources.map(source => ({...source, excerpt: ""})),
    })),
    jobs: s.jobs.map(({leaseToken, leaseUntil, error, recommendationMode, recommendationRefillRequested, ...job}) => ({
      ...job,
      heartbeatAt: job.heartbeatAt || (job.status === "running" && leaseUntil && Number.isFinite(Date.parse(leaseUntil))
        ? new Date(Date.parse(leaseUntil) - 15 * 60000).toISOString() : undefined),
    })),
  };
}
