import assert from "node:assert/strict";
import test from "node:test";
import { macserverRequest } from "../src/lib/macserver-client";
import { verifyBackendRequest } from "../src/lib/backend-auth";

test("Cloudflare Access authenticates storage without replacing bridge signatures or leaking credentials", async t => {
  const names = ["AFTERIMAGE_BACKEND_URL", "AFTERIMAGE_BACKEND_TOKEN", "AFTERIMAGE_CF_ACCESS_CLIENT_ID", "AFTERIMAGE_CF_ACCESS_CLIENT_SECRET"];
  const prior = names.map(name => process.env[name]);
  const bridgeSecret = "test-bridge-secret-with-at-least-32-bytes";
  process.env.AFTERIMAGE_BACKEND_URL = "https://storage.example.com";
  process.env.AFTERIMAGE_BACKEND_TOKEN = bridgeSecret;
  process.env.AFTERIMAGE_CF_ACCESS_CLIENT_ID = "test-client.access";
  process.env.AFTERIMAGE_CF_ACCESS_CLIENT_SECRET = "test-private-cloudflare-secret";
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  t.mock.method(console, "warn", (...args: unknown[]) => { logs.push(args); });
  const request = t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("CF-Access-Client-Id"), "test-client.access");
    assert.equal(headers.get("CF-Access-Client-Secret"), "test-private-cloudflare-secret");
    assert.ok(verifyBackendRequest(headers, String(init?.body), bridgeSecret, new Map()));
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    return Response.json({version: 3});
  });
  try {
    assert.deepEqual(await macserverRequest({action: "status"}), {version: 3});
    request.mock.mockImplementation(async () => new Response("private Access rejection", {status: 403}));
    await assert.rejects(macserverRequest({action: "snapshot"}), /temporarily unavailable/);
    assert.equal(request.mock.callCount(), 2, "Access rejection must not be retried");
    assert.ok(!JSON.stringify(logs).includes("test-private-cloudflare-secret"));
    assert.ok(!JSON.stringify(logs).includes("test-client.access"));
    assert.ok(!JSON.stringify(logs).includes(bridgeSecret));

    const before = request.mock.callCount();
    for (const [id, secret] of [["test-client.access", undefined], [undefined, "secret"], ["", ""], ["test-client.access", "secret\ninvalid"]]) {
      if (id === undefined) delete process.env.AFTERIMAGE_CF_ACCESS_CLIENT_ID;
      else process.env.AFTERIMAGE_CF_ACCESS_CLIENT_ID = id;
      if (secret === undefined) delete process.env.AFTERIMAGE_CF_ACCESS_CLIENT_SECRET;
      else process.env.AFTERIMAGE_CF_ACCESS_CLIENT_SECRET = secret;
      await assert.rejects(macserverRequest({action: "snapshot"}), /Cloudflare Access is not configured correctly/);
    }
    assert.equal(request.mock.callCount(), before, "invalid credentials must fail before sending library data");

    delete process.env.AFTERIMAGE_CF_ACCESS_CLIENT_ID;
    delete process.env.AFTERIMAGE_CF_ACCESS_CLIENT_SECRET;
    request.mock.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("CF-Access-Client-Id"), null);
      assert.equal(headers.get("CF-Access-Client-Secret"), null);
      assert.ok(verifyBackendRequest(headers, String(init?.body), bridgeSecret, new Map()));
      return Response.json({version: 4});
    });
    assert.deepEqual(await macserverRequest({action: "status"}), {version: 4});
  } finally {
    names.forEach((name, index) => {
      if (prior[index] === undefined) delete process.env[name];
      else process.env[name] = prior[index];
    });
  }
});
