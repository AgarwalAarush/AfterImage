import { assistantOperationSchema, localAssistantStore } from "../src/lib/assistant-storage";
import { AssistantWakeServer } from "./assistant-wake-server";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { validBackendEnvelope, verifyBackendRequest } from "../src/lib/backend-auth";
import {
  assistantSnapshot,
  compareAndSwapLocal,
  snapshot,
  stateStatus,
  touchWorkerSeenAt,
  workerClaimStatus,
} from "../src/lib/store";
import type { AppState } from "../src/lib/types";
import {
  deleteDocument,
  getDocument,
  getDocumentMetadata,
  listDocuments,
  MAX_DOCUMENT_BYTES,
  prepareDocument,
  saveDocument,
} from "../src/lib/documents";

const maxBodyBytes = 8 * 1024 * 1024;
const seen = new Map<string, number>();
let assistantWake: AssistantWakeServer | undefined;
let invalidWindowStart = 0;
let invalidRequests = 0;

function rejectedStatus(status: number, now = Date.now()) {
  if (now - invalidWindowStart >= 1_000) {
    invalidWindowStart = now;
    invalidRequests = 0;
  }
  invalidRequests++;
  return invalidRequests > 30 ? 429 : status;
}

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function validState(data: unknown): data is AppState {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const state = data as Partial<AppState>;
  return state.schemaVersion === 2 && Array.isArray(state.papers) &&
    Array.isArray(state.jobs) && Array.isArray(state.recommendations) &&
    Array.isArray(state.feedback) && Boolean(state.entries) &&
    typeof state.entries === "object" && !Array.isArray(state.entries) &&
    Boolean(state.direction) && typeof state.direction === "object" &&
    typeof state.onboardingDone === "boolean";
}

function validDocumentId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function handleStorageRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.url !== "/internal/storage") return reply(res, rejectedStatus(404), { error: "Not found" });
  if (req.method !== "POST") return reply(res, rejectedStatus(405), { error: "Method not allowed" });
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return reply(res, rejectedStatus(415), { error: "JSON required" });
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers))
    if (typeof value === "string") headers.set(key, value);
  const secret = process.env.AFTERIMAGE_BACKEND_TOKEN || "";
  if (!validBackendEnvelope(headers, secret))
    return reply(res, rejectedStatus(401), { error: "Unauthorized" });
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += part.length;
      if (bytes > maxBodyBytes) return reply(res, rejectedStatus(413), { error: "Request too large" });
      chunks.push(part);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    if (!verifyBackendRequest(headers, body, secret, seen))
      return reply(res, rejectedStatus(401), { error: "Unauthorized" });
    const request = JSON.parse(body) as Record<string, unknown>;
    switch (request.action) {
      case "assistant": {
        const operation = assistantOperationSchema.parse(request.operation);
        const result = localAssistantStore().execute(operation);
        // A notification failure must not turn an already committed write into an error.
        try {
          assistantWake?.refresh(operation.op === "enqueue" || operation.op === "cancel" ||
            operation.op === "update" && ["complete", "fail"].includes(operation.action));
        } catch {console.error("afterimage.assistant-wake", {phase:"notify",errorName:"Error"});}
        return reply(res, 200, result);
      }
      case "snapshot": return reply(res, 200, await snapshot());
      case "status": return reply(res, 200, await stateStatus());
      case "workerClaimStatus": return reply(res, 200, await workerClaimStatus());
      case "assistantSnapshot": return reply(res, 200, await assistantSnapshot());
      case "touchWorkerSeenAt": {
        if (typeof request.now !== "string" || !Number.isFinite(Date.parse(request.now)))
          return reply(res, 400, { error: "Invalid request" });
        await touchWorkerSeenAt(request.now);
        return reply(res, 200, { ok: true });
      }
      case "compareAndSwap": {
        if (!Number.isSafeInteger(request.version) || Number(request.version) < 0 || !validState(request.data))
          return reply(res, 400, { error: "Invalid request" });
        return reply(res, 200, {
          applied: compareAndSwapLocal(Number(request.version), request.data),
        });
      }
      case "documentList": return reply(res, 200, await listDocuments());
      case "documentGet": {
        if (!validDocumentId(request.id)) return reply(res, 400, { error: "Invalid request" });
        const document = await getDocument(request.id);
        return reply(res, 200, document ? {
          ...document,
          content: document.content.toString("base64"),
        } : null);
      }
      case "documentMetadata": {
        if (!validDocumentId(request.id)) return reply(res, 400, { error: "Invalid request" });
        return reply(res, 200, await getDocumentMetadata(request.id));
      }
      case "documentDelete": {
        if (!validDocumentId(request.id)) return reply(res, 400, { error: "Invalid request" });
        await deleteDocument(request.id);
        return reply(res, 200, { ok: true });
      }
      case "documentSave": {
        if (typeof request.filename !== "string" || request.filename.length > 240 ||
          typeof request.content !== "string" ||
          request.content.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.content))
          return reply(res, 400, { error: "Invalid request" });
        const content = Buffer.from(request.content, "base64");
        if (content.toString("base64") !== request.content)
          return reply(res, 400, { error: "Invalid request" });
        try {
          return reply(res, 200, await saveDocument(prepareDocument(request.filename, content)));
        } catch (error) {
          if (error instanceof Error && error.message === "This file is already in Documents.")
            return reply(res, 409, { error: error.message });
          throw error;
        }
      }
      default: return reply(res, 400, { error: "Invalid request" });
    }
  } catch {
    return reply(res, 400, { error: "Invalid request" });
  }
}

async function start() {
  const file = process.env.AFTERIMAGE_SQLITE_PATH;
  const secret = process.env.AFTERIMAGE_BACKEND_TOKEN;
  if (process.env.AFTERIMAGE_STORAGE !== "sqlite" || !file || !existsSync(file) || !secret || secret.length < 32)
    throw new Error("Storage bridge requires an existing SQLite file and a service credential.");
  const port = Number(process.env.AFTERIMAGE_BACKEND_PORT || "3101");
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid storage bridge port.");
  await stateStatus();
  await listDocuments();
  if (process.env.AFTERIMAGE_ASSISTANT_WAKE_PORT && !process.env.AFTERIMAGE_ASSISTANT_WAKE_TOKEN)
    throw Error("Assistant wake credential is missing.");
  if (process.env.AFTERIMAGE_ASSISTANT_WAKE_TOKEN) {
    if (process.env.AFTERIMAGE_ASSISTANT_WAKE_TOKEN === secret)
      throw Error("Assistant wake credential must be separate from storage authentication.");
    const wakePort = Number(process.env.AFTERIMAGE_ASSISTANT_WAKE_PORT || "3104");
    if (wakePort === port && port !== 0) throw Error("Assistant wake listener requires a separate port.");
    assistantWake = new AssistantWakeServer(process.env.AFTERIMAGE_ASSISTANT_WAKE_TOKEN,
      () => localAssistantStore().queueReadiness());
    await assistantWake.listen(wakePort);
    const address = assistantWake.server.address();
    if (address && typeof address !== "string")
      console.log(`AfterImage assistant wake listening on 127.0.0.1:${address.port}`);
  }
  const server = createServer(handleStorageRequest);
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxConnections = 64;
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    if (address && typeof address !== "string")
      console.log(`AfterImage storage bridge listening on 127.0.0.1:${address.port}`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {void assistantWake?.close();server.close();});
}

if (process.argv[1]?.endsWith("storage-server.ts"))
  start().catch(() => { console.error("afterimage.storage", {phase:"startup",errorName:"Error"}); process.exitCode = 1; });
