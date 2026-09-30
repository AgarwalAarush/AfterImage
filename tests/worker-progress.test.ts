import test from "node:test";
import assert from "node:assert/strict";
import { recordWorkerProgress } from "../src/lib/worker-progress";
import { paperPreparationModel } from "../src/lib/generation-progress";
import { initialState } from "../src/lib/catalog";
import { clientRequest } from "../src/lib/client-request";
import type { Job } from "../src/lib/types";
const at = "2026-09-30T12:00:00.000Z";

test("study repair progress remains visible while the approved notecard can be read", () => {
  const paper = initialState().papers[0]; delete paper.study;
  const job: Job = {id:"study", paperId:paper.id, type:"study", status:"running", attempts:1, createdAt:at, startedAt:at};
  recordWorkerProgress(job, {stage:"study-repairing", attempt:2}, at);
  const model = paperPreparationModel(paper, [job], at, Date.parse(at) + 60000);
  assert.equal(model.readable, true);
  assert.equal(model.status, "running");
  assert.match(model.title, /after review/);
  assert.equal(model.attempt, 2);
  assert.equal(model.workerState, "online");
  assert.equal(paperPreparationModel(paper, [job], at, Date.parse(at) + 180000).workerState, "offline");
});
test("milestones reject arbitrary diagnostics and wrong job stages, and idle heartbeats preserve the stage", () => {
  const job: Job = {id:"g", type:"generate", status:"running", attempts:1, createdAt:at};
  recordWorkerProgress(job, {stage:"private model error"}, at);
  assert.equal(job.stage, undefined);
  recordWorkerProgress(job, {stage:"study-repairing", attempt:2}, at);
  assert.equal(job.stage, undefined);
  recordWorkerProgress(job, {stage:"reviewing"}, at);
  recordWorkerProgress(job, {}, "2026-09-30T12:01:00.000Z");
  assert.equal(job.stage, "reviewing");
  assert.equal(job.stageUpdatedAt, at);
  assert.equal(job.heartbeatAt, "2026-09-30T12:01:00.000Z");
});
test("queued jobs show their actual place and do not infer worker presence from a missing heartbeat", () => {
  const paper=initialState().papers[0]; paper.recall=null;
  const jobs:Job[]=[{id:"ahead",type:"recommend",status:"queued",attempts:0,createdAt:at},{id:"g",paperId:paper.id,type:"generate",status:"queued",attempts:0,createdAt:at}];
  assert.equal(paperPreparationModel(paper,jobs,null,Date.parse(at)).queuePosition,2);
  assert.equal(paperPreparationModel(paper,jobs,null,Date.parse(at)).workerState,"unconfirmed");
  assert.equal(paperPreparationModel(paper,jobs,null,Date.parse(at)).readable,false);
});
test("uncertain client writes are bounded, reported, and never replayed", async () => {
  let calls=0;
  const request=(async (_url: string, init: RequestInit) => {
    calls++; assert.ok(init.signal); throw new TypeError("disconnected");
  }) as typeof fetch;
  await assert.rejects(clientRequest("/api/documents",{method:"POST"},request),/Check whether the change was saved/);
  assert.equal(calls,1);
});
