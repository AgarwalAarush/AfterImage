import type { AppState } from './types';
export class SessionExpired extends Error {}
export async function readLibrary(signal: AbortSignal, request: typeof fetch = fetch, full = false): Promise<AppState> {
  const result = await readLibraryUpdate(signal, undefined, request, full);
  if (!result.state) throw new Error('The library response was interrupted. Please try again.');
  return result.state;
}
export async function readLibraryUpdate(signal: AbortSignal, since?: number, request: typeof fetch = fetch, full = false): Promise<{state: AppState | null; version: number | null; workerSeenAt: string | null}> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      const url = full ? '/api/state?full=1' : since === undefined ? '/api/state' : `/api/state?since=${since}`;
      response = await request(url, {
        cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      if (attempt === 0) { await new Promise(resolve => setTimeout(resolve, 300)); continue; }
      throw new Error('The library connection is temporarily unavailable. Please try again.');
    }
    if (response.status === 401) throw new SessionExpired('Please sign in again.');
    if (response.status === 204 && since !== undefined) return {
      state: null, version: since, workerSeenAt: response.headers.get('X-Afterimage-Worker-Seen-At') || null,
    };
    if (!response.ok) throw new Error('The library connection is temporarily unavailable. Please try again.');
    try { return {
      state: await response.json() as AppState,
      version: Number.isSafeInteger(Number(response.headers.get('X-Afterimage-State-Version')))
        && response.headers.has('X-Afterimage-State-Version') ? Number(response.headers.get('X-Afterimage-State-Version')) : null,
      workerSeenAt: null,
    }; }
    catch { throw new Error('The library response was interrupted. Please try again.'); }
  }
  throw new Error('The library connection is temporarily unavailable. Please try again.');
}
