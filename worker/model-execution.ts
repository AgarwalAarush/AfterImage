export type InvocationFacts = { kind: "timeout" | "spawn" | "nonzero-exit" | "schema" | "unknown"; attempt: number; exitCode?: number | null; signal?: string | null; code?: string; rejection?: "capacity" | "overloaded" };
class InvocationFailure extends Error {
  constructor(public facts: InvocationFacts) {
    super(facts.rejection === "capacity" ? "Selected model is at capacity." : facts.rejection === "overloaded" ? "Service is overloaded." : "Model step did not complete.");
  }
}
/** Only observed, bounded process facts cross the private diagnostic boundary. */
export function invocationFailure(facts: InvocationFacts, stderr = ""): Error {
  const rejection = /selected model is at capacity/i.test(stderr) ? "capacity" : /service (?:is )?overloaded/i.test(stderr) ? "overloaded" : undefined;
  return new InvocationFailure({ kind: facts.kind, attempt: facts.attempt,
    ...(facts.exitCode === null || Number.isInteger(facts.exitCode) ? { exitCode: facts.exitCode } : {}),
    ...(facts.signal === null || typeof facts.signal === "string" && /^SIG[A-Z0-9]{1,12}$/.test(facts.signal) ? { signal: facts.signal } : {}),
    ...(typeof facts.code === "string" && /^[A-Z0-9_]{1,24}$/.test(facts.code) ? { code: facts.code } : {}),
    ...(rejection ? { rejection } : {}) });
}
export function executionFacts(error: unknown, attempt: number): InvocationFacts {
  return error instanceof InvocationFailure ? { ...error.facts } : { kind: "unknown", attempt };
}
