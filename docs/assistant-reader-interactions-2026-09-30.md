# Assistant reader interactions

The sidebar previously forced all figures into their portrait variants as soon as it opened. This made tall generated diagrams dominate even a wide desktop reading column. Figure variants now use the paper column's inline container width: desktop above 700px, portrait below, with portrait artwork capped at 380px. This responds to the sidebar's resize handle as well as the viewport.

Questions appear optimistically with a queued state before the authenticated save completes. A failed save retains the failed turn and restores the question and selected passage for retry. A synchronous submission guard prevents duplicate clicks. The UI acknowledgement is independent of storage and model latency; actual assistant startup time is unchanged.

Cited source excerpts preload when an open conversation references them. The existing authenticated assistant endpoint supports bounded batches of up to 24 source IDs. Excerpts remain excluded from normal library polling and live only in the mounted reader's memory cache. Desktop hover/focus previews sit beside the sidebar, without inserting a source panel into the conversation. The preview remains usable as the pointer crosses to its original-source link, dismisses on leave/Escape, and opens on tap on narrow screens. A cold preview immediately shows a loading state; fetching the first excerpt can still take time.

Answers now use controlled Markdown with GFM tables, ordered/nested lists, code and KaTeX. Unknown citations remain unverified; model-provided HTML, images and outbound links are disabled. Original-source URLs still come only from stored source metadata. Citation-like text in code remains literal.

Cumulative server snapshots are unchanged. Each answer component reveals new text in small animation-frame increments at roughly 30 frames per second, accelerating when a large burst arrives. Existing completed history loads immediately. Reduced-motion readers and cancelled/failed turns show available text immediately. Copy continues to use the exact server answer, rather than the current animated prefix. Animations do not rerender reader diagrams.

## Local validation

Use isolated synthetic state and intercepted assistant responses; do not submit a production question as part of a UI smoke test. The browser check simulated a five-second save, a two-second excerpt lookup and a paragraph-size cumulative reply. Immediate question acknowledgement was 29ms, and the warmed citation hover preview opened in 40ms. Desktop tables, lists and math were inspected, along with narrow columns, sidebar resizing, mobile overflow, keyboard focus and Escape dismissal. Failed-save verification retained the question for retry and accepted only one request from repeated Enter presses. Reduced-motion verification showed the entire answer immediately with no reveal cursor. All 68 tests, TypeScript and the production build passed. Timings describe this local run, not production server latency.
