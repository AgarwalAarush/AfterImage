# Implementation and verification — 2026-09-12

## Built

- Next.js 16 + React + TypeScript, self-hosted font packages, original quiet editorial design.
- Reading shortlist with explanatory roles, reasons, reading focus, explicit refresh, and feedback.
- Library with note/abstract/title search, keyboard focus shortcut, status filters, archive/restore, and sort.
- Paper page with source-backed recap, original native SVG, separate mobile composition, source excerpts, alphaXiv handoff, reading status and revisiting. The removed notes editor no longer occupies the paper page.
- arXiv/alphaXiv import and version deduplication; automatic notecard queueing.
- SVG, Markdown, and JSON exports.
- Private owner login, HttpOnly session cookie, server-only storage, and a separately authenticated worker endpoint.
- Supabase optimistic state persistence; durable leased jobs, heartbeats, failure states, and bounded repairs.
- Codex CLI generation and recommendation worker on macserver, using ChatGPT authentication.

## Verified

- Production build succeeds and TypeScript checks pass.
- Eleven focused unit tests pass (including equation validation, actual-font connector collision detection, and LoRA ordering/clearance): canonical paper identity, import-host rejection, XML safety, geometric validation, and honest starter state.
- Development API integration checks pass: state retrieval, cross-origin mutation rejection, worker authentication, nonexistent-paper rejection, and invalid-source rejection.
- Production-mode checks pass: anonymous access denied, wrong access key denied, valid session accepted, secure HttpOnly cookie, state accessible after sign-in, secrets and lease tokens withheld from the browser.
- Browser: desktop shortlist, library search panel, phone-sized library, paper navigation, saved notes after reload, searching within notes, reading status, versioned import deduplication, generated desktop and portrait diagrams, and SVG download (`2401.04088.svg`) verified.
- No browser console errors in the checked views.
- Real Mac-server recommendation job `9eed34c3-ea9b-4c6a-a4f3-d6736740745e` completed; its selected arXiv records were independently imported and the shortlist persisted.
- Real Mac-server generation job `627ad80e-9435-4ab1-8e50-7c1d6f72ac3f` completed for Mixtral. Source extraction included the abstract and paper sections. Draft passed the desktop render/source review and persisted. The resulting portrait rendering was separately visually inspected after that run. Subsequent worker code adds both images to automated review.
- Two earlier generation drafts were rejected by quality checks. Connector-label placement, wrapping, caption instructions, and the expert-bank primitive were corrected; rejected drafts did not replace the existing notecard.
- Temporary verification notes, reading status, and goal were removed conditionally. Generated content remains as a real working example, with no fabricated personal reading history.

## Production deployment — 2026-09-12

- User explicitly approved credential upload and deployment.
- URL: https://afterimage.aarushagarwal.dev
- Vercel project: afterimage, scope aarush-agarwals-projects.
- Deployment: dpl_GJEtYHak8h3Pcz4pnU5XCkVpfNs2, production, READY, Next.js 16.3.5.
- Vercel build output reports 9 seconds. Source is an initial local Git workspace with no commit yet.
- DNS uses the existing Vercel nameservers. The custom subdomain serves HTTPS successfully.
- Production sign-in, unauthorized access denial, secure HttpOnly cookie, authenticated Supabase read, secret/lease isolation, and authenticated worker endpoint boundary checks passed.
- The first deployment exposed a packaging exclusion: an unanchored worker ignore pattern also removed src/app/api/worker. Root-anchored ignore paths corrected it; the current build includes all three API routes.
- Mac server LaunchAgent dev.aarushagarwal.afterimage-worker is installed and running in gui/501. Its origin is the production domain. The previous ad hoc worker and local SSH verification tunnel have been stopped.
- Production job b2ac3d29-c742-4d66-a35e-3b59dff75e18 completed successfully in 30 seconds, from 00:36:59 to 00:37:29 UTC on September 13 (September 12 Pacific). It generated the Mamba notecard from seven saved full-text/abstract source excerpts and passed both desktop and portrait visual/source review. The production state reports ready with Codex provenance.
- Production runtime error scan over the deployment window returned no error-level log entries. The Mac worker error log was empty. No separate external log drain or alerting integration was added.
- Live sign-in page was visually checked in the browser. The authenticated data and session flow were tested through the live HTTP endpoints without exposing credentials in logs.


## Recall and diagram refinement — September 12, evening

- Removed the personal-notes editor; retained stored history and older notes. Reading status remains in the paper header.
- Recall version 2 adds substantial mechanism, evidence, limitations, significance, and source-linked equations. KaTeX renders display and inline notation with unsafe commands disabled; both worker and completion API validate formulas and source IDs.
- Reading copy is 16 px desktop / 15 px mobile, with 1.85 line height and a restrained prose measure. The misleading 60-second label is now simply “The recall.”
- Added self-hosted Overused Grotesk and Departure Mono, retaining Newsreader and IBM Plex Mono in distinct roles. Official OFL licenses are included. Rendering on macserver uses the same actual font families.
- Rebuilt LoRA as separate native desktop and portrait SVGs: A precedes B, output labels clear connectors, dimensions are explicit, and the omitted scale is identified. A manual equation pass corrected the persisted LoRA merge formula to retain alpha/r consistently.
- Generated SVGs now use distinct connection ports, side routes around lower captions, larger mobile type, labels adjacent to arrows, native subscript/superscript spans, and extra clearance above expert banks.
- SVG export captures the displayed diagram and embeds four fonts. Actual downloaded 2106.09685.svg verified (358426 bytes, four font-face definitions, correct A/B order and output label position).
- Worker rubric identifies specific visual and mathematical defects by category, location, view, severity, evidence, and repair. Actual font-outline measurements reject clipping, text collisions, and connector-label collisions before visual review. Reviews render at 880 px desktop / 350 px mobile. Four bounded repairs are allowed.
- Added bounded arXiv PDF fallback (12 pages / 25 MB / 60 seconds) with pypdf 6.18.1 in an isolated worker environment. LoRA PDF extraction independently verified: 12 pages, 44237 characters. Current recalls used HTML sections where available.
- Desktop and 390 px mobile browser checks verified the new LoRA layout, removed editor, reading density, two attention equations, inline math, and source links. Attention page: 37 KaTeX expressions, zero fallback errors, zero page overflow. Mobile display equations fit within 287 px containers.
- Eleven regression checks pass, including malformed/unsafe math, unknown source citations, the reported connector collision, LoRA order, Unicode subscripts, and distinct incoming ports. TypeScript and production build pass.
- Final frontend deployment: dpl_ADnRZNKdFk2bNzxSyrLENG4YKQgK, READY, Next.js 16.3.5, Vercel build 7 seconds. No Git commit exists in this initial workspace.

- All eight existing paper recalls were refreshed to version 2 with full-text source excerpts. LoRA has 636 words of prose/metadata and three equations; Attention has 547 and two. The final Mixtral job 4cad0fbc-d67e-45d4-b0cc-a3f487bb5a6e completed at 01:17:58 UTC after the corrected renderer was loaded. Earlier rejected drafts remain in the worker artifacts and did not replace accepted content.
- A portrait canvas-height regression discovered by the visual critic was fixed and covered by a focused height-to-content test. Final deployment above includes that correction.
- The refresh used two temporary queue-draining worker processes; both exited. The normal LaunchAgent remains active. The last failed Mixtral job was resumed within its existing three-attempt allowance rather than creating another job beyond the app's hourly creation cap.
- Production runtime error scan during refinement returned no matching error-level entries. Final authenticated checks pass.

## Diagram font correction — September 12, 19:40 Pacific

- Used the supplied Departure Mono 1.500 archive; its WOFF2/OTF match the bundled files. Headings and short authored LoRA labels use Departure Mono. Equations, explanatory labels, generated node text, and fallback diagrams use IBM Plex Mono. Removed serif/sans fonts from SVG export embedding and aligned worker font measurement with the same two families.
- LoRA now renders the zero subscript with native SVG tspans. Shared node wrapping reserves space for the wider mono advances; this resolved a Lottery Ticket connector collision caught by the existing validator.
- All eight stored notecards pass the updated applicable geometry/recall validators. Typecheck, 11 existing tests, and production build pass. Local browser verification covered LoRA desktop and 390px mobile, correct computed font families, output equation spacing, and no horizontal overflow.
- Production deployment dpl_GTJeMoQu7q3vpanj6ipGHiPpVL9y is READY and aliased to afterimage.aarushagarwal.dev. Live CSS confirms IBM Plex Mono for diagram equations; anonymous state requests still return 401.
- Synced shared renderer and review font settings to the Mac server and restarted the idle AfterImage LaunchAgent; running PID 89312. No model generation was triggered for this font update.
- No authentication or host-isolation changes were made. The proposed additional identity gate remains a recommendation.

## Personalized research discovery — September 12, evening

- Added editable research background and up to 20,000 characters of pasted reading context in Direction. Saved the owner's explicit MoE research background and supplied GPT reading path in private production state; existing reading history was preserved. The pasted text is treated as unverified suggestions, never completed reading or evidence for technical claims.
- Candidate discovery combines existing papers, canonical arXiv links extracted from reading context, model-proposed IDs, and bounded live searches. Imported metadata/abstracts are resolved before ranking. The ranking prompt asks for a coherent research contribution, systems/conceptual bridge, and useful adjacent exploration, respecting expertise and stated questions.
- Enforced reading/read/archived and latest-feedback exclusions before ranking and again on completion. Later feedback expires after 30 days. Changed research direction invalidates an in-flight shortlist. Duplicate/unresolved recommendations fail validation; empty shortlists are permitted rather than forcing unsuitable recommendations.
- Added a collapsible explanation with candidate counts, supplied-link resolution counts, search availability/source, unverified IDs, and changed-direction notice. Recommendations remain explicit-refresh; no scheduled background generation was enabled.
- First production run 31bbc608-6af7-4253-b7e9-3210b0680c78 completed: 27 candidates, 19/19 supplied arXiv links resolved. Selected Expert Choice Routing, MegaBlocks, and Mixture-of-Depths. Existing Expert Choice notecard was ready; two new notecards were queued separately.
- That run reported both API searches unavailable. Diagnosis: arXiv API returned HTTP 429. Added Retry-After-aware API backoff and the public arXiv website search fallback. A direct Mac-server check returned eight September 2026 paper IDs via website search. This check did not rerank the existing shortlist or imply those papers were read.
- Fourteen tests pass, including pasted-link normalization, reading/feedback exclusions, and discovery fallback/backoff. Production build passes. Local browser checked Direction and the actual personalized shortlist, with the explanation expanded at desktop and 390px mobile and no horizontal overflow.
- Final production deployment: dpl_y57Hp7LLTY93gRo6nJ8D2Lkr252A, READY, custom domain verified. Post-deployment anonymous/forged-session/worker-token/foreign-origin authentication regression checks passed.
- Worker was given a graceful stop after syncing the fallback; it restarted as PID 89786, so subsequent jobs load the new discovery module. The first MegaBlocks notecard attempt was rejected by the source/diagram quality gate; the recommendation itself remains available and verified. Mixture-of-Depths generation continued separately. No rejected draft was published.
