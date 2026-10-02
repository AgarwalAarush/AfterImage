# Immediate reading-kit preparation feedback

The recommendation action previously awaited the `/api/state` save-and-queue response before navigating. Remote storage latency therefore held the reader on the discovery card. The action now records a browser-only submission state in the shared provider and opens the paper immediately while the same bounded POST runs in the background. The paper route's loading boundary renders the known paper from that provider while the route loads. Visible paper links may prefetch the route; prefetch never requests generation.

Submission is distinct from a confirmed queue entry: “Starting preparation…” shows no invented queue position or worker activity. A successful response replaces it with authoritative library and job state. Requests are deduplicated per paper in the browser and by existing server job checks. No speculative entry or job is persisted. The shared provider keeps the request alive across in-app navigation.

An interrupted request displays inline uncertainty and a Check status action. A successful read reconciles that uncertainty before showing an available retry. An uncertain mutation is never automatically replayed. A hard refresh or closing the tab still requires the next library read to confirm whether the request was saved. Only confirmed jobs promise background continuation.

The progress section retains the existing typefaces and theme tokens, but uses a compact heading and description, a separate activity group, and five readable stage labels. The oversized empty region, decorative orb, repeated package list, redundant eyebrow and repeated footnotes are removed. Queued generation does not mark evidence collection as already running. Elapsed time, last worker activity, revision count, queue position, offline recovery, manual refresh and automatic polling remain. Reviewed notecards stay readable while their study guide is prepared. Shared status styling lives in `src/app/ui.css`.

This is a web-only change. No bridge, worker, schema, stored-kit migration or production deployment is required to verify it locally. Release requires only the web application; editorial and generated-content review boundaries remain unchanged.

## Validation

- TypeScript checks and all 115 tests pass, including submission projection, uncertain-result recovery, reviewed-content availability and existing server deduplication checks.
- The local webpack production build passes. (The shared dependency symlink is outside Turbopack’s worktree root, so local build/preview used webpack.)
- In the built application, a fresh browser showed the preparation view in 46 ms with both route data and the mocked queue response delayed by three seconds. A cached navigation showed feedback in 19 ms. These are local desktop measurements, not production latency measurements.
- Browser acceptance passed immediate submission, no invented queue position, navigation during an unresolved request, one request across navigation, server acknowledgement, interrupted request without replay, and a successful status read restoring the available action.
- Active notecard review rendered three completed stages and one current stage. The reviewed notecard remained visible during study review.
- Light and dark desktop captures passed; existing narrow-screen compatibility showed no horizontal overflow. Browser page errors and framework error overlays were absent.
- Impeccable’s mechanical design detector reported no findings for the changed component/style targets. Production release evidence follows.


## October 1 production release

[PR #4](https://github.com/AgarwalAarush/AfterImage/pull/4) merged as `e37c3c87a0720f8592117431ba04dfd90e2bbeb8`, after rebasing onto the article-title refinement on current main. All 115 tests, TypeScript and the local production build passed for that merged source tree.

Vercel deployment `dpl_FsHu6b85kwEUUn3pXAAFYqhfh72T` records that main revision and built successfully with Next.js 16.3.5/Turbopack (11-second build output). The production candidate was verified before promotion to [the public site](https://afterimage.aarushagarwal.dev). Vercel alias inspection confirms that the live hostname resolves to this READY deployment.

Authenticated library reads returned 200 before and after promotion; anonymous API access returned 401. The post-release state had 14 papers, zero active jobs and a fresh worker heartbeat. The browser projection omitted raw job errors, lease tokens and generation errors. No storage bridge, worker or database change was made.

Candidate and public-domain browser acceptance passed submission feedback, navigation during an unresolved request, confirmed queue presentation, both themes, existing responsive compatibility and uncertain-write reconciliation without replay. The deployed candidate showed feedback in 18 ms; the public-domain test showed it in 122 ms with a three-second held response. These tests used real authentication and library reads but mocked queue writes and displayed fixture state in browser memory, so they did not create production generation jobs. This release does not claim a new end-to-end generation/review result. Browser page errors were absent; a deployment-scoped Vercel runtime error-count scan was empty for the checked release interval.
