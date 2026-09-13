# Loading speed and connection recovery

The reported screen was the library fetch error state. Read-only probes after the report succeeded and returned all ten papers. The previous client replaced an already loaded library with this error on any failed refresh. Existing logs did not capture enough detail to identify the historical network failure precisely; Vercel's grouped runtime-error query returned no errors for the selected hour. Earlier worker logs contained storage 504s, but those do not prove the cause of the particular screenshot.

## Changes

- Keep the last successfully loaded library in React memory during background read failures and display a reconnect notice. No new persistent browser cache was introduced. A 401 or sign-out clears that private in-memory state.
- Deduplicate concurrent refreshes; cancel obsolete reads before mutations; reuse fresh state on route navigation. Poll every five seconds for active jobs, every minute while idle, and every fifteen seconds during recovery. Hidden/offline tabs do not poll; resume and reconnect events refresh as needed.
- Database reads have a four-second per-attempt deadline and one bounded retry for network/interrupted-body and transient 5xx errors. Writes are never blindly retried. Added sanitized method/status/cause logging and actionable user messages.
- Default browser API responses retain paper text and source citations but omit source excerpts. The authenticated full-export request explicitly requests all evidence; stored data and worker inputs retain the original excerpts. Worker lease tokens are removed from both projections.
- Moved the paper reader and KaTeX out of the shared app module, scoped KaTeX CSS to the paper reader, deferred the diagram module, and loaded SVG export code on demand.
- Skip database writes for unchanged mutations. An idle worker records its heartbeat about once per minute instead of rewriting the entire document on every twenty-second claim poll.

## Measurements

Measured using the same ten-paper library. Payload sizes are decoded JSON bytes, not compressed transfer sizes. JavaScript counts the script URLs explicitly referenced by the initial homepage HTML; deferred modules are excluded. Gzip sizes are computed estimates, not browser measurements. These are payload measurements, not a controlled LCP benchmark.

| Measurement | Before | Optimized local production build |
| --- | ---: | ---: |
| Default library JSON | 401,229 bytes | 103,806 bytes |
| Initial page JavaScript | 1,280,305 bytes | 610,987 bytes |
| Estimated gzip of initial JavaScript | 358,994 bytes | 187,686 bytes |

The initial library JSON is 74% smaller; initial referenced JavaScript is 52% smaller (48% by estimated gzip). Before-change production API samples were 695, 429, and 334ms. Individual request times varied; no causal latency percentage is claimed from those samples.

## Verification

- Twenty tests pass, including interrupted reads, no write replay, session-expiry handling, stale-request cancellation, lightweight/full data projection, lease secrecy, and keeping library content on background errors.
- Production build and TypeScript pass. The build used a separate .next-production directory to avoid conflicting with the development server.
- Local browser checked the homepage and navigation to Expert Choice Routing. Its reader rendered 39 KaTeX expressions, zero math fallbacks, three equation source links, and no horizontal overflow at 390px.
- Full-export HTTP check retained all source evidence and citation IDs/URLs, while the default projection excluded the excerpts. No worker lease token was present in either projection.

## Production confirmation

Deployment dpl_FDniBnPfvmkZyNndFscQH1wmkT82 is READY and serves afterimage.aarushagarwal.dev. The live initial-script total is 611,504 decoded bytes (187,925 bytes estimated gzip), confirming the same reduction on production. Anonymous library/generation/import/recommendation requests, forged sessions, invalid worker tokens, and foreign-origin mutations remain denied. The temporary local production measurement server was stopped after verification.
