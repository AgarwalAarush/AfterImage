# Preparation status and loading

The Expert Choice Routing reader showed a generic study-generation screen even though its notecard had already passed review. The live worker was active: its first visual review requested corrections and the second draft was running. Production library reads measured roughly one second during diagnosis; generation and independent review were the longer path.

The reader now shows a validated stored notecard and opening diagram as soon as they exist. A study supplement publishes only after its own source, geometry, and visual/quiz reviews pass. The reader keeps a compact preparation panel above the available content; no draft figures or raw model output are exposed. Existing reviewed content remains available during regeneration and failed supplement attempts.

Leased worker heartbeats report allowlisted stages for source extraction, drafting, desktop/mobile rendering, independent review, repair, and publishing. The worker records a last heartbeat and stage-change timestamp, and reports the revision number. The UI shows elapsed time, last activity, actual queue position, and a manual status check. It treats a missing timestamp as unconfirmed and a heartbeat older than 150 seconds as lost contact, without pretending to know a completion ETA. Legacy running workers derive their heartbeat from their existing 15-minute lease until the compatible API records a fresh one.

Public state omits job lease tokens, lease deadlines, raw job errors, and paper generation errors, including full browser exports. Detailed failures stay in private worker diagnostics. A reviewed notecard may be read while a failed study supplement is retried.

Documents routes render independently of the library snapshot; this removes the library-to-document request waterfall and permits document access during a library-read failure. Document requests and state mutations are bounded to 15 seconds. Uncertain writes are never replayed automatically. Slow loads show elapsed time and an explanation after four seconds, then an actionable retry on failure. Document reads abort on navigation and a failed initial shelf read does not masquerade as an empty shelf.

Bar charts label the common upper endpoint. Percentage units render on a fixed 0–100 axis, addressing the scale ambiguity that triggered the observed visual review repairs. Other units retain a zero baseline and an explicit endpoint. Source and visual review gates remain enabled.

Release order: ship the compatible web/API before replacing worker code. The storage bridge operations and database schema are unchanged; no root-owned bridge upgrade is needed. Let the current generation finish before restarting the regular worker so its leased work is preserved.

Validation: regression tests cover independently readable approved notecards, repair stages, stale and unknown worker presence, queue positions, public diagnostic removal, uncertain writes, and percentage chart geometry at both sizes. Browser acceptance must check the reader and Documents, plus loading/error recovery.
