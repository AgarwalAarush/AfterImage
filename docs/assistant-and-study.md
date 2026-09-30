# Paper assistant and visual study guides

## Reading assistant

The paper page supports selecting text and choosing **Ask about this**, or opening **Ask this paper** with the launcher / Cmd-Ctrl-J. On desktop the reading column and figures recompose around the side rail; narrow screens use an overlay. Closing preserves the conversation. Answers support streamed text, inline/display KaTeX, safe source buttons, stop, and copy. They are not written into a post-reading capture model or Markdown export. Recent history is retained per paper, with a global cap of 100 question records and six completed exchanges included in context.

The server assembles context from canonical paper metadata, available source excerpts (up to the existing extraction limits), the current notecard, figure data and recent conversation. It never claims an unextracted full PDF is available. Original sources and generated/editorial explanation have different citation markers. Clicking a source retrieves the actual stored excerpt on demand. Model content is rendered as text/controlled Markdown and KaTeX with `trust:false`; the model cannot supply arbitrary HTML, URLs or SVG.

## Streaming and isolation

`POST /api/assistant` creates an idempotent, authenticated request. `GET /api/assistant?id=…` provides reconnectable server-sent events. The Mac service polls outbound and sends cumulative real text deltas at short intervals, which makes retried updates idempotent. SSE connections rotate after 25 seconds to avoid function timeouts. Only conversation fields are queried while streaming; the regular library response omits all conversation records and source excerpts.

`worker/assistant.ts` uses Codex app-server over **stdio**, on the macserver, with the existing ChatGPT login. It opens no HTTP port. An isolated `.assistant-runtime` config disables shell, unified exec, browser/computer, plugins/apps, web search, agents, hooks and memory; it reuses the existing auth file by local symlink. A strict event allowlist rejects unexpected tool activity/approval requests. Environment variables are whitelisted; Supabase and worker tokens are not passed to Codex. No OpenAI API key is used. This is not a full OS-user/container isolation boundary or a proof against every host vulnerability.

Session authentication protects reads, sources and stream endpoints; same-origin checks protect mutations; the worker has a distinct bearer token. Request/response sizes, 20 questions/hour, 60/day, one active turn per paper and one running assistant job globally are enforced in persistent state. Cancellation invalidates the lease and aborts the model process on the next worker update. There is a 180-second model deadline. These are request/concurrency limits, not a precise token or account-wide credit budget. API failures preserve the partial answer and surface retryable errors.

## Visual study guides

A paper can contain several figures located next to mechanism or evidence text. The generator chooses among zero-based comparison bars, numeric matrices, attention heatmaps, weighted layered networks with inspectable weights and switchable states, token trees, timelines, latency/loss/scaling curves, and sampled loss landscapes with optimization paths. Coordinates, scales, topology layout, contours, connectors, and SVG markup come from deterministic renderers; generated content supplies bounded semantic labels and validated values. Original figure art is used, not copied Fanout SVGs. Each figure has a source and a reported-versus-illustrative label. Networks are for actual weighted neural/routing connections, trees for branching candidates, timelines for ordered events, curves for a dependent variable over an increasing x-axis, and landscapes for a sampled scalar field.

Study generation is a separate job after each newly generated notecard. Existing notecards expose **Create visual study guide**. Each guide has 1–3 complementary figures and 2–4 questions, three choices per question, explanation for each choice, and source links. Quiz answers and completion persist in the current browser. They do not yet change recommendations.

Paper walkthrough tables keep their serif body text at 15px with a compact line height, below the surrounding 16px recall scale; mono headers and step labels remain smaller so the table reads as supporting detail.

All figure states render as separately composed desktop/mobile SVGs. Schema/source validation, actual-font collision/clipping inspection, and a fresh source-aware visual/quiz critique gate publication, with up to two repairs. Invalid values, unknown citations, invalid edges or tree parents, cycles, excessive tree depth, inconsistent grid dimensions, invalid normalized attention rows, non-increasing curve axes, out-of-grid landscape paths, duplicate options, and unresolved must-fix defects prevent publishing the guide. Human-readable visual quality still depends in part on model judgment. Existing opening diagrams remain available.

Study generation refreshes source extraction, including tables and separately citable parts of long sections. Every reported bar value must also appear numerically in its cited original excerpt. Existing notecard citations are revalidated before refreshed sources are published. This exact-value check complements semantic review; it does not prove that a number was selected from the correct row or experimental condition.

## Reference evidence

Inspected the complete public [Fanout lottery-ticket article](https://fanout.sh/daily/2026-09-13-lottery-ticket-hypothesis), including its opening figure, fixed-mask initialization comparison, equation, evidence bars, limitations, quiz and references. Observed: different figures serve different explanatory roles; interaction isolates one changed variable; figure captions state experimental scope and teaching simplifications. Proposed for Afterimage: distribute complementary figures beside the relevant prose, source every reported value, label invented examples, and make quiz feedback explain misconceptions. The assistant's white surface, recessed input well, compact mono metadata and quiet controls also draw on the user-supplied lab-search screenshot.

## Preparation visibility

As of September 30, independently reviewed notecards remain readable while the study supplement completes. Study drafts stay private until their own checks pass. See `preparation-and-loading-2026-09-30.md` for worker milestones, elapsed time, connection status, and release ordering.

## Validation

Run `npm test`, `AFTERIMAGE_BUILD_DIR=.next-production npm run build`, and the browser desktop/mobile flows. `scripts/test-assistant-stream.ts` checks real app-server deltas on the macserver. `scripts/verify-assistant-live.ts` checks production access boundaries and multiple real SSE updates; it submits one actual paper question. `worker/index.ts --study-file <paper.json>` runs full generation/review without publishing. Store passed artifact/review pairs before applying a supplement.

2026-09-13 verification: 41 tests and production build passed. `scripts/render-study-gallery.ts` also renders desktop/mobile fixtures for every specialized scientific grammar so geometry and typography can be inspected with the same fonts used by the critic. A real production question delivered nine incremental SSE updates before completion; unauthenticated history, sources, asks and worker requests returned 401, and a cross-origin mutation returned 403. Browser checks covered highlight-to-ask, source context, rendered math, mobile layout and cancellation. EAGLE-3 was backfilled with three reviewed figures and four quiz questions; other existing papers retain the explicit study-generation action.
