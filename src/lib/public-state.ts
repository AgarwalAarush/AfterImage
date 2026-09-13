import type { AppState } from "./types";

/** Source excerpts are for the worker and full export, not every browser refresh. */
export function publicState(s: AppState, includeExcerpts = false): AppState {
  return {
    ...s,
    assistantRequests: undefined,
    papers: includeExcerpts ? s.papers : s.papers.map(p => ({
      ...p,
      sources: p.sources.map(source => ({...source, excerpt: ""})),
    })),
    jobs: s.jobs.map(({leaseToken, ...job}) => job),
  };
}
