import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { initialState } from "../src/lib/catalog";
import { publicState } from "../src/lib/public-state";
import { queueRecommendationRefill } from "../src/lib/recommendations";
import { paperPreparationModel } from "../src/lib/generation-progress";
import type { Job, Recommendation } from "../src/lib/types";

const at = new Date().toISOString();
const pick = (paperId: string): Recommendation => ({paperId, role: "Next step", reason: "A relevant mechanism.", focus: "The method", depth: "Technical"});
function fixture() {
  const state = initialState();
  state.direction.goal = "Understand conditional compute.";
  state.papers = Array.from({length: 6}, (_, i) => ({...structuredClone(state.papers[0]), id: `2001.0000${i + 1}`, arxivId: `2001.0000${i + 1}`, title: `Test candidate ${i + 1}`, recall: null, scene: null}));
  state.entries = {};
  state.feedback = [];
  state.jobs = [];
  state.recommendations = state.papers.slice(0, 3).map(paper => pick(paper.id));
  return state;
}
let directory: string;
const previous = {NODE_ENV: process.env.NODE_ENV, AFTERIMAGE_STORAGE: process.env.AFTERIMAGE_STORAGE, AFTERIMAGE_SQLITE_PATH: process.env.AFTERIMAGE_SQLITE_PATH, AFTERIMAGE_WORKER_TOKEN: process.env.AFTERIMAGE_WORKER_TOKEN};
let stateRoute: typeof import("../src/app/api/state/route");
let workerRoute: typeof import("../src/app/api/worker/route");
let store: typeof import("../src/lib/store");
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "afterimage-next-reads-test-"));
  Object.assign(process.env, {NODE_ENV: "development"});
  process.env.AFTERIMAGE_STORAGE = "sqlite";
  process.env.AFTERIMAGE_SQLITE_PATH = path.join(directory, "fixture.sqlite");
  process.env.AFTERIMAGE_WORKER_TOKEN = "isolated-test-worker";
  [stateRoute, workerRoute, store] = await Promise.all([import("../src/app/api/state/route"), import("../src/app/api/worker/route"), import("../src/lib/store")]);
});
after(async () => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(directory, {recursive: true, force: true});
});
async function reset(state = fixture()) { await store.mutate(current => Object.assign(current, state)); return state; }
async function post(route: {POST: (request: Request) => Promise<Response>}, body: unknown, worker = false) {
  const response = await route.POST(new Request(`http://localhost/api/${worker ? "worker" : "state"}`, {
    method: "POST", headers: {"Content-Type": "application/json", ...(worker ? {Authorization: "Bearer isolated-test-worker"} : {})}, body: JSON.stringify(body),
  }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

test("preparation atomically saves and advances, and discovery runs before queued generation", async () => {
  const seed = await reset();
  const result = await post(stateRoute, {action: "generate", paperId: seed.papers[0].id});
  assert.equal(result.state.entries[seed.papers[0].id].status, "saved");
  assert.deepEqual(result.state.recommendations.map((rec: Recommendation) => rec.paperId), seed.recommendations.slice(1).map(rec => rec.paperId));
  assert.equal(result.state.jobs.filter((job: Job) => job.type === "recommend").length, 1);
  assert.equal(result.state.jobs.filter((job: Job) => job.type === "generate").length, 1);
  await post(stateRoute, {action: "generate", paperId: seed.papers[0].id});
  const claimed = await post(workerRoute, {action: "claim"}, true);
  assert.equal(claimed.job.type, "recommend");
  assert.equal(claimed.job.recommendationMode, "refill");
  assert.equal(claimed.recommendations.length, 2);
  assert.equal((await store.snapshot()).data.jobs.length, 2);
});

test("bookmarking and save-for-later consume suggestions without generating a kit", async () => {
  for (const action of [{action: "save"}, {action: "feedback", value: "later"}]) {
    const seed = await reset();
    const result = await post(stateRoute, {...action, paperId: seed.papers[0].id});
    assert.equal(result.state.entries[seed.papers[0].id].status, "saved");
    assert.equal(result.state.recommendations.length, 2);
    assert.deepEqual(result.state.jobs.map((job: Job) => job.type), ["recommend"]);
  }
});

test("dismissal persists negative feedback, creates no Library entry, and fills only vacant slots", async () => {
  const seed = await reset();
  const result = await post(stateRoute, {action: "feedback", paperId: seed.papers[0].id, value: "irrelevant"});
  assert.deepEqual(result.state.entries, {});
  assert.equal(result.state.feedback[0].value, "irrelevant");
  const claim = await post(workerRoute, {action: "claim"}, true);
  await post(workerRoute, {action: "complete", jobId: claim.job.id, leaseToken: claim.job.leaseToken,
    result: {recommendations: seed.papers.slice(3).map(paper => pick(paper.id))}}, true);
  const updated = (await store.snapshot()).data;
  assert.deepEqual(updated.recommendations.map(rec => rec.paperId), [seed.papers[1].id, seed.papers[2].id, seed.papers[3].id]);
  assert.equal(updated.jobs.filter(job => job.status === "queued").length, 0);
});

test("in-flight saves and dismissals cannot be resurrected and coalesce into one follow-up", async () => {
  const seed = await reset();
  await post(stateRoute, {action: "recommend"});
  const claim = await post(workerRoute, {action: "claim"}, true);
  await post(stateRoute, {action: "save", paperId: seed.papers[0].id});
  await post(stateRoute, {action: "feedback", paperId: seed.papers[1].id, value: "irrelevant"});
  await post(workerRoute, {action: "complete", jobId: claim.job.id, leaseToken: claim.job.leaseToken,
    result: {recommendations: seed.recommendations}}, true);
  const updated = (await store.snapshot()).data;
  assert.deepEqual(updated.recommendations.map(rec => rec.paperId), [seed.papers[2].id]);
  assert.equal(updated.jobs.filter(job => job.type === "recommend" && job.status === "queued").length, 1);
  assert.equal(updated.jobs.filter(job => job.status === "failed").length, 0);
  const claim2 = await post(workerRoute, {action: "claim"}, true);
  await post(workerRoute, {action: "complete", jobId: claim2.job.id, leaseToken: claim2.job.leaseToken,
    result: {recommendations: seed.papers.slice(3).map(paper => pick(paper.id))}}, true);
  assert.equal((await store.snapshot()).data.recommendations.length, 3);
  assert.equal((await store.snapshot()).data.jobs.length, 2);
});

test("explicit refresh replaces the shortlist while underfilled results do not loop", async () => {
  const seed = await reset();
  await post(stateRoute, {action: "recommend"});
  const claim = await post(workerRoute, {action: "claim"}, true);
  await post(workerRoute, {action: "complete", jobId: claim.job.id, leaseToken: claim.job.leaseToken,
    result: {recommendations: [pick(seed.papers[3].id)]}}, true);
  const updated = (await store.snapshot()).data;
  assert.deepEqual(updated.recommendations.map(rec => rec.paperId), [seed.papers[3].id]);
  assert.equal(updated.jobs.length, 1);
});

test("full refresh and exports filter old saved picks without rewriting stored data or exposing scheduling metadata", () => {
  const state = fixture();
  const id = state.papers[0].id;
  state.entries[id] = {paperId: id, status: "saved", savedAt: at, updatedAt: at};
  state.jobs = [{id: "r", type: "recommend", status: "running", attempts: 1, createdAt: at, recommendationMode: "refill", recommendationRefillRequested: true}];
  for (const full of [false, true]) {
    const published = publicState(state, full);
    assert.equal(published.recommendations.length, 2);
    assert.equal(published.jobs[0].recommendationMode, undefined);
    assert.equal(published.jobs[0].recommendationRefillRequested, undefined);
  }
  assert.equal(state.recommendations.length, 3);
});

test("refills respect hourly capacity, missing direction, and current running work", () => {
  const state = fixture();
  state.jobs = Array.from({length: 12}, (_, i) => ({id: String(i), type: "generate", status: "complete", createdAt: at, attempts: 1}));
  queueRecommendationRefill(state, at, () => "new");
  assert.equal(state.jobs.length, 12);
  state.jobs = [];
  state.direction.goal = "";
  queueRecommendationRefill(state, at, () => "new");
  assert.equal(state.jobs.length, 0);
});

test("preparation queue positions match recommendation priority rather than insertion order", () => {
  const state = fixture();
  const jobs: Job[] = [{id: "g", type: "generate", paperId: state.papers[0].id, status: "queued", createdAt: at, attempts: 0},
    {id: "r", type: "recommend", status: "queued", createdAt: at, attempts: 0}];
  assert.equal(paperPreparationModel(state.papers[0], jobs).queuePosition, 2);
});
