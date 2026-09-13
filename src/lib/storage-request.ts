/** Retry transient reads only. An uncertain write must never be replayed blindly. */
export async function storageRequest(url: string, init: RequestInit, request: typeof fetch = fetch) {
  const method = init.method || "GET";
  const attempts = method === "GET" ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let status: number | undefined;
    try {
      const response = await request(url, { ...init, signal: AbortSignal.timeout(4000) });
      status = response.status;
      if (response.ok) {
        if (response.status === 204 || response.status === 205) return response;
        const body = await response.text();
        return new Response(body, {status: response.status, headers: response.headers});
      }
      if (attempt + 1 < attempts && [500, 502, 503, 504].includes(status)) {
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      console.error("afterimage.storage", {method, status, attempt: attempt + 1});
      throw new StorageError(method);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      if (attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      const cause = error instanceof Error ? (error.cause as {code?: string} | undefined)?.code : undefined;
      console.error("afterimage.storage", {method, status, cause, attempt: attempt + 1});
      throw new StorageError(method);
    }
  }
  throw new StorageError(method);
}
export class StorageError extends Error {
  constructor(method: string) {
    super(method === "GET"
      ? "The library connection is temporarily unavailable. Please try again."
      : "We couldn't confirm this change. Refresh before trying again.");
  }
}
