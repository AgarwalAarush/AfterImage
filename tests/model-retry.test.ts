import test from "node:test";
import assert from "node:assert/strict";
import { retryModelCapacity } from "../worker/model-retry";

test("capacity rejection retries the failed step and retains its eventual result", async () => {
  let calls = 0; const waits: number[] = [];
  const result = await retryModelCapacity(async () => {
    if (++calls < 3) throw new Error("Selected model is at capacity. Please try a different model.");
    return { reviewed: true };
  }, async ms => { waits.push(ms); });
  assert.deepEqual(result, { reviewed: true });
  assert.deepEqual(waits, [20000, 40000]);
});

test("persistent capacity failures are bounded and content failures never retry", async () => {
  let calls = 0;
  await assert.rejects(retryModelCapacity(async () => { calls++; throw new Error("Selected model is at capacity"); }, async () => {}), /capacity/);
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(retryModelCapacity(async () => { calls++; throw new Error("Invalid schema or failed source review"); }, async () => {}), /source review/);
  assert.equal(calls, 1);
});
