import { signedBackendHeaders } from "./backend-auth";
import { StorageError } from "./storage-request";

export type BackendAction =
  | { action: "snapshot" | "status" | "workerClaimStatus" | "assistantSnapshot" }
  | { action: "touchWorkerSeenAt"; now: string }
  | { action: "compareAndSwap"; version: number; data: unknown }
  | { action: "assistant"; operation: import("./assistant-storage").AssistantOperation }
  | { action: "documentList" }
  | { action: "documentGet" | "documentMetadata" | "documentDelete"; id: string }
  | { action: "documentSave"; filename: string; content: string };

export async function macserverRequest<T>(request: BackendAction): Promise<T> {
  const origin = process.env.AFTERIMAGE_BACKEND_URL;
  const secret = process.env.AFTERIMAGE_BACKEND_TOKEN;
  if (!origin || !secret || secret.length < 32)
    throw new Error("Macserver storage is not configured.");
  const url = new URL(origin);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")))
    throw new Error("Macserver storage URL must be a secure origin.");
  const body = JSON.stringify(request);
  const startedAt = performance.now();
  const readOnly = ["snapshot", "status", "workerClaimStatus", "assistantSnapshot", "documentList", "documentGet", "documentMetadata"].includes(request.action) || request.action === "assistant" && ["list", "turns", "get", "source"].includes(request.operation.op);
  for (let attempt = 1; attempt <= (readOnly ? 2 : 1); attempt++) {
    let status: number | undefined;
    let phase: "request" | "response" = "request";
    try {
      const response = await fetch(new URL("/internal/storage", url), {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          ...signedBackendHeaders(body, secret),
        },
        cache: "no-store",
        redirect: "error",
        // Leave room for the API response inside the browser's 12-second budget.
        signal: AbortSignal.timeout(Math.max(1, Math.ceil(10_000 - (performance.now() - startedAt)))),
      });
      status = response.status;
      phase = "response";
      if (!response.ok) {
        if (request.action === "documentSave" && response.status === 409)
          throw new Error("This file is already in Documents.");
        throw new Error("Backend request failed.");
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.message === "This file is already in Documents.") throw error;
      // Never log request/response bodies, URLs, signatures, credentials, or raw
      // error messages. Transport messages can contain private connection details.
      const cause = error instanceof Error ? error.cause as {code?: unknown; errors?: {code?: unknown}[]} | undefined : undefined;
      const codes = [cause?.code, ...(Array.isArray(cause?.errors) ? cause.errors.slice(0, 4).map(item => item.code) : [])]
        .filter((code): code is string => typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code));
      const durationMs = Math.round(performance.now() - startedAt);
      const retry = readOnly && attempt === 1 && durationMs < 9_500 &&
        ((phase === "request" && codes.some(code => ["ECONNRESET", "EAI_AGAIN", "ETIMEDOUT"].includes(code))) ||
          (status !== undefined && [500, 502, 503, 504].includes(status)));
      const log = retry ? console.warn : console.error;
      log("afterimage.macserver", {
        action: request.action, phase, status, attempt, retry,
        durationMs,
        errorName: error instanceof Error && ["Error", "TypeError", "TimeoutError", "AbortError", "SyntaxError"].includes(error.name) ? error.name : "Error",
        codes: [...new Set(codes)],
      });
      if (retry) {
        await new Promise(resolve => setTimeout(resolve, 200));
        // Each attempt receives a new timestamp/nonce/signature above.
        continue;
      }
      // Mutations are not retried: an interrupted response may follow a committed write.
      throw new StorageError(
        readOnly ? "GET" : "POST",
      );
    }
  }
  throw new StorageError(readOnly ? "GET" : "POST");
}
