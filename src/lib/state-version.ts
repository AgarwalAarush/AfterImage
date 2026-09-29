import type { AppState, Entry } from "./types";

/** Remove the retired post-reading capture fields from legacy JSON state. */
export function currentState(value: unknown): AppState {
  const state = value as Omit<AppState, "schemaVersion" | "entries"> & {
    schemaVersion?: number;
    entries?: Record<string, Entry & Record<string, unknown>>;
  };
  const entries = Object.fromEntries(
    Object.entries(state.entries || {}).map(([id, entry]) => {
      const {
        takeaway: _takeaway,
        why: _why,
        question: _question,
        nextAction: _nextAction,
        ...readingEntry
      } = entry;
      return [id, readingEntry as Entry];
    }),
  );
  return { ...state, schemaVersion: 2, entries } as AppState;
}
