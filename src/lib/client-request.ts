/** Bound requests without replaying uncertain writes. The signal also covers body reads. */
export async function clientRequest(url: string, init: RequestInit = {}, request: typeof fetch = fetch) {
  try {
    return await request(url, {...init, signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)});
  } catch (error) {
    if (init.signal?.aborted) throw error;
    const write = init.method && init.method !== "GET";
    throw new Error(write
      ? "The connection was interrupted. Check whether the change was saved before trying again."
      : "The connection timed out or was interrupted. Please try again.");
  }
}
