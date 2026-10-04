# Recommendation and Subjects presentation boundaries

## Status

The owner explicitly authorized the reviewed runtime patch on October 3, and it is now applied. Recommendation UI source/style separation, scoped core/integration checks and the shared-workspace receipt gate are implemented. No existing diagram acceptance, content, renderer or production state has been rewritten. Publication remains withheld until a current independent workspace receipt exists; release also requires preserving newer live Library rendering contracts.

## Why suggestions triggered diagram checks

The previous presentation manifest hashed all of `app.tsx` and `ui.css`, plus recommendation-only components that do not render in Subjects. This made an interest control change indistinguishable from a reader or diagram change. The shared notification behavior did genuinely change in the recommendation work: notices last longer, Undo persists, and notices can stack. That requires a current shared-workspace check, but should not by itself invalidate unchanged scientific diagrams.

## Implemented separation

Home, Library, Reading direction, Login, the shared frame, palette, context and notifications now have explicit owners. Recommendation styles use local CSS modules; `ui.css` is restored to the approved shared baseline. Frame markup is extracted byte-for-byte. The Subjects assistant reads the identical context contract directly. No interaction or paper state transition is intentionally changed by this extraction.

The new scope calculator produces separate core and shared-integration digests. It does not grant approval. Its historical witness reconstructs the exact previous complete manifest using current font bytes, checks unchanged reader/style/dependency files, and pins both the extracted frame/mark fragments and their complete wrappers/imports. The only normalized change is the literal assistant context import relocation. Any other relevant change prevents legacy equivalence.

The feature isolation audit follows the recommendation import closure, requires locally anchored module selectors, rejects global styles and unsupported imports, and fails closed on unsafe CSS constructs. This is a static project boundary check, not a sandbox for arbitrary JavaScript. Its policy bytes belong to the integration digest. Feature JavaScript and the discovered runtime import closure are conservatively bound to that integration digest, so imperative page effects cannot retain an old workspace receipt. The route inventory rejects unclassified presentation entries; new core dependencies must be explicitly classified. Recommendation changes remain outside the diagram core fingerprint, but can still require the smaller workspace review.

## Authorized publication boundary

Retain the current parent, scientific, mathematical, semantic, renderer and per-beat/transition acceptance checks. A mechanism additionally requires either a matching new core presentation review or exact equality with the approved historical core, plus a fresh independent shared-workspace receipt bound to the current integration digest. Changed core content, geometry, reader typography, global styles or fonts would continue to need every affected diagram review.

The workspace receipt requires four desktop views (1440 × 900 and 900 × 900, Light/Dark), private screenshots, actual browser measurements, and a separate reviewer. Measurements must independently preserve core geometry and typography with notices hidden and stacked. Interaction review covers long text, persistent Undo, keyboard focus/dismissal, hover pausing and navigation. A small public receipt contains hashes and reviewer identity only. Private audits and images remain excluded from source control, output traces and deployment uploads.

The development-only workspace harness renders the actual Subjects reader and notification provider against synthetic state. Its same-origin iframe header override exists only in development; the production DENY header remains and both review routes return 404. Browser measurements are observations, never automatic publication approval.

## Release boundary

Automatic approval review initially rejected the legacy-acceptance path until explicit authorization and independent validation. The owner subsequently approved the exact reviewed patch; it was applied through an approved tool call. Continue to hold release until current acceptance, the ordinary production build, private-output trace audit and Dia smoke checks all pass. Preserve the newer production generation fixes and reviewed Library content when integrating this recommendation branch.

## Diagnostic verification

The native Dia harness was exercised at all four requested desktop width/theme combinations against synthetic local state. Thirteen recorded observations included hidden/stacked notice comparisons, keyboard focus from Undo to Dismiss, native keyboard dismissal, a pointer hover lasting more than eight seconds, and one Undo invocation. Independent inspection recomputed equal reader/diagram geometry, typography and bindings for every comparison. The long stress-test notice temporarily overlays lower content; dismissal restores access. These are diagnostic checks, not approval: source edits after capture make their integration bindings stale, and the saved native captures are JPEG previews rather than approval PNGs.

The normal production build still stops in the original publication precheck with 14 stale mechanism approvals, while all 100 lessons and 203 figures pass inventory. No direct compiler command bypassed that precheck. Fresh source-bound PNG/audit review and the normal build remain required after any authorized runtime change.

Final local verification: 380 tests, 379 passed, one skipped, zero failures; TypeScript and whitespace checks pass. Forty focused scope/isolation/import/route tests pass independently. Eleven workspace-verifier tests use synthetic fixtures. At that pre-authorization checkpoint, the gate files and all 14 mechanism JSON files had no diff. The applied gate is now changed; all 14 stored mechanism JSON files remain untouched.

The exact authorized runtime change is retained as a historical [review patch](proposals/subjects-approval-boundary.patch); it has now been applied and must not be applied again. Independent source review found the historical witness sound and identified import/route/trace gaps, which were fixed in the proposal and compute-only groundwork. The patch passes `git apply --check`; this checks applicability without changing repository code. Applying it is a separate authorization step, not proof of publication acceptance or permission to skip remaining release checks.

## Post-authorization checks and live compatibility

The full suite now has 388 tests: 387 pass, one opt-in skip, zero failures; TypeScript passes. Eight actual publication-path assertions use disposable public-source/font fixtures and synthetic receipts. Missing, malformed and stale workspace receipts reject. Exact historical core plus matching workspace receipt passes without rewriting existing mechanism reviews. Changed core or font bytes reject the legacy path even with a newly matching workspace receipt. Parent/content/renderer identity, beat/transition count, semantic policy, source, math and ownership checks remain enforced.

Fresh Dia captures were taken at all four desktop view/theme combinations and the native harness reported unchanged reader geometry with hidden versus stacked notices. Final interaction/audit export and independent acceptance are pending because Dia switched to another foreground surface twice. No unrelated surface was inspected after the guard detected that change; automatic approval review also rejected reading it. A focused local review window was requested. No public workspace receipt has been created.

Live release verification found Vercel deployment `dpl_9Qu9oNH5zLjb8dMZ7LzieSiWuktZ` includes newer Library bar/matrix/curve support outside the main-branch commit. The exact live bytes of `study.ts`, `scene-illustration.ts`, `scene-illustration-svg.ts`, `study-curve-svg.ts` and `scene-matrix-svg.ts` are preserved in an inactive local release overlay. Web package/lock bytes match this branch. These files must not be rolled back when deploying recommendations; two intersect the current core manifest and the new matrix import needs classification, so the approved equality path cannot simply certify the resulting changed core.

The active generation worker is `generation-v22`, with its original dependency directory owned by `generation-v14`. A separate inactive overlay retains its generation/study/launcher/main function bytes and only overlays recommendation capability/dispatch and dependencies. It must be tested against exact production dependencies and activated only after compatible web handling and a confirmed drain.

Automatic approval review rejected retrieving the production owner key from Vercel after a stale local key returned 401. No credential workaround or production mutation was attempted. Read live queue/policy through an already authorized session, or obtain specific approval for any still-required credential access. Keep the new privacy projection on rollback: the previous API does not strip the new private ledger, so rollback should disable learning on a compatible API rather than restore that older whole deployment.
