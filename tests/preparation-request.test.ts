import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/lib/catalog";
import { paperPreparationModel, withPreparationRequest } from "../src/lib/generation-progress";

test("a pending request shows feedback without inventing a saved entry, queue position, or worker activity", () => {
  const state = initialState();
  const paper = state.papers[0];
  paper.recall = null;
  const before = structuredClone(state);
  const model = withPreparationRequest(paperPreparationModel(paper, state.jobs), {status: "submitting", startedAt: new Date().toISOString()});
  assert.equal(model.status, "submitting");
  assert.match(model.title, /Starting preparation/);
  assert.equal(model.queuePosition, undefined);
  assert.equal(model.workerState, undefined);
  assert.equal(model.retryAction, null);
  assert.ok(model.steps.every(step => step.state === "upcoming"));
  assert.deepEqual(state, before);
});

test("uncertain submission needs a status read before retry; confirmed jobs replace the uncertainty", () => {
  const paper = initialState().papers[0];
  paper.recall = null;
  const request = {status: "unconfirmed" as const, startedAt: new Date().toISOString()};
  const model = withPreparationRequest(paperPreparationModel(paper, []), request);
  assert.equal(model.status, "unconfirmed");
  assert.equal(model.retryAction, null);
  const confirmed = withPreparationRequest(paperPreparationModel(paper, [{id: "g", type: "generate", paperId: paper.id, status: "queued", attempts: 0, createdAt: request.startedAt}]), request);
  assert.equal(confirmed.status, "queued");
  assert.equal(confirmed.queuePosition, 1);
});

test("reviewed notecards stay readable when requesting the remaining study guide", () => {
  const paper = initialState().papers[0];
  const model = withPreparationRequest(paperPreparationModel(paper, []), {status: "submitting", startedAt: new Date().toISOString()});
  assert.equal(model.readable, true);
});
