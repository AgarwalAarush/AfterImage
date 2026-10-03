# Repair-system audit and improvement plan

Date: October 1, 2026. Status: investigation and proposed implementation; no generation logic, production jobs, deployment, or worker configuration changed.

## Diagnosis

The pipeline detects real defects, but its repair orchestration does not reliably converge. It can request changes that the schema or renderer cannot express, rewrite more content than the defect requires, and discover existing defects late in a shared four-repair budget. Increasing that budget alone would amplify cost and churn.

Repairs should be edits by default. Replacing an example, representation, or entire artifact is a separately justified fallback when the existing structure cannot satisfy source-supported requirements. Accepted reviews are evidence to preserve and check, not permission to freeze a previously missed error.

### Evidence and scope

The audit inspected the two October 1 production MegaBlocks runs, their five candidates, technical and visual findings, and the active worker. The latest job was `274bcc7a-bbfc-4f5d-8588-6194c33382a3`, rejected around 6:55 PM Pacific; the earlier job was `0d9c9583-ed59-4083-b368-31bac010080f`, rejected around 5:22 PM. Findings came from the worker's private generated review artifacts; no SQLite database or backup was copied.

SHA-256 comparisons confirmed that this checkout and the active worker have identical contents for `worker/index.ts`, `worker/quality.ts`, `worker/generation-schema.ts`, `worker/diagram-review.ts`, `src/lib/scene-allocation-svg.ts`, and `src/lib/scene-illustration.ts`. These findings concern the deployed implementation, rather than a presumed version mismatch. They do not establish population-wide failure rates.

The latest run progressed as follows:

| Candidate | Blocking finding | Next action |
| --- | --- | --- |
| 0 | Missing SDD/DSD computation equations; allocation lengths inconsistent with a common block size | Repair selected recall fields and the scene |
| 1 | Unit label ends “token slot; pairs form a” | Regenerate the scene |
| 2 | Mechanism ends mid-sentence; major prose claims lack adjacent source identifiers | Rewrite the entire recall |
| 3 | Unit label still ends “token slots; each pair =”; block grouping is not visible | Regenerate the scene |
| 4 | Capacity equation confuses tokens with routed assignments; padding equation lacks derived-equation disclosure | Reject at the limit |

The capacity definition was wrong from candidate 0, and the block-rounding disclosure was already missing. Neither originated in the final scene repair. Technical reviews 1, 2, and 3 passed notation despite these problems. The final candidate never reached a final visual review, so its technical diagram pass must not be described as full diagram approval.

## Findings

### 1. Planning and review can require an infeasible representation

`generate()` calls the planner before assembling the detailed layout contract. The planner receives general vocabulary guidance, but no machine-checked panel capacities or concrete example contract. `validateMechanismPlan()` checks source scope, citations, essential math, and abstract-only disclosure; it does not check example sizes or whether the chosen visible proof is representable.

The earlier run used eight token identities while the routing panel supports only six. The reviewer repeatedly requested all eight in that panel. The latest plan required outlined two-slot blocks nested inside expert regions, but the allocation schema has only groups, capacity, and items. The renderer draws independent cells without a declared block size or nested boundary.

Fix: derive a capability description from the actual supported schemas/renderers and give the same description to planning, generation, review, and repair. Preflight a structured illustrative example before drafting prose: identities, assignments, units, capacities, illustrative block size, and the intended comparison. Verify bounds, arithmetic, and representability. Where the scientific lesson needs an unsupported primitive, classify the failure as a renderer capability gap; select an honest alternative or stop with that diagnosis. Do not ask another content rewrite to invent unsupported geometry.

### 2. Reviewer repair instructions are not checked against field limits

The allocation unit permits 24 characters. “token slots; each pair = one illustrative block” has 47 characters. The repair output instead contained the incomplete 24-character phrase “token slots; each pair =”. The source value itself was incomplete; the renderer did not cut off that sentence. A final scene repair even emitted a mixed-language unit label, “2-slot illustrative блок”. This illustrates the pressure to satisfy a hard text bound without an adequate edit strategy.

Fix: each text defect must identify the field, its bound, and a feasible correction. Keep a short unit such as “token slots” or “2-slot blocks”; place the full explanation in the existing caption. Revalidate those edited strings and their rendered views. Preserve geometry and relationships when repairing text. Avoid generic rules that reject all mathematical labels ending in punctuation: such labels can be valid notation, so completeness checks need context.

### 3. Repair targeting is too coarse

There is a useful beginning of edit behavior: selected recall fields are patched into the prior recall, and caption-only repairs preserve illustration data. But visual targets are selected through free-text location regexes. A unit-label defect falls through to whole-scene regeneration. `recallRepairFields()` maps notation to mechanism, all equations, and the walkthrough; scope or unclassified findings return no field restriction and permit a whole-recall rewrite.

In the latest run, the scope repair changed seven recall fields, including equations and the walkthrough. That finding included both a truncated sentence and citation placement, so several prose edits were legitimate. Rewriting equation notation and the walkthrough was unnecessary churn; the audit does not claim those changes introduced the final capacity error, which already existed.

Fix: use structured defects with a stable ID, owner, candidate path/object ID, source evidence, constraints, acceptance condition, and dependencies. Build an allowlisted edit schema from the exact affected paths. Apply replacement operations with a preimage check; reject unexpected paths and preserve everything outside the allowed edit/dependency closure. For example, edit one equation explanation, one panel unit, or a cited prose passage. A source-definition correction may legitimately require coordinated edits in an equation, prose, and example; include those explicitly rather than freezing inconsistencies.

Panel/equation identities used by the controller can initially live in private worker metadata. Adding IDs to stored/public schemas requires a separately compatible release.

### 4. Repair history is a prompt, not a verified defect ledger

The loop appends prose findings to the next repair prompt. It does not record stable unresolved/resolved defect identities, check whether the targeted field changed, or establish whether the requested correction actually happened. A replacement automatically becomes the next candidate. There is no explicit rejection of an unchanged repair, unrelated edits, or a representation cycling through previously failed states.

Fix: retain the prior candidate and its hashes. Validate the patch, changed paths, local acceptance conditions, and affected invariants before adopting it. Track open, resolved, recurring, and disputed findings. Do not resolve a defect merely because the model says it is fixed or a later reviewer omits it. Source or visual findings need an explicit verification pass on the relevant current content. A no-op must not trigger another blind rewrite. Detect repeated candidate/defect fingerprints and permit one bounded replan or representation change with an explicit reason within the existing repair budget; otherwise stop with the unresolved diagnosis. Keep the existing bounded repair ceiling.

### 5. Existing errors are discovered late because review is serial and inconsistent

Visual review runs only after every technical check passes. Technical review is a fresh broad call each time and has no structured record of exact prior obligations. This gives a sequence of new blockers rather than a complete initial diagnosis. Positive category-level prose can overlook an individual equation's symbol definition or falsely imply every equation includes provenance disclosure.

Fix: after parsing and deterministic safety checks, collect technical and visual findings for the same renderable candidate, even if its technical review fails. Do not render malformed or unsafe content. Give technical review an explicit equation-by-equation symbol and provenance checklist with result passages and supporting source excerpts. Positive findings should identify what was checked, not only a generic category verdict. Reconcile contradictory reviews against the actual source; never use majority voting to waive a real defect. Separate visual/layout feedback from the technical review's full-coverage responsibilities while retaining cross-consistency checks and a complete final source/technical/geometry/visual review.

Final reviews bind to the candidate, sources, schema, renderer, font/view settings, and rubric fingerprints. Reuse unchanged-component evidence for repair guidance, but do not publish based on stale approvals.

### 6. Failure ownership is blurred

A scientific inconsistency, a bad plan, a text edit, a deterministic renderer limitation, and a model execution interruption can all end in the generic “notecard did not pass” outcome. The content model cannot add a renderer feature or fix a transport problem. JSON/schema parsing of a model step also occurs outside much of the candidate-validation repair handling, so malformed model output can terminate a job without a structured repair classification.

Fix: classify outcomes as content, plan/representation, renderer capability, schema/format, or execution. Content repairs edit semantic data; geometry changes remain renderer-owned. Received malformed output can undergo a narrowly bounded format repair if safely recoverable, without inventing content. Execution failures retain their separate diagnosis; do not replay uncertain mutations or blindly retry timed-out model invocations. Keep details in private diagnostics and expose only appropriate allowlisted milestones/status.

### 7. The study repair path is even broader

`generateStudy()` passes its prior pack and repair notes into another generation of the complete study pack on each attempt. It has three candidates and no figure/question patch controller. One bad caption or distractor can therefore regenerate unrelated reviewed figures and quiz material.

Fix: apply the same defect/path/edit machinery to figure IDs and quiz IDs. Preserve unaffected figures/questions; explicitly include dependent answer explanations, options, and correct-answer indices when a quiz repair changes them. Revalidate the entire final supplement and keep its existing source, geometry, and visual/quiz publication gates.

### 8. Tests verify pieces, not convergence

The current quality tests cover citation restrictions, field-selection helpers, gating, caption schema shape, and view targeting. They do not exercise `generate()` as an injected multi-round state machine. Thus helper tests can pass while production cycles, rewrites unrelated content, or misses a repeated error. The existing test named “targeted recall repairs retain fields” checks a manually merged evidence patch, not a live scope-repair sequence.

Fix: extract the repair controller from model execution. Use injected deterministic reviewer/model responses and renderer adapters to replay the observed failure sequences. Then evaluate actual model behavior on a fixed set and held-out papers. A controller replay establishes orchestration behavior; it does not establish model or scientific quality.

## Implementation order

1. **Worker-only edit controller.** Extract candidate review/repair orchestration; add structured defects, path-limited patch schemas, preimage checks, candidate snapshots, explicit defect verification, and private outcome reporting. Replace string-prefix/regex routing where structured targets are available. Include captions, units, individual equation explanations, and scoped prose corrections. Keep four repairs, all publication gates, and existing public schemas.
2. **Capability preflight and shared example contract.** Supply actual bounds to the planner and reviewers; validate example identity/count/arithmetic consistency and detect unsupported visible proofs. Store source-backed symbol definitions and source-versus-derived equation provenance in private generation metadata. This is targeted evidence for model review, not an automatic proof of scientific correctness.
3. **Narrow renderer extension.** Add a bounded illustrative block-size declaration to allocation panels, with renderer-drawn nested boundaries, deterministic capacity/padding checks, and explicit illustrative-versus-physical dimensions. Keep one expert as one region; splitting it into unrelated groups must not masquerade as nested geometry. Retain legacy rendering for stored scenes. Ship compatible web/API validation/rendering before the updated worker. No blanket expansion of every panel bound is required.
4. **Review scheduling and study reuse.** Collect eligible findings earlier, enforce explicit equation checks, and reuse the edit controller for supplements. Perform a fresh complete final review after the last adopted edit.
5. **Evaluate and release.** Replay the two MegaBlocks runs and the other concrete failures before fresh evaluations. Measure target-defect resolution, unrelated-content change rate, repeated-defect rate, first-pass acceptance, model calls, elapsed time, and unresolved failures by owner. Include independently adjudicated scientific/visual defects and false approvals; a higher acceptance rate alone is not success. Check active jobs before switching workers, let active work finish, and verify actual production outcomes after the compatible release.

## Required regression cases

- A unit-label repair preserves every assignment, group, equation, and unaffected caption, and returns a complete legal short label.
- A scope/citation repair edits only the cited passages; equations and walkthrough remain identical unless explicitly implicated.
- Eight identities in a six-token representation fail preflight and trigger a coherent smaller example or compatible representation, with no silently dropped identities.
- An allocation plan requiring nested blocks is rejected as unsupported until the renderer supports those semantics; supported block capacities are multiples of the declared illustrative block size.
- No-op, unexpected-path, out-of-bounds, and stale-preimage patches are rejected and retain the prior candidate.
- Repeated findings cannot disappear merely because the next review omits them; verified corrections do not oscillate back into an old candidate.
- An existing notation error missed by an earlier review remains correctable; a prior pass never overrides source evidence.
- Technical and visual issues eligible for the same candidate are collected before a repair, and final publication requires every current gate.
- Invalid model output, renderer capability failures, and execution interruptions receive distinct private classifications.
- Supplement repair preserves unaffected figures/questions and updates dependent answers coherently.

The intended outcome is a repair system that makes small, verifiable edits and recognizes when it needs a different representation or an engineering fix. This document specifies that work; it does not claim it has been implemented or deployed.


Implementation follow-up: [targeted repairs](targeted-repairs-2026-10-01.md) documents the locally implemented controller and renderer changes, current validation, and pending compatible release. The failure evidence above remains a description of the audited production worker.


Evidence follow-up: [evidence-aware repairs](evidence-aware-repairs-2026-10-01.md) corrects the subsequent local TriRoute diagnosis: Appendix C explicitly excludes the null expert from FFN cost, but the prior extractor skipped appendices and listings. This later investigation and local implementation do not change the production observations above.

The evidence-aware follow-up passes 162 local tests, typecheck and build. Nonpublishing replays still do not establish full-kit convergence: MegaBlocks passed both stages, QLoRA retained a disputed adjudication, TriRoute opening/supplement remained rejected, and updated FlashAttention stopped on a model execution timeout. See the evidence-aware implementation note for separate stage outcomes and the still-unmet TriRoute acceptance criterion. No production artifacts or jobs changed.
