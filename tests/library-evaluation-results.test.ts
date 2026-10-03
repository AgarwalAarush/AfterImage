import test from "node:test";
import assert from "node:assert/strict";
import { completeEvaluationResult, mergeComponentRetry, type EvaluationResult } from "../scripts/library-evaluation-results";
import { publishedEvaluationKit } from "./fixtures/published-evaluation-kit";

const initialFailure = { owner: "execution", reason: "Recorded component interruption", ledger: [] };
const initial: EvaluationResult = { paper: publishedEvaluationKit().paper as unknown as EvaluationResult["paper"], outcomes: [{ id: "explanation", status: "passed" }, { id: "diagram", status: "failed" }, { id: "quiz", status: "not-run" }], failure: initialFailure, initialFailure };
const originalNonPassed = ["diagram", "quiz"];
const success = (target: string, _revision = 2): EvaluationResult => ({ paper: publishedEvaluationKit().paper as unknown as EvaluationResult["paper"], outcomes: [{ id: target, status: "passed" }] });

test("complete successful preconfigured component retries resolve obsolete aggregate failure but retain initial failure", () => {
 const original = structuredClone(initial);
 const diagram = mergeComponentRetry(original, "diagram", success("diagram"), 0, originalNonPassed);
 assert.equal(completeEvaluationResult(diagram), false, "Remaining quiz prevents aggregate acceptance");
 assert.deepEqual(diagram.failure, initialFailure);
 const final = mergeComponentRetry(diagram, "quiz", success("quiz", 3), 0, originalNonPassed);
 assert.ok(final.outcomes.every(outcome => outcome.status === "passed"));
 assert.equal(completeEvaluationResult(final), true, "Successful complete retries must resolve the obsolete initial execution failure");
 assert.equal(final.failure, undefined);
 assert.deepEqual(final.initialFailure, initialFailure);
 assert.deepEqual(original, initial, "Aggregation must preserve the original result");
});

test("passed original outcomes with terminal execution failure remain failed without recovered component retries", () => {
 const terminal: EvaluationResult = { ...initial, outcomes: [{ id: "explanation", status: "passed" }] };
 assert.equal(completeEvaluationResult(terminal), false);
 assert.deepEqual(mergeComponentRetry(terminal, "explanation", success("explanation"), 0, []), terminal);
 assert.equal(completeEvaluationResult({ ...terminal, outcomes: [] }), false);
});

for (const [name, next, code] of [
 ["missing result", null, 0],
 ["empty outcomes", { ...success("diagram"), outcomes: [] }, 0],
 ["wrong target", success("figure:other"), 0],
 ["wrong paper", { ...success("diagram"), paper: { id: "other" } }, 0],
 ["failed target", { ...success("diagram"), outcomes: [{ id: "diagram", status: "failed" }] }, 0],
 ["not-run target", { ...success("diagram"), outcomes: [{ id: "diagram", status: "not-run" }] }, 0],
 ["partial result", { ...success("diagram"), outcomes: [{ id: "diagram", status: "passed" }, { id: "quiz", status: "not-run" }] }, 0],
 ["terminal retry failure", { ...success("diagram"), failure: { owner: "execution", reason: "Retry interruption" } }, 0],
 ["nonzero completion", success("diagram"), 1],
 ["uncertain completion", success("diagram"), null],
] as const) test(`${name} cannot replace published aggregate progress or resolve initial failure`, () => {
 const current = structuredClone(initial);
 const aggregate = mergeComponentRetry(current, "diagram", next as EvaluationResult | null, code, originalNonPassed);
 assert.deepEqual(aggregate, current);
 assert.equal(completeEvaluationResult(aggregate), false);
 assert.deepEqual(aggregate.initialFailure, initialFailure);
});

test("one successful retry cannot substitute for an unresolved original component", () => {
 const diagram = mergeComponentRetry(initial, "diagram", success("diagram"), 0, originalNonPassed);
 const failedQuiz = mergeComponentRetry(diagram, "quiz", { ...success("quiz"), outcomes: [{ id: "quiz", status: "failed" }] }, 0, originalNonPassed);
 assert.equal(completeEvaluationResult(failedQuiz), false);
 assert.deepEqual(failedQuiz.paper, diagram.paper);
 assert.deepEqual(failedQuiz.outcomes, diagram.outcomes);
 assert.deepEqual(failedQuiz.failure, initialFailure);
});
