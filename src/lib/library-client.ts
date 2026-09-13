import type { AppState } from './types';
export class SessionExpired extends Error {}
export async function readLibrary(signal: AbortSignal, request: typeof fetch = fetch, full = false): Promise<AppState> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await request(full ? '/api/state?full=1' : '/api/state', {
        cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      if (attempt === 0) { await new Promise(resolve => setTimeout(resolve, 300)); continue; }
      throw new Error('The library connection is temporarily unavailable. Please try again.');
    }
    if (response.status === 401) throw new SessionExpired('Please sign in again.');
    if (!response.ok) throw new Error('The library connection is temporarily unavailable. Please try again.');
    try { return await response.json(); }
    catch { throw new Error('The library response was interrupted. Please try again.'); }
  }
  throw new Error('The library connection is temporarily unavailable. Please try again.');
}
