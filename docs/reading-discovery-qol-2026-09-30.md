# Reading discovery and library previews

Next reads is a discovery shortlist, separate from generated reading kits. Recommendations use the reading direction, saved/reading/read states, and suggestion feedback to retrieve canonical arXiv candidates through arXiv and OpenAlex, then rank them. Refreshing suggestions now stores paper metadata and recommendation context without queuing generation. Imports still prepare a kit because the owner explicitly chose to add a paper.

Home cards show the title and a short source-derived summary. The cards omit the recommendation rationale and reading-focus section. Feedback lives in a small keyboard-accessible overflow menu, while a full-width lavender reading action anchors each card. Short named-paper titles are used when a title has a compact prefix before a colon; the full title remains available on hover and in the reader. An approved notecard opens immediately; a paper with active preparation links to progress; otherwise **Prepare reading kit** explicitly queues generation, saves the paper, and opens its reader. Hovering or route prefetching never starts generation. Duplicate requests retain a single active job. Failed drafts are not presented as available notecards. Recall includes stored reviewed notecards even while a visual supplement is unfinished.

Library cards use a document-and-sparkle icon during generation, a clock while queued, and a retry mark after a failed attempt. A single status label at the top follows the paper's allowlisted worker milestone. The cards omit the repeated caption and bottom status bar, retaining the reading status quietly at the top right. SVG previews fit both dimensions within their padded frame and retain the complete diagram, including captions and footnotes; this applies to generated flow-v2 scenes and editorial EAGLE/LoRA diagrams. The active indicator respects reduced motion.

Unprepared readers retain their abstract and original-paper links. Inactive preparation is a compact request/retry panel, without a failed progress timeline. An interruption before reviewing is not described as a review rejection. Reviewed content and private diagnostic boundaries remain unchanged.

## Verified failure causes

Live API and macserver worker reports were checked during this request. MegaBlocks and TriRoute still carried September 15 failures from the older mechanism-first-v1 pipeline: overlapping labels and connectors crossing text. The current macserver worker uses mechanism-first-v2 and flow-v2 layout, but old failed records do not regenerate themselves.

QLoRA was retried with that current worker on September 30 at 11:24 PM Pacific and rejected after five candidates. Its node IDs used hyphens while edge endpoints used underscores. Every repair retained the mismatch. `prepareScene` now resolves an underscore spelling to an existing hyphenated ID before review, preserving every edge. It never guesses missing concepts, removes edges, or bypasses validation. Unknown endpoints and self-connections report their exact IDs to private repair diagnostics. The generation contract explicitly requires identical node/edge IDs.

SGLang's attempt that evening stopped during planning because the selected model was at capacity. This was an execution interruption, not a scientific or visual review rejection.

Source validation, technical review, deterministic geometry checks, and desktop/mobile visual review remain required. Fixing identifier spelling is not evidence that a regenerated QLoRA or MegaBlocks kit has passed these gates.

## Verification and release

Desktop is the product target and the required release acceptance view, as confirmed by the owner on October 1. Existing responsive rendering and diagram review gates remain compatible; mobile is not a separate product target.

Regression tests cover underscore/hyphen endpoint spelling, retained relationships, unknown endpoints, self-connections, interrupted-generation copy, metadata-only recommendation completion, explicit kit saving, and queue deduplication. UI verification uses an isolated SQLite fixture with ready, queued, running, failed, idle, editorial, and generated cards. No private production backup is copied or modified.

The web/API change can be released without a storage bridge update. Deploy compatible web/API code before updating the worker; let active jobs finish before restarting workers. The graph fix runs in the worker and does not repair stored failed jobs automatically. A new reviewed run is needed before claiming those papers are fixed in production.
