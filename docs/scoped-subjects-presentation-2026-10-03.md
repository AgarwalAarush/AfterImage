# Recommendation and Subjects presentation boundaries

## Status

The recommendation UI source/style separation and compute-only scope checks are implemented locally. The existing Subjects publication gate remains unchanged and still withholds stale sidecars. No existing diagram acceptance, content, renderer, or production state has been rewritten. The proposed runtime gate change is a separate, unapplied patch pending explicit authorization and independent review.

## Why suggestions triggered diagram checks

The previous presentation manifest hashed all of `app.tsx` and `ui.css`, plus recommendation-only components that do not render in Subjects. This made an interest control change indistinguishable from a reader or diagram change. The shared notification behavior did genuinely change in the recommendation work: notices last longer, Undo persists, and notices can stack. That requires a current shared-workspace check, but should not by itself invalidate unchanged scientific diagrams.

## Implemented separation

Home, Library, Reading direction, Login, the shared frame, palette, context and notifications now have explicit owners. Recommendation styles use local CSS modules; `ui.css` is restored to the approved shared baseline. Frame markup is extracted byte-for-byte. The Subjects assistant reads the identical context contract directly. No interaction or paper state transition is intentionally changed by this extraction.

The new scope calculator produces separate core and shared-integration digests. It does not grant approval. Its historical witness reconstructs the exact previous complete manifest using current font bytes, checks unchanged reader/style/dependency files, and pins both the extracted frame/mark fragments and their complete wrappers/imports. The only normalized change is the literal assistant context import relocation. Any other relevant change prevents legacy equivalence.

The feature isolation audit follows the recommendation import closure, requires locally anchored module selectors, rejects global styles and unsupported imports, and fails closed on unsafe CSS constructs. This is a static project boundary check, not a sandbox for arbitrary JavaScript. Its policy bytes belong to the integration digest. Feature JavaScript and the discovered runtime import closure are conservatively bound to that integration digest, so imperative page effects cannot retain an old workspace receipt. The route inventory rejects unclassified presentation entries; new core dependencies must be explicitly classified. Recommendation changes remain outside the diagram core fingerprint, but can still require the smaller workspace review.

## Proposed publication boundary — not enabled

Retain the current parent, scientific, mathematical, semantic, renderer and per-beat/transition acceptance checks. A mechanism would additionally require either a matching new core presentation review or exact equality with the approved historical core, plus a fresh independent shared-workspace receipt bound to the current integration digest. Changed core content, geometry, reader typography, global styles or fonts would continue to need every affected diagram review.

The workspace receipt would require four desktop views (1440 × 900 and 900 × 900, Light/Dark), private screenshots, actual browser measurements, and a separate reviewer. Measurements must independently preserve core geometry and typography with notices hidden and stacked. Interaction review covers long text, persistent Undo, keyboard focus/dismissal, hover pausing and navigation. A small public receipt would contain hashes and reviewer identity only. Private audits and images remain excluded from source control, output traces and deployment uploads.

The development-only workspace harness renders the actual Subjects reader and notification provider against synthetic state. Its same-origin iframe header override exists only in development; the production DENY header remains and both review routes return 404. Browser measurements are observations, never automatic publication approval.

## Release boundary

Automatic approval review rejected applying the new legacy-acceptance path because its persistent gate change and blast radius require exact authorization and independent validation. The refactor and diagnostic groundwork do not bypass that decision. Continue to hold the release until the approved gate approach, current acceptance, ordinary production build, private-output trace audit and Dia smoke checks all pass. Preserve the newer production generation fixes and reviewed Library content when integrating this recommendation branch.

## Diagnostic verification

The native Dia harness was exercised at all four requested desktop width/theme combinations against synthetic local state. Thirteen recorded observations included hidden/stacked notice comparisons, keyboard focus from Undo to Dismiss, native keyboard dismissal, a pointer hover lasting more than eight seconds, and one Undo invocation. Independent inspection recomputed equal reader/diagram geometry, typography and bindings for every comparison. The long stress-test notice temporarily overlays lower content; dismissal restores access. These are diagnostic checks, not approval: source edits after capture make their integration bindings stale, and the saved native captures are JPEG previews rather than approval PNGs.

The normal production build still stops in the original publication precheck with 14 stale mechanism approvals, while all 100 lessons and 203 figures pass inventory. No direct compiler command bypassed that precheck. Fresh source-bound PNG/audit review and the normal build remain required after any authorized runtime change.

Final local verification: 380 tests, 379 passed, one skipped, zero failures; TypeScript and whitespace checks pass. Forty focused scope/isolation/import/route tests pass independently. Eleven workspace-verifier tests use synthetic fixtures. The existing gate files and all 14 published mechanism JSON files have no diff.

The exact unapplied runtime change is retained in [the review patch](proposals/subjects-approval-boundary.patch). Independent source review found the historical witness sound and identified import/route/trace gaps, which were fixed in the proposal and compute-only groundwork. The patch passes `git apply --check`; this checks applicability without changing repository code. Applying it is a separate authorization step, not proof of publication acceptance or permission to skip remaining release checks.
