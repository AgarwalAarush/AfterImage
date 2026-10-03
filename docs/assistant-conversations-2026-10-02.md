# Reader assistant conversations and original papers

## Reader behavior

Library notecards and published Subjects lessons share the reader assistant. Each target has separate saved conversations, New chat, and paginated History. Selecting prose or PDF text opens a question popover; Quick explain / Command-E (Control-E on other platforms) sends the quote immediately. The quote appears inside the submitted message, not above the sidebar composer. Command-J toggles the sidebar. Subjects places its closed-assistant launcher in the Lesson/Paper toolbar so it cannot cover interactive lesson controls. Follow-up suggestions are removed. Desktop panel gaps are measured from the visible site header and viewport bottom, both 16px.

The Paper tab lazily loads a pinned PDF.js viewer. Original PDF colors remain unchanged. Page navigation, zoom, search, download, text selection, and source citation navigation share this view. Citations show source section titles, retain hover/focus previews, and match excerpt text or a unique heading to the fetched PDF. Ambiguous or missing matches offer the original anchored section instead of inventing a page. Lesson citations return to their lesson sections. PDF location caches are bound to the downloaded bytes' digest.

## Persistence and evidence

`assistant_conversations`, `assistant_turns`, and `assistant_migrations` live in the existing authoritative SQLite database. They are excluded from ordinary library state reads. Chat lists and turns are paginated; history is not automatically deleted. On first initialization, a single SQLite transaction imports all retained legacy requests, retaining IDs, answers, selections and statuses, into a Previous conversation per paper. The migration marker prevents repeat imports. Legacy answers did not store historical evidence versions; their available source snapshot is explicitly marked as captured at migration, not asserted to be the original answer-time evidence. Legacy library JSON is retained as rollback evidence, not the active queue.

Each turn freezes a server-resolved evidence snapshot and its digest; Subjects also binds the published lesson digest. Subject primary-paper excerpts are fetched independently on an explicit ask. The published lesson and primary sources have distinct citation identities. Private review artifacts and owner documents never enter this context. Failed source retrieval leaves the available editorial/abstract context usable with an explicit evidence-scope limitation.

The web API also accepts the previous paper-only submission/history/source shape and EventSource Accept header so already-open reader tabs can finish their session during a web release.

The signed bridge accepts validated assistant operations: list, turns, get, source, enqueue, cancel, claim and update. Queue transitions and quotas are atomic SQLite transactions. Request IDs are idempotent and conflicting reuse is rejected. One turn may be active per conversation, with the existing global quota and worker concurrency limits. Lease details and evidence bodies are removed from browser turn projections; a source excerpt is fetched only by its saved turn and source identity.

Browser requests reconcile uncertain writes through a request-ID lookup. A deliberate retry reuses the request ID; uncertain mutations are never automatically replayed. Changing conversations closes only that browser's stream. Server work continues, and reopening the chat restores its latest turn. Empty New chat drafts are not persisted until the first question.

## Release order and rollback

1. Keep production disabled for this change until the publication audit passes. Renew fingerprint-bound independent Subjects visual approval after all presentation bytes are frozen. Do not remove or weaken withheld-sidecar checks.
2. Take a local snapshot of the existing production SQLite database and verify restoration includes the new tables. Unit tests validate SQLite backup/restore with these tables; production backup verification is a separate release action.
3. Deploy compatible root-owned storage-bridge code first. Keep the bridge localhost-only and preserve signatures, replay checks and bounded diagnostics. Its actions may initialize/migrate assistant tables in the existing file.
4. Deploy compatible web/API. Assistant claim protocol 2 holds new work while an old worker remains installed. Allow active old work to finish before this cutover.
5. Update and start the assistant worker with protocol 2 after the web/API is available. The generation worker and owner-document routes are unchanged.
6. Verify a real completed streamed answer, stored answer equality, reopen/continue, Subjects primary/lesson citations, PDF navigation, and library/storage health. Do not equate test fixtures with model-generation or production verification.

After new chat writes, do not roll back to code that only reads the legacy JSON queue. Preserve the new tables and use a compatible reader/worker, or reconcile their writes before rollback. Backups remain on macserver under the existing owner-selected policy.

## Verification

Implementation uses the committed dependency/font bytes plus pinned PDF.js 6.3.289. The PDF proxy only constructs canonical arXiv resources from a saved paper or published lesson, validates redirect identity/origin, and limits the download to 32 MiB. The validated PDF is returned as a byte stream rather than one buffered response, following [Vercel response-size guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). PDF support assets come from allowlisted files in the pinned dependency. Production traces include public lesson/renderer assets and exclude private artifacts, database/runtime files and environment files.

Local tests cover legacy migration, isolation, idempotency, target validation, leases, cancellation, history pagination, backup/restore, signed bridge integration, citation rendering and safe PDF matching/fetching. Browser evidence is private under `.artifacts/assistant/`; it uses a temporary test database and no live model worker. Release approval evidence is separately maintained under `.artifacts/subjects/`.

### Local acceptance recorded

- Full suite: 227 tests passed initially; the merge with production main passes 236 tests, including Cloudflare authentication, shared quizzes, and the signed localhost storage bridge; type checking and the production webpack build passed.
- Independent Subjects visual approval renewed for every required beat and adjacent transition at both desktop widths in Light/Dark, including assistant-open layouts. Scientific content and parent digests remain unchanged. Publication audit: 100 lessons, 203 figures, 14 mechanisms, zero issues.
- Fresh production output traces: 25 traces inspected, no private artifacts, databases, runtime directories, or environment files; required Subjects and PDF assets included.
- Production-build browser checks used the real login flow with an ephemeral local key. Assistant/PDF endpoints rejected unauthenticated access; authenticated history, bundled PDF worker/text layer, Subjects math selection, and both desktop widths/themes passed with no page errors.
- Browser checks: exact 16px desktop panel gaps; new/reopened chats; selection popover and Command-E; reload; Subjects independent of Library; Light/Dark at 1440px/900px; no page errors.
- Real Mixtral PDF: selectable text, section citation jump to page 2, matched passage highlighting, PDF-selection popover, and no Command-E interception inside an editable field.
- Error states: History shows retrieval failures; closing restores launcher focus; failed PDF loading can be retried; selected equations retain TeX and confirmed failed submissions restore the question and quote.
- Fault injection: lost pre-save response blocks retries; successful reconciliation permits a deliberate retry with the same request ID; lost post-save response recovers one stored turn; background completion remains isolated and appears when reopening its chat.
- Existing backup script: restored temporary fixture database contains all conversation/turn/migration tables and passes SQLite integrity check. No production database or backup was accessed.
- Model output in browser tests is a deterministic fixture; live model completion and production release remain unverified until the authorized release.

## Merge and deployment preparation

The release integrates production main `9e26b85`, retaining the Cloudflare Access storage client, shared Library/Subjects typography, simplified lesson introductions, and shared quiz component. This combination passed a fresh production webpack build and independent visual approval for presentation `9a40d29e92683552c8243764a1e18206a35c886fbea601c5b98195267df283e3`; earlier assistant-only approval was not reused. The renewed review covered 536 beat captures, 424 adjacent state pairs, and 56 whole-viewport captures, with no unresolved findings. All 14 scientific scenes and parent content remain unchanged. Fresh output inspection covered 25 traces and 1,384 files, with no private files.

The administrator-run `scripts/install-assistant-storage-macserver.sh <stage> --install` updates only the isolated bridge sources. It checks the staged manifest, takes a macserver-only backup, rejects active legacy assistant work, rehearses migration on a disposable private restore, retains rollback code, and verifies signed status. Live migration waits for the new web/API's first assistant access. After cutover, `--verify` creates and restores another private snapshot and verifies retained legacy content, new tables, and Documents. No private backup is copied off macserver; losing that machine could destroy both the database and its backups.

The web project currently has no Git integration, so merging/pushing main and promoting a Vercel production deployment are separate steps. The active storage bridge requires an administrator password; ordinary worker access intentionally cannot modify its root-owned code or private database.

## Administration access clarification

The assistant release was merged to `main` as `a3bfaea`; production activation was then held until the compatible bridge update (now completed, as recorded below). The observed stopped Tailscale client prevented this Mac's configured `ssh macserver` route. It did not indicate a production storage outage: Vercel already uses Cloudflare Access/Tunnel. Reconnect that private SSH route only if using it for the administrator step, or use another established administration route. The bridge update still needs administrator authentication regardless of transport. See [current operations](current-operations.md).

## Production activation — October 2

The administrator installed the compatible isolated bridge and verified its signed status after a brief restart refusal. A macserver-only backup and disposable migration restore passed SQLite integrity, preserving all six retained legacy turns in two conversations and all five Documents. Installed bridge hashes match the reviewed source. Production web/API `eedecf6` was built remotely with committed `npm ci` and webpack, then promoted as `dpl_8rGsoyomvzBmRhCfo6iqSgmvGFrV`. The idle assistant worker was switched to protocol 2 at `/Users/agarwalaarush/Projects/AfterImage-assistant-20261002`; the generation worker and Cloudflare configuration were preserved.

An explicit Dia force refresh showed the new tabs and saved History. Real EAGLE-3 generation completed, reopening restored the exact visible answer, and a continuation completed while another chat was selected. The named section citation opened PDF page 4 and visibly highlighted the matching text. Anonymous assistant/PDF requests returned 401 and the production review route returned 404. The first deployment error scan was empty; worker error-log size did not increase.

The first live Subjects answer exposed shorthand `[lesson-s4]` instead of the renderer's `[source:lesson-s4]`. The assistant worker now explicitly requests the canonical syntax and normalizes shorthand only for lesson IDs present in that turn's evidence, preserving code samples, unknown IDs, and existing Markdown links. All 238 tests and type checking pass. A fresh live Subjects continuation now renders the named lesson citation, and clicking it scrolls the matching section heading to the viewport. DPO is absent from the seven-paper Library, confirming the lesson works independently. This is a worker-only correction; presentation fingerprints and saved historical answers are unchanged.

Live Light/Dark checks at 1440px and 900px passed; the wide panel has 16px above/below, and the narrow layout retains its existing overlay. Library loads all seven entries and Documents loads all five records. The follow-up ten-minute deployment error scan is empty.

The final post-cutover production backup restore is pending the administrator's `--verify` output. The earlier rehearsal verifies migration preservation but does not replace this final backup check. Backups remain exclusively on macserver.

## Focused reader follow-up

The global navigation now lives in a collapsible left rail. The logo reveals the expand/collapse control on hover and keyboard focus; named links and appearance controls remain available in both states. Expansion is browser-local and does not enter library state.

Paper view fills the viewport and hides the site footer. The PDF and assistant scroll independently, with contained overscroll. PDF page, search and citation navigation scroll only the PDF pane; switching back restores the saved prose scroll position. Automatic PDF width fitting follows sidebar and assistant resizing until the reader chooses a zoom level; clicking the zoom percentage restores width fitting. The shell and appearance controls are now part of the Subjects presentation fingerprint.

The focused reader layout passed independent review at 1440×900 and 900×900 in Light/Dark, with navigation expanded/collapsed and assistant open/closed: 1,072 beat frames, 848 adjacent comparisons, and 224 whole-viewport captures. Reviews bind presentation `70cba0072d2215a8ec56cb3b215c0d278255274f074d06be56d9583c8c5158df`; all 14 scientific scenes and parent bindings remain unchanged. Captures and browser audit facts remain private. Browser checks confirmed no outer scrolling or footer in Paper view, 16px panel gaps, contained PDF page navigation, width fitting after sidebar resizing, and restored prose scroll when returning to Lesson.
