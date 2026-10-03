import test from "node:test";
import assert from "node:assert/strict";
import { completeEvaluationResult, mergeComponentRetry, type EvaluationResult } from "../scripts/library-evaluation-results";
import { projectPublishedPaper } from "../src/lib/kit";
import { publishedEvaluationKit, publishEvaluationComponent } from "./fixtures/published-evaluation-kit";

const history = { owner: "execution", reason: "The requested component did not finish.", ledger: [] };
function result(paper: unknown, outcomes: EvaluationResult["outcomes"], failure?: unknown): EvaluationResult {
 return { paper: paper as EvaluationResult["paper"], outcomes, ...(failure ? { failure, initialFailure: failure } : {}) };
}

for (const projected of [false, true]) test(`successful explanation retry with ${projected ? "projected" : "retained"} stale quiz cannot accept its old passing outcome`, () => {
 const f = publishedEvaluationKit(), configured = ["explanation"];
 const original = result(structuredClone(f.paper), [{ id: "explanation", status: "failed" }, { id: "diagram", status: "passed" }, { id: "quiz", status: "passed" }], history);
 publishEvaluationComponent(f.paper, f.job, "explanation", { ...f.explanation, idea: "A newly reviewed explanation revision." });
 assert.ok(f.paper.study?.quiz.length, "The private stored quiz remains available as history");
 assert.equal(projectPublishedPaper(f.paper).study, undefined, "Publication must withhold the old dependency");
 const next = result(projected ? projectPublishedPaper(f.paper) : f.paper, [{ id: "explanation", status: "passed" }]);
 const aggregate = mergeComponentRetry(original, "explanation", next, 0, configured);
 assert.equal(completeEvaluationResult(aggregate), false, "A stale dependent quiz must prevent aggregate acceptance");
 assert.equal(aggregate.outcomes.find(o => o.id === "quiz")?.status, "withheld");
 assert.equal(aggregate.outcomes.find(o => o.id === "diagram")?.status, "withheld");
 assert.deepEqual(aggregate.failure, history);
 assert.deepEqual(aggregate.initialFailure, history);
 assert.deepEqual(configured, ["explanation"], "Dependency withholding cannot expand the configured retry list");
});

test("a current ready kit entry without actual quiz content remains unaccepted", () => {
 const f = publishedEvaluationKit(); f.paper.study = undefined;
 assert.equal(completeEvaluationResult(result(f.paper, [{ id: "quiz", status: "passed" }])), false);
});
test("prior reviewed revisions remain accepted while their new attempt is failed", () => {
 const f = publishedEvaluationKit(); for (const component of f.paper.kit!.components) component.state = "failed";
 assert.equal(completeEvaluationResult(result(f.paper, [{ id: "explanation", status: "passed" }, { id: "diagram", status: "passed" }, { id: "quiz", status: "passed" }])), true);
});
test("reviewed legacy projection remains accepted without a manifest migration", () => {
 const f = publishedEvaluationKit(); delete f.paper.kit;
 assert.equal(completeEvaluationResult(result(f.paper, [{ id: "explanation", status: "passed" }, { id: "diagram", status: "passed" }, { id: "quiz", status: "passed" }])), true);
});
test("id-only or malformed-manifest passing claims fail closed", () => {
 assert.equal(completeEvaluationResult(result({ id: "unproven" }, [{ id: "explanation", status: "passed" }])), false);
 const f = publishedEvaluationKit(); f.paper.kit!.components[0].revision = null;
 assert.equal(completeEvaluationResult(result(f.paper, [{ id: "quiz", status: "passed" }])), false);
});
