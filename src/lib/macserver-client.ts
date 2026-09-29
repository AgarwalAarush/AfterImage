import { signedBackendHeaders } from "./backend-auth";
import { StorageError } from "./storage-request";

export type BackendAction =
  | { action: "snapshot" | "status" | "workerClaimStatus" | "assistantSnapshot" }
  | { action: "touchWorkerSeenAt"; now: string }
  | { action: "compareAndSwap"; version: number; data: unknown };

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
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("Backend request failed.");
    return (await response.json()) as T;
  } catch {
    // Mutations are not retried: an interrupted response may follow a committed write.
    throw new StorageError(request.action === "compareAndSwap" ? "POST" : "GET");
  }
}
