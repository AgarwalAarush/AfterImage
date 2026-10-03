# Library reliability: public cloud review handoff

This branch is a frozen input for a fresh independent review. The six shared-system fixes passed deterministic local validation; generated-content reliability, model acceptance and production behavior remain unverified. Review the implementation and evidence critically rather than adopting previous diagnoses.

## Snapshot and history

Repository: `AgarwalAarush/AfterImage`. Branch: `codex/library-reliability-cloud-review-2026-10-02`.

The branch preserves the evaluated checkout, based on `185087801753e6ac1601e57c1fb785fdb4b7d062`. Main was observed at `0e18dc7af23f3ec8f7e34687a4a7fcefdc67f4d7` during preparation; consult GitHub for the current main. Main has advanced independently. Do not merge or rebase during this review.

| Commit | Purpose | Manifest |
|---|---|---|
| `a06d3e21e528ad363f1e054de91bc3cd027150fe` | Exact 415-file evaluated source archive over the original base; includes preexisting uncommitted integration | `evaluated-source-manifest.json` |
| `34b26f3f7d6440d31e18125111aed9180d3aa1c7` | Exact 432-file implementation archive after the six fixes | `implemented-source-manifest.json` |
| Branch tip | Public saved-case fixtures, portable test paths, documentation, verification helper and branch deployment guard | `source-manifest.json` |

The first two commits reproduce archived bytes; the six-fix diff is `git diff a06d3e2 34b26f3`, also inventoried in `changes-from-evaluated.json`. The complete branch diff includes the earlier integration and must receive broader integration review before any future merge. Packaging changes no worker, library, renderer, dependency or font bytes. The current implementation digest remains `b835cab8087fc0faa6064cb57080257d4892d15d30eccddc2a8623aa79fe6329`; evaluated digest was `d1deacda9ae56399fcd63d22fcd3859e3036bad9597a4dac0d8cb79cc25d6e7d`. The final manifest excludes itself to avoid a recursive hash and covers exported source, fixtures and evidence. Pin the branch tip SHA in the cloud job before review.

The original local worktree remains detached with its original index. Private artifacts and all 1,532 original evaluation files remain preserved locally. Neither `.artifacts`, environment files, SQLite, assistant runtime, screenshots, production state nor credentials are uploaded. The owner explicitly authorized public paper/candidate/review JSON evidence for this handoff; runtime privacy gates are unchanged. `vercel.json` disables Git deployments for `codex/library-reliability-*`; do not remove that guard or deploy this review branch.

## Confirmed changes and review targets

| Stage | Confirmed shared failure and change | Principal files / regressions |
|---|---|---|
| 1 | Duplicate merging could discard supported proof; canonical obligations precede adjudication and receipts bind current candidate/input, ordered evidence, decision and scope | `worker/{repair-controller,evidence,repair-model}.ts`; `tests/canonical-evidence.test.ts` |
| 2 | Adjudication and scheduling used different obligation sets; both use the canonical new/unresolved union and preserve supported corrections beside unrelated disputes | `worker/component-pipeline.ts`; `tests/{component-worklist,stale-adjudication}.test.ts` |
| 3 | Whole-kit teaching leakage, omitted-context ambiguity and illegal correction targets; component owners, three-way evidence availability and legal native target promotion preserve dependencies | `worker/{component-contracts,component-pipeline,repair-model}.ts`; `tests/{component-contracts,component-target-boundaries}.test.ts` |
| 4 | Handled exceptions lost terminal partial results or newly computed obligations; coherent checkpoints retain ledgers, decisions, ordered context and reservations; recovery fails closed; harness aggregates only current valid publication outcomes | `worker/{kit-checkpoint,component-pipeline,model-execution}.ts`, `scripts/library-evaluation-results.ts`; recovery, evaluation-results/dependencies and model-execution tests |
| 5 | Publication could succeed before the local completion checkpoint; current-job durable receipts reconcile under the reclaimed lease before further model/status work | `worker/{index,component-pipeline}.ts`; `tests/{kit-recovery,component-worker-api}.test.ts` |
| 6 | Boolean source approval conflated author/derived/implementation relations; relation-scoped independent provenance, supplied-only citations and exact candidate spans distinguish genuine scientific defects from quote wrappers | `worker/{equation-provenance,exact-spans,component-pipeline,repair-model}.ts`, `scripts/evaluate-triroute-cost.ts`; `tests/equation-provenance.test.ts` |

See `../library-reliability-implementation-2026-10-02.md` for detailed mechanisms and rejected hypotheses, and `../library-components-2026-10-02.md` for API/worker boundaries. Those historical implementation notes contain local artifact references; this handoff replaces them for portable review. `evidence-manifest.json` maps exported red/green logs to both exported and original artifact hashes (only trailing whitespace and terminal blank lines are normalized; original logs stay unchanged); corrected step-4 and step-5 baselines are provided because their first mock attempts were invalid causal evidence. Counts in focused logs overlap and are not acceptance totals.

`tests/fixtures/library-reliability/manifest.json` maps fifteen exported JSON cases to their original hashes and selected fields. QLoRA, MegaBlocks and TriRoute tests now require committed fixtures instead of silently skipping absent ignored artifacts. FlashAttention/Mamba contracts also use deterministic native examples. Exported evidence is the subset needed for deterministic review, not the entire raw evaluation or rendered figure archive. Do not claim an independent visual or historical process audit from this subset.

## Validation and cloud setup

The completed implementation passed **405/405 tests**, zero failures/skips/cancellations, TypeScript and diff checks. `evidence/implementation-*` records that validation. `evidence/cloud-*` records a fresh full rerun after portable fixture packaging: **405/405 full-suite tests and 106/106 focused tests**, with zero failures/skips/cancellations; TypeScript and diff checks passed. Locally tested Node: `v26.5.1`. Use the committed lockfile with `npm ci`; do not update dependencies. No production or model credentials are needed for this review. Running tests uses temporary local SQLite and stubbed model failures; it does not run a generation evaluation.

Use these commands after confirming the pinned branch tip:

```sh
npm ci
node scripts/verify-library-cloud-handoff.mjs
node --import tsx --test tests/canonical-evidence.test.ts tests/component-worklist.test.ts tests/stale-adjudication.test.ts tests/component-contracts.test.ts tests/component-target-boundaries.test.ts tests/kit-recovery.test.ts tests/library-evaluation-results.test.ts tests/library-evaluation-dependencies.test.ts tests/equation-provenance.test.ts tests/component-worker-api.test.ts
npm test
npm run typecheck
git diff --check
```

If the cloud Node/native dependency platform cannot execute a check, report its exact limitation without rewriting the lockfile or counting it as passed. Review source regardless. Do not start workers, a development server, evaluation scripts, the probe executable or production services. Do not use a production `.env`.

## Limits, contradictory evidence and next acceptance

The frozen six-paper evaluation accepted **zero full kits**. Five explanations passed worker gates; TriRoute's independent probe still rejected attribution despite correct 0/120/72 costs. Mamba passed its opening diagram/quiz while its study figure failed. Useful accepted components existed alongside failures, establishing the need for recovery rather than proving overall quality. Panel deletion, gate-limit loss and stale dependent publication were correctly rejected and remain invalid. A proposed private complete-text checkpoint rejection was rejected after verifying both callers already use the relaxed private candidate schema. Receipts certify identity/scope, not scientific truth or mathematical equivalence.

Four recorded ten-minute timeouts and an interrupted vanished runner remain execution failures with unresolved external causes. A missing harness result did not demonstrate production data loss. Handled-failure serialization cannot survive every process kill or unwritable filesystem; absent/corrupt same-job recovery must fail closed without fresh allowances. Explicit new jobs and reclaimed same-job work intentionally have different budget contracts.

Four opening repairs, two supplement repairs, one representation fallback per stage and existing bounded evidence/capacity allowances are unchanged. All scientific/source/geometry/visual/quiz/dependency/publication/privacy gates remain. No new model run, generated-content repair, production mutation, deployment or worker restart was performed. The public branch is handoff work, not a release.

First return an evidence-backed independent implementation review. Then, only after separately authorized fixes and a new freeze, replay MegaBlocks, TriRoute, QLoRA, FlashAttention, LoRA and Mamba as exposed regression cases under fixed acceptance criteria. Preserve untouched RetNet, GQA and Switch for subsequent acceptance. Full generated scientific/teaching/visual quality needs real evaluation. Independent desktop visual acceptance and actual worker/reader recovery verification remain separate; do not substitute cloud unit tests for them. Integrate with current main only after review and acceptance; release must preserve compatible web/API-before-worker order.
