# Quality pipeline: mechanism-first-v1

The acceptance target is a source-grounded explanation of the contribution, with a readable diagram of a clearly scoped mechanism. Passing geometry checks or producing valid LaTeX is insufficient.

## Shared production workflow

1. Extract source sections, native LaTeX, figure captions and structured tables. Expand row/column spans to retain metric context. Split long sections at block boundaries into separately citable parts; disclose oversized blocks and the 14-source budget. Figure pixels are not extracted; captions say so.
2. In a separate Codex call, make a mechanism plan: baseline versus contribution, inputs/operations/outputs/purpose, phases, critical distinctions, needed math and examples, diagram focus, and unknowns. Validate scope and source IDs.
3. Generate the notecard from that plan and the sources. The plan is provisional, not evidence. Diagrams may use 2–8 nodes with a narrow declared focus; no mandatory three-box layout. SVG labels use native text, not raw LaTeX.
4. Apply deterministic checks for citations, supported math, required coverage, geometry, actual font outlines and connector collisions.
5. Use a fresh Codex call for eight explicit technical checks: contribution, computation, phases, notation, worked example, diagram semantics, experimental evidence and source scope. Every required check must pass. The generator cannot override a failure with a generic approval flag. These are separate calls to the same model, not statistically independent reviewers.
6. Render desktop/mobile diagrams and apply the visual defect rubric. Diagram-only repairs preserve the recall. Content failures repair the notecard. Recheck after each change, with at most four repairs.
7. Publish only after passing; otherwise retain the failure. Save a versioned quality report, per-stage outputs, defects and repair targets under the worker's private `.artifacts` directory.

`worker/index.ts --review-file <paper.json>` audits a saved notecard without modifying jobs or library records. `--evaluate-file <paper.json>` runs full generation into evaluation artifacts without publishing. These modes support evaluating changes before promoting a new pipeline.

## Evidence from September 12, 2026

- 31 tests and the production build pass. Tests cover non-waivable technical checks, single-failure rejection, missing/invented citations, abstract-only exceptions, raw LaTeX in SVG, span-aware table extraction, section splitting and disclosed truncation. All ten existing stored diagrams pass the strengthened scene validator.
- Live extraction of EAGLE-3 v3 now retains five tables and eleven captions in nine sources, maximum excerpt 9,114 characters, without truncation. The old extractor omitted tables/captions.
- The new semantic reviewer rejected the original EAGLE-3 card: missing paper-specific math, missing worked trace, and ambiguous diagram semantics. Some additional reviewer suggestions were stricter than necessary; the rubric was subsequently clarified to judge the diagram's declared focus and allow objects to be identified in nodes/captions instead of forcing arrow labels.
- A non-publishing Expert Choice Routing evaluation caught an invalid illustrative softmax matrix whose rows were not normalized. Its repair corrected that arithmetic, but the run exhausted its repair budget on diagram collisions. It was rejected; no new card was published. This run used the first staged version, before the source-extraction and diagram-only repair changes made in response. It is evidence of error detection, not proof of end-to-end generation success in the final version.
- Macserver evaluation artifacts: `.artifacts/review-evaluation-BVJTCX` (old EAGLE-3) and `.artifacts/evaluation-G4gI2M` (Expert Choice Routing).

## Remaining engineering work

The renderer still places arbitrary scene nodes and connectors. It is not a general scientific layout engine. Replace increasingly elaborate prompt constraints with deterministic layouts for supported semantic structures (routing, feedback, matrix operations and comparisons), and evaluate them on held-out papers at actual publication sizes. Track first-pass acceptance, repair count, false rejections and technical defects separately. A larger benchmark is still needed; no claim that all future diagrams will pass or that model review establishes scientific correctness.

The EAGLE-3 and LoRA authored figures remain specific examples. The extraction, planning, validation, review, repair and reporting changes apply to future generation for every paper. Existing stored content is not relabeled as having passed this new pipeline.
