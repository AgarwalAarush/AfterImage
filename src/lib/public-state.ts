import type { AppState } from "./types";

/** Source excerpts are for the worker and full export, not every browser refresh. */
export function publicState(s: AppState, includeExcerpts = false): AppState {
  return {
    ...s,
    assistantRequests: undefined,
    papers: s.papers.map(({generationError, ...p}) => ({
      ...p,
      sources: includeExcerpts ? p.sources : p.sources.map(source => ({...source, excerpt: ""})),
    })),
    jobs: s.jobs.map(({leaseToken, leaseUntil, error, ...job}) => ({
      ...job,
      heartbeatAt: job.heartbeatAt || (job.status === "running" && leaseUntil && Number.isFinite(Date.parse(leaseUntil))
        ? new Date(Date.parse(leaseUntil) - 15 * 60000).toISOString() : undefined),
    })),
  };
}
