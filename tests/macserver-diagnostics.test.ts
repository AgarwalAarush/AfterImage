import assert from "node:assert/strict";
import test from "node:test";
import { macserverRequest } from "../src/lib/macserver-client";

test("storage diagnostics identify upstream failures without exposing private data or retrying writes", async t => {
  const prior = {url: process.env.AFTERIMAGE_BACKEND_URL, token: process.env.AFTERIMAGE_BACKEND_TOKEN};
  process.env.AFTERIMAGE_BACKEND_URL = "https://private-bridge.example";
  process.env.AFTERIMAGE_BACKEND_TOKEN = "private-test-credential-with-at-least-32-bytes";
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  t.mock.method(console, "warn", (...args: unknown[]) => { logs.push(args); });
  try {
    const request = t.mock.method(globalThis, "fetch", async () => new Response("private database detail", {status: 401}));
    await assert.rejects(macserverRequest({action: "snapshot"}), /temporarily unavailable/);
    assert.equal(request.mock.callCount(), 1);
    assert.equal((logs[0][1] as {status: number}).status, 401);
    assert.equal((logs[0][1] as {phase: string}).phase, "response");

    request.mock.mockImplementation(async () => { throw new TypeError("private connection message", {cause: {code: "ECONNRESET", errors: [{code: "ETIMEDOUT"}, {code: "private credential"}]}}); });
    await assert.rejects(macserverRequest({action: "compareAndSwap", version: 1, data: {private: "private library data"}}), /couldn't confirm/);
    assert.equal(request.mock.callCount(), 2);
    assert.deepEqual((logs[1][1] as {codes: string[]}).codes, ["ECONNRESET", "ETIMEDOUT"]);
    assert.equal((logs[1][1] as {phase: string}).phase, "request");

    request.mock.mockImplementation(async () => new Response("private malformed response", {status: 200}));
    await assert.rejects(macserverRequest({action: "status"}), /temporarily unavailable/);
    assert.equal((logs[2][1] as {errorName: string}).errorName, "SyntaxError");

    request.mock.mockImplementation(async () => new Response("private duplicate bytes", {status: 409}));
    await assert.rejects(macserverRequest({action: "documentSave", filename: "private.md", content: "private bytes"}), /already in Documents/);
    assert.equal(logs.length, 3);
    assert.ok(!JSON.stringify(logs).includes("private"));

    const beforeRetry = request.mock.callCount();
    let readAttempts = 0;
    request.mock.mockImplementation(async () => {
      if (readAttempts++ === 0) throw new TypeError("private message", {cause: {code: "ECONNRESET"}});
      return Response.json({version: 2});
    });
    assert.deepEqual(await macserverRequest({action: "status"}), {version: 2});
    assert.equal(request.mock.callCount() - beforeRetry, 2);
    assert.equal((logs[3][1] as {retry: boolean}).retry, true);
    const first = request.mock.calls[beforeRetry].arguments[1] as RequestInit;
    const second = request.mock.calls[beforeRetry + 1].arguments[1] as RequestInit;
    assert.notEqual(new Headers(first.headers).get("x-afterimage-nonce"), new Headers(second.headers).get("x-afterimage-nonce"));

    request.mock.mockImplementation(async () => new Response("private unavailable response", {status: 503}));
    const beforeExhaustion = request.mock.callCount();
    await assert.rejects(macserverRequest({action: "snapshot"}), /temporarily unavailable/);
    assert.equal(request.mock.callCount() - beforeExhaustion, 2);
    const beforeHeartbeat = request.mock.callCount();
    await assert.rejects(macserverRequest({action: "touchWorkerSeenAt", now: new Date().toISOString()}), /couldn't confirm/);
    assert.equal(request.mock.callCount() - beforeHeartbeat, 1);
    assert.ok(!JSON.stringify(logs).includes("private"));
  } finally {
    if (prior.url === undefined) delete process.env.AFTERIMAGE_BACKEND_URL;
    else process.env.AFTERIMAGE_BACKEND_URL = prior.url;
    if (prior.token === undefined) delete process.env.AFTERIMAGE_BACKEND_TOKEN;
    else process.env.AFTERIMAGE_BACKEND_TOKEN = prior.token;
  }
});
