import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { initialState } from "../src/lib/catalog";
import { signedBackendHeaders } from "../src/lib/backend-auth";
import { macserverRequest } from "../src/lib/macserver-client";
import { assistantSnapshot, mutate, snapshot, stateStatus, touchWorkerSeenAt } from "../src/lib/store";
import { deleteDocument, getDocument, getDocumentMetadata, listDocuments, prepareDocument, saveDocument } from "../src/lib/documents";

test("Vercel-to-macserver bridge authenticates requests and preserves SQLite versions", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "afterimage-storage-"));
  const file = path.join(directory, "state.sqlite");
  const secret = "test-storage-credential-with-at-least-32-bytes";
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE state (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)");
  db.prepare("INSERT INTO state VALUES (1,0,?)").run(JSON.stringify(initialState()));
  db.close();
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/storage-server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AFTERIMAGE_STORAGE: "sqlite",
      AFTERIMAGE_SQLITE_PATH: file,
      AFTERIMAGE_BACKEND_TOKEN: secret,
      AFTERIMAGE_BACKEND_PORT: "0",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let childError = "";
  child.stderr.on("data", chunk => { childError += chunk.toString().slice(0, 1000); });
  let oldStorage = process.env.AFTERIMAGE_STORAGE;
  let oldUrl = process.env.AFTERIMAGE_BACKEND_URL;
  let oldToken = process.env.AFTERIMAGE_BACKEND_TOKEN;
  try {
    const port = await new Promise<number>((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error(`Storage bridge did not start: ${childError}`)), 10_000);
      child.stdout.on("data", chunk => {
        output += chunk.toString();
        const match = output.match(/listening on 127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Storage bridge exited: ${code}: ${childError}`)); });
    });
    const origin = `http://127.0.0.1:${port}`;
    process.env.AFTERIMAGE_STORAGE = "macserver";
    process.env.AFTERIMAGE_BACKEND_URL = origin;
    process.env.AFTERIMAGE_BACKEND_TOKEN = secret;

    assert.equal((await snapshot()).version, 0);
    assert.equal((await assistantSnapshot()).length, 0);
    const result = await mutate(state => { state.direction.goal = "bridge test"; return "saved"; });
    assert.equal(result, "saved");
    assert.equal((await snapshot()).data.direction.goal, "bridge test");
    assert.equal((await stateStatus()).version, 1);
    await touchWorkerSeenAt("2026-09-28T00:00:00.000Z");
    assert.deepEqual(await stateStatus(), {version: 1, workerSeenAt: "2026-09-28T00:00:00.000Z"});
    assert.deepEqual(await macserverRequest({action: "compareAndSwap", version: 0, data: (await snapshot()).data}), {applied: false});

    const turnId=randomUUID(), conversationId=randomUUID();
    const asked=await macserverRequest<{id:string}>({action:"assistant",operation:{op:"enqueue",input:{action:"ask",id:turnId,conversationId,target:{kind:"subject",id:"attention-is-all-you-need"},question:"Explain attention",selection:""},evidence:{title:"Test lesson",arxivId:"1706.03762",digest:"a".repeat(64),sources:[],material:{},scope:"lesson"}}});
    assert.equal(asked.id,turnId);
    const claimed=await macserverRequest<{request:{id:string;leaseToken:string}}>({action:"assistant",operation:{op:"claim"}});
    await macserverRequest({action:"assistant",operation:{op:"update",action:"complete",id:turnId,leaseToken:claimed.request.leaseToken,answer:"Test answer"}});
    const restored=await macserverRequest<{answer:string;leaseToken?:string}>({action:"assistant",operation:{op:"get",id:turnId}});
    assert.equal(restored.answer,"Test answer");assert.equal(restored.leaseToken,undefined);
    assert.equal((await snapshot()).version,1);

    const content = Buffer.from("# Private guide\n\nA useful explanation saved outside the paper state.\n");
    const prepared = prepareDocument("guide.md", content);
    const saved = await saveDocument(prepared);
    assert.equal(saved.title, "Private guide");
    assert.equal((await listDocuments()).length, 1);
    assert.equal((await getDocumentMetadata(saved.id))?.filename, "guide.md");
    assert.deepEqual((await getDocument(saved.id))?.content, content);
    await assert.rejects(() => saveDocument(prepared), /already in Documents/);
    assert.equal((await snapshot()).version, 1);
    await deleteDocument(saved.id);
    assert.equal((await listDocuments()).length, 0);

    const body = JSON.stringify({action: "status"});
    const headers = {"content-type": "application/json", ...signedBackendHeaders(body, secret)};
    assert.equal((await fetch(`${origin}/internal/storage`, {method: "POST", headers, body})).status, 200);
    assert.equal((await fetch(`${origin}/internal/storage`, {method: "POST", headers, body})).status, 401);
    assert.equal((await fetch(`${origin}/internal/storage`, {method: "POST", body})).status, 415);
    const earlyUnauthorized = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(`${origin}/internal/storage`, {
        method: "POST",
        headers: {"content-type": "application/json", "content-length": "1024"},
      }, response => {
        response.resume();
        response.on("end", () => { resolve(response.statusCode); request.destroy(); });
      });
      request.on("error", reject);
      request.setTimeout(2_000, () => reject(new Error("Unauthenticated body was read")));
      request.flushHeaders();
    });
    assert.equal(earlyUnauthorized, 401);
    const fakeHeaders = {"content-type": "application/json", "content-length": "1024",
      ...signedBackendHeaders(body, secret), "x-afterimage-envelope-signature": "0".repeat(64)};
    const forgedEnvelope = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(`${origin}/internal/storage`, {
        method: "POST", headers: fakeHeaders,
      }, response => {
        response.resume();
        response.on("end", () => { resolve(response.statusCode); request.destroy(); });
      });
      request.on("error", reject);
      request.setTimeout(2_000, () => reject(new Error("Forged envelope body was read")));
      request.flushHeaders();
    });
    assert.equal(forgedEnvelope, 401);
    assert.equal((await fetch(`${origin}/internal/storage`, {method: "POST", headers, body: body + " "})).status, 401);
    const unicodeBody = JSON.stringify({action: "status", note: "🌐"});
    const unicodeBytes = Buffer.from(unicodeBody);
    const split = unicodeBytes.indexOf(Buffer.from("🌐")) + 1;
    const unicodeStatus = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(`${origin}/internal/storage`, {
        method: "POST",
        headers: {"content-type": "application/json", ...signedBackendHeaders(unicodeBody, secret)},
      }, response => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      });
      request.on("error", reject);
      request.write(unicodeBytes.subarray(0, split));
      request.end(unicodeBytes.subarray(split));
    });
    assert.equal(unicodeStatus, 200);
    const rejected = await Promise.all(Array.from({length: 35}, () =>
      fetch(`${origin}/internal/storage`, {method: "POST", headers: {"content-type": "application/json"}, body})));
    assert.ok(rejected.some(response => response.status === 429));
    await Promise.all(rejected.map(response => response.arrayBuffer()));
    assert.equal((await macserverRequest({action: "status"}) as {version: number}).version, 1);
    const copy = new DatabaseSync(file, {readOnly: true});
    assert.equal(copy.prepare("PRAGMA integrity_check").get()!.integrity_check, "ok");
    assert.equal(copy.prepare("SELECT version FROM state WHERE id=1").get()!.version, 1);
    assert.equal(copy.prepare("SELECT count(*) AS count FROM documents").get()!.count, 0);
    copy.close();
  } finally {
    if (oldStorage === undefined) delete process.env.AFTERIMAGE_STORAGE;
    else process.env.AFTERIMAGE_STORAGE = oldStorage;
    if (oldUrl === undefined) delete process.env.AFTERIMAGE_BACKEND_URL;
    else process.env.AFTERIMAGE_BACKEND_URL = oldUrl;
    if (oldToken === undefined) delete process.env.AFTERIMAGE_BACKEND_TOKEN;
    else process.env.AFTERIMAGE_BACKEND_TOKEN = oldToken;
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise(resolve => child.once("exit", resolve));
    }
    rmSync(directory, {recursive: true, force: true});
  }
});
