# Production source reconciliation

## Observed drift

On October 6, the production custom-domain alias pointed to Vercel deployment `dpl_9Qu9oNH5zLjb8dMZ7LzieSiWuktZ` (`afterimage-liabos6xi-aarush-agarwals-projects.vercel.app`). The CLI upload was created October 3 at 15:46:20 Pacific and promoted at 15:48:17. Its metadata contained no Git commit. The project had no Vercel Git integration.

GitHub `main` was `515c0485ebd0f13a1eeb2b224630e663cb5b9818`, containing PR #14, merged October 3 at 19:52:47 Pacific. Production therefore preceded that merge. Comparing all 272 uploaded repository files with PR #13 commit `dc84e2e0879306793b1b42b44390e7ec35bcf3c7` found 264 exact matches. The eight differences were documentation, generated `next-env.d.ts`, and the five runtime files below. Those five also matched the still-uncommitted local renderer changes byte-for-byte. Two helpers had never been committed.

The earlier generation release record (`docs/generation-chart-cap-and-tests-2026-10-03.md` in the older local checkout, itself not previously committed) explicitly described these uncommitted web overlays. The committed [recommendation release record](scoped-subjects-presentation-2026-10-03.md#post-authorization-checks-and-live-compatibility) held deployment pending their preservation and Subjects acceptance. No merge or deployment in this investigation caused the drift.

## Reconciled source

The reconciliation starts from current `main`, preserving PR #14's recommendation, privacy and source ownership changes. Only the five live renderer files are copied from the dirty checkout, after matching their SHA-1 upload identifiers. No worker, storage, state, dependency, font or existing review bytes are copied or changed.

| File | SHA-256 of the exact live bytes |
| --- | --- |
| `src/lib/study.ts` | `d3d77af0cbac1f4ecb88a3680b2d36c4fdb542ee89eb69542a4b1913124aee1d` |
| `src/lib/scene-illustration.ts` | `432a994246e2c7dc83ebc1f1663e4ca5a6dc0c77d4eb78043c4dd1733d034d7f` |
| `src/lib/scene-illustration-svg.ts` | `5a1ba5a64a192331ec081f3b1ec256f5f6e982e486f776b503bb81ef4e93271e` |
| `src/lib/study-curve-svg.ts` | `3e6313e1bcbc78e1c5af9dd199d55acff9c575d3d5f80b3520476f14e0d4f63b` |
| `src/lib/scene-matrix-svg.ts` | `e14016ea9fb409b0c5909d7c9721271c6fa8fc5e4ac61f3e9f61ce6ffe02698e` |

These contracts support bounded adaptive bar comparisons, readable matrices and readable curves. Unversioned figures retain their prior rendering path. Generation remains an explicit reviewed workflow; stored Library content is not regenerated or migrated.

`scene-matrix-svg.ts` is now explicitly classified in the current Subjects core manifest. Its runtime imports are audited and its source is covered by the existing Subjects output-trace includes. Both changed scene files invalidate historical core equality. Historical baseline hashes, mechanism approvals and publication policies remain intact; fresh workspace acceptance cannot certify this changed core.

The previously approved suggestion-bar removal is preserved separately on `codex/remove-suggestion-refill-bar`. It is not part of this reconciliation.

## Verification and release hold

Regression coverage checks complete matrix cells/selections and labels, all curve points and full legends, bounded bar series, small positive axes and legacy version rejection. Publication tests use approved Git bytes in disposable historical fixtures and separately prove that the actual reconciled renderers remain withheld even with a matching synthetic workspace receipt. No synthetic receipt is written to repository content.

The reconciled source passes TypeScript, whitespace checks and all 64 focused renderer/publication tests. The full suite reports 396 tests: 395 passed, one existing opt-in skip and zero failures. Import/route/isolation audits bind all 126 current presentation sources, including the matrix helper; only the two expected scene files fail historical core equality. All five runtime hashes still match the live upload. Existing lesson/mechanism JSON, historical baseline, dependency lockfile, worker and storage code have no diff from current `main`.

The ordinary webpack build stops in its publication precheck: all 100 lessons and 203 figures pass, while all 14 mechanisms are withheld pending current complete approval. This was already a release hold on `main`; the reconciled core additionally requires fresh diagram acceptance. No compiler bypass, review rewrite or synthetic production receipt was used. The precheck stops before compilation, so no fresh production trace audit can be claimed.

Deployment stays paused. Before releasing, obtain current independent core and workspace acceptance in Dia, pass the ordinary production build and private-output trace audit, and verify authenticated desktop behavior. Keep the live generation-worker composition and compatible web-before-worker release order. Record a clean source commit and match the deployment's uploaded runtime bytes to that commit; never deploy another uncommitted renderer overlay.
