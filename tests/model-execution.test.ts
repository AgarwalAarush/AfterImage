import test from "node:test";
import assert from "node:assert/strict";
import { invocationFailure, executionFacts } from "../worker/model-execution";
import { retryModelCapacity } from "../worker/model-retry";

test("private invocation facts distinguish timeout, spawn, process exit and schema without raw text", () => {
  assert.deepEqual(executionFacts(invocationFailure({ kind: "timeout", attempt: 1, exitCode: null, signal: "SIGTERM" }), 1), { kind: "timeout", attempt: 1, exitCode: null, signal: "SIGTERM" });
  const spawned = invocationFailure({ kind: "spawn", attempt: 1, code: "ENOENT" }, "Secret URL https://private.invalid/?token=secret");
  assert.deepEqual(executionFacts(spawned, 1), { kind: "spawn", attempt: 1, code: "ENOENT" });
  assert.deepEqual(executionFacts(invocationFailure({ kind: "nonzero-exit", attempt: 2, exitCode: 17, signal: null }), 2), { kind: "nonzero-exit", attempt: 2, exitCode: 17, signal: null });
  assert.deepEqual(executionFacts(invocationFailure({ kind: "schema", attempt: 1, exitCode: 0, signal: null }), 1), { kind: "schema", attempt: 1, exitCode: 0, signal: null });
  assert.ok(!JSON.stringify(executionFacts(spawned, 1)).includes("secret"));
  assert.deepEqual(executionFacts(Error("Private body and credential"), 3), { kind: "unknown", attempt: 3 });
});

test("capacity retry preserves the observed final attempt without exposing stderr", async () => {
  let attempt = 0;
  await assert.rejects(retryModelCapacity(async () => { attempt++; throw invocationFailure({ kind: "nonzero-exit", attempt, exitCode: 1, signal: null }, "The selected model is at capacity. Private unrelated text."); }, async () => {}), error => {
    assert.deepEqual(executionFacts(error, attempt), { kind: "nonzero-exit", attempt: 3, exitCode: 1, signal: null, rejection: "capacity" });
    assert.ok(!String(error).includes("Private")); return true;
  });
  assert.equal(attempt, 3);
});

test("timeout and other process failures never receive capacity retries", async () => {
  for (const kind of ["timeout", "spawn", "nonzero-exit"] as const) {
    let calls = 0;
    await assert.rejects(retryModelCapacity(async () => { calls++; throw invocationFailure({ kind, attempt: calls, exitCode: 1, signal: null }); }, async () => {}));
    assert.equal(calls, 1);
  }
});
