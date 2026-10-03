# Recommendation learning and quality

Implementation branch: `codex/recommendation-learning`. Production release is held pending renewed Subjects visual acceptance in Dia. No production Library content, generation job, worker, bridge, provider or database has been changed by this work.

## State and privacy

State schema remains 2 and the existing signed storage transport remains unchanged. `preferences` is an additive private version-1 ledger. Its revision binds each recommendation claim. Confirmed saves, current Reading/Read statuses, retained preparation jobs and existing feedback are backfilled with deterministic event identities. Missing historical reading or preparation is not fabricated. Existing feedback remains compatible; the ledger retains older choices when a prompt window or legacy feedback collection no longer contains them.

Owner-stated Useful choices for Kimi Linear (`2510.26692`) and DeepSeek-V3 (`2412.19437`) are explicit seed events. World models are an independent editable interest. SeqTopK uncertainty is not a rejection. No model is trained.

Useful is +4; Reading/Read +2; first preparation +1.5; Save +1; engaged reading +0.25; dismissal -0.5. The strongest implicit evidence per paper wins rather than accumulating every milestone. Passive evidence is capped at +0.5. Implicit evidence has a 90-day half-life; latest explicit ratings persist until changed. Save for later and Archived are organizational choices. Already know it excludes without dislike; Too advanced hides that paper while requesting a prerequisite, without dislike; a newer Useful choice restores eligibility.

Browser state and full exports omit the ledger, feature cache, raw engagement, job profile bindings and recommendation receipts. They expose only the editable interest summary and existing compatible paper/feedback state. Private receipts retain policy/revision, interest inputs, aggregate preference signals, canonical metadata digests, relevance/next-step/citation inputs, bounded adjustments and grounding verdicts. No raw diagnostics enter reader polling.

## Engaged reading and choices

Only the Library paper reader installs the engagement hook. Subjects, documents, external links, previews, prefetch, quiz results, quick opens and worker retries do not record engagement. A browser-local per-paper/day accumulator uses monotonic timing only while visible and focused. Navigation, page hiding, blur and reload persist/pause it. At 45 cumulative seconds it sends one UUID action. The server independently deduplicates by event and paper/day and returns a small acknowledgement; this never queues discovery, creates a Library entry or starts generation. A write is marked submitted before transport and uncertain outcomes are never replayed automatically. A failed write can lose that day's small passive signal.

The engaged-reading switch stops new records and removes past passive evidence from ranking while preserving recorded choices for rollback. Learning is initially disabled by the private rollout policy. Interest More/Normal/Less/Off settings are explicit choices and operate independently of passive tracking.

Suggestions and the paper reader reuse one feedback menu. Dismiss is one click. Its eight-second Undo retracts only the latest matching event, restores its prior visible suggestion when eligible, and leaves newer choices intact. Duplicate UUID feedback does not create another rating. Eligible unconsumed cards are retained during refills.

## Retrieval and ranking

Canonical title/abstract features replace unreliable imported tags. Features are deterministic, auditable interest/mechanism matches, bound to the metadata and policy digest; changes invalidate their cache and profile revision. They are a bounded first vocabulary rather than general semantic embeddings. Dismissals transfer only through matching mechanism features, never a generated recommendation reason. The NetOps/Hi-MoE audit failure cannot create MoE dislike.

Each active interest receives an independent query; world models receive established and recent lanes. An assessor scores a candidate against its best matching interest, without requiring an MoE connection. Disabled interests cannot be rescued through the general direction fallback. Unknown interests may qualify only against a concrete written direction. Exact valid candidate IDs are required, duplicate assessments cannot produce duplicate picks, and relevance >=0.6 is checked before learning.

Ranking retains 70% relevance, 10% next-step usefulness and 20% verified popularity. Every assessed candidate receives a canonical DOI lookup through OpenAlex, with one title-search fallback for missing aliases, bound to both canonical title and unambiguous arXiv identity. Unknown coverage remains null and earns no bonus; it is not a claim of zero citations or scientific quality. Learned plus manual ranking adjustments are capped at +/-0.05. A soft tie-break compares closely scored mechanisms with retained and newly selected cards; no world-model, adjacent or recent slot is reserved. Ranking uses actual vacancies, so one-slot refills select their replacement directly.

Selected reasons and focuses receive a separate structured review against canonical title/abstract only. Identity, reason and focus must each pass; source excerpts must match exact continuous canonical passages (allowing whitespace/Unicode normalization). One bounded repair is reviewed independently again; a still-invalid candidate is omitted. Abstract-only grounding cannot establish claims absent from the abstract.

Publication rechecks exclusions and the claimed preference revision. A changed profile preserves eligible existing cards and coalesces one follow-up instead of publishing stale selections. Engagement itself never starts that follow-up; a running discovery notices its revision change at completion. Generation and study priority/leases/publication gates remain unchanged.

## Validation

Automated regressions cover signal strengths, decay, duplicate actions, latest rating/Undo, durable older feedback, opt-out, focus/reload timing, privacy of ordinary/full exports, disabled/irrelevant admission, mechanism-specific rejection, independent world-model fit, retained-card one-slot selection, direct citation identity, repair bounds, and stale-profile follow-up.

`node --import tsx scripts/evaluate-recommendations.ts --run` runs 12 bounded model trials using synthetic profiles and committed public metadata only. Three trials start with no candidate papers and ignore scout ID seeds, testing retrieval rather than seeded inclusion. Other cases cover mixed interests, two one-slot refills, rejection, known/advanced choices, changing tastes and a revision change. Private evidence is under ignored `.artifacts/recommendation-learning/`; no owner state, environment file, API cookie or storage is loaded. The script checks exclusions, duplicate picks, actual vacancies and absence of implicit Library/generation writes. Development fixtures are not evidence of owner-specific long-term satisfaction.

Measured on October 3: typecheck passes; the full suite has 288 passing tests and one existing opt-in skip. All 12 public trial scenarios pass; the prerequisite scenario also passes a bounded rerun after the final Too advanced exclusion fix. The final scenario set selected 32 papers across refresh/refill runs, with no surviving identity/claim mismatches, excluded or duplicate picks, or implicit generation. Seven selected reasons/focuses required their bounded independent repair review. These are bounded grounding and behavior checks, not proof of long-term reading satisfaction.

All 144 assessed citation inputs in that trial set remain explicitly unknown because OpenAlex's anonymous shared daily budget was exhausted (HTTP 429). Canonical DOI lookup initially returned real metadata for three public papers, then also hit the quota; no invented counts or popularity bonuses were substituted. Deterministic tests verify canonical title/identity matching, DOI/search failure bounds and popularity ranking with verified inputs. The existing optional server-only `OPENALEX_API_KEY` support is preserved; no account, key or production environment was created or changed. Production smoke checks must confirm actual citation coverage before enabling the policy.

Dia confirms feedback choices, one-click dismissal/Undo, interest More/Off updates, the reading-learning switch, and Too advanced removing its card while requesting prerequisites. Focused cumulative reading across reload records one event; quick/background opens record none and engagement changes neither Library entries nor the existing job count. The local browser tab and temporary server were closed after verification.

Dia verification uses disposable SQLite at `/private/tmp/afterimage-learning-dia.sqlite` and localhost port 3167. The production prebuild intentionally rejects all 14 mechanisms with stale presentation approval after shared shell/UI changes. Subjects content/scene, renderer and dependency bytes remain unchanged. Dia's currently supported native interface lacks DOM font-outline audit and exact viewport automation; the available browser connectors are MCP Apps and the in-app browser, which the owner forbids as a fallback. Do not relabel historical screenshots/receipts as current acceptance, remove reviewed mechanisms to pass the build, or weaken fingerprints.

The final prebuild preserves renderer digest `83a7df171d30c59ad1eef731009edc62331803b8dcba7d6983b92d72bf27ea4a` and reviewed lock digest `4551ca961c528d4a4edb033d63dfef70bfe09ab1dda04306493ee59bd45abc2d`; the changed shared UI has presentation digest `b65b4f90b89c329e8dd5e1ddecbadcba9a16bdb855cb32ded5123158a5a4762a`. Historical approvals are retained but withheld by the current fingerprint check. Webpack compilation and fresh production trace acceptance remain pending the publication gate.

## Release and rollback

1. Complete all 12 trials and renew fingerprint-bound independent Subjects visual review in **Dia only**, at 1440/900 in Light/Dark, every beat and adjacent transition. Hold release if unavailable.
2. Run the normal production build, then audit fresh output traces and uploads for private paths. Preserve reviewed lockfile/font bytes and Cloudflare Access-capable storage transport.
3. Release compatible web/API with `preferences.enabled` still false. Check authenticated state/privacy, feedback/Undo, small engagement acknowledgements and stale-result handling.
4. Inspect the latest active production worker and let active generation/study finish. Overlay only this discovery code and its shared types/preferences/recommendations dependencies onto that exact worker release; never deploy this branch's older generation composition over newer production fixes. Verify unchanged generation-function/module bytes and compatible web/API before switching.
5. Verify reviewed discovery receipts, actual refill behavior and desktop routes; confirm verified citation coverage as well as graceful unknown handling; then owner-authenticated `POST /api/state` with `{action:"learning-policy",enabled:true}` enables learning. Do not automatically generate or regenerate Library content.

Rollback uses the same authenticated action with `enabled:false` and retains the ledger, explicit choices and reviewed Library. Drain active work before a worker rollback. Never restore stale SQLite/Supabase state. This implementation adds no bridge action or database migration.
