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

- Full suite: 227 tests passed, including the signed localhost storage bridge; type checking and the production webpack build passed.
- Independent Subjects visual approval renewed for every required beat and adjacent transition at both desktop widths in Light/Dark, including assistant-open layouts. Scientific content and parent digests remain unchanged. Publication audit: 100 lessons, 203 figures, 14 mechanisms, zero issues.
- Fresh production output traces: 25 traces inspected, no private artifacts, databases, runtime directories, or environment files; required Subjects and PDF assets included.
- Production-build browser checks used the real login flow with an ephemeral local key. Assistant/PDF endpoints rejected unauthenticated access; authenticated history, bundled PDF worker/text layer, Subjects math selection, and both desktop widths/themes passed with no page errors.
- Browser checks: exact 16px desktop panel gaps; new/reopened chats; selection popover and Command-E; reload; Subjects independent of Library; Light/Dark at 1440px/900px; no page errors.
- Real Mixtral PDF: selectable text, section citation jump to page 2, matched passage highlighting, PDF-selection popover, and no Command-E interception inside an editable field.
- Error states: History shows retrieval failures; closing restores launcher focus; failed PDF loading can be retried; selected equations retain TeX and confirmed failed submissions restore the question and quote.
- Fault injection: lost pre-save response blocks retries; successful reconciliation permits a deliberate retry with the same request ID; lost post-save response recovers one stored turn; background completion remains isolated and appears when reopening its chat.
- Existing backup script: restored temporary fixture database contains all conversation/turn/migration tables and passes SQLite integrity check. No production database or backup was accessed.
- Model output in browser tests is a deterministic fixture; live model completion and production release remain unverified until the authorized release.
