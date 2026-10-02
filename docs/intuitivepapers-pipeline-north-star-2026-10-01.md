# A teaching pipeline for AfterImage

Date: October 1, 2026. Status: design proposal, based on the current checkout; no generator, reader, storage, or production changes have been made.

## Aim

Make AfterImage capable of teaching an unfamiliar research idea, not just helping someone remember a paper they already understood. Keep the compact notecard as a useful first layer, and offer a deeper lesson only when the reader asks for it. Use intuitivepapers.ai as a reference for educational depth and meaningful interaction, while building original explanations and product-owned figure implementations.

The quality target is a reader who can explain the mechanism, carry out a small example, interpret the evidence under its actual conditions, and describe where the explanation stops being valid. Article length and animated decoration are not acceptance criteria.

## Reference evidence

The creator's [About page](https://intuitivepapers.ai/about/) says Claude drafts the prose through a maintained pipeline. It describes paper/code checks, primary-literature verification of prerequisites, a checked equation reference, and a ledger of important claims. Separate reviewers examine correctness, clarity, voice, and figures; a second pass confirms findings before repair. Unresolved drafts stop automatic publication after five rounds. Interactive figures receive browser checks at different widths. Rewrites must retain verified content and win two blind comparisons with reversed ordering. Feedback is checked against sources before correction. The page acknowledges residual errors and says some older articles are still being brought onto the ledger process.

These are the creator's reported procedures, not an independent audit of their implementation. The supplied [Geometry of Noise explainer](https://intuitivepapers.ai/geometry-of-noise/) illustrates the product goal: controls manipulate scientific quantities in context, rather than animating an unrelated decorative graphic. The [library](https://intuitivepapers.ai/library/) organizes material by subject.

The About page supplies useful process evidence; it does not establish a general reuse grant for the articles or executable assets. Attribution identifies a source but does not resolve that separate question. This proposal does not import or mirror the third-party library.

## What AfterImage already does

The following observations come from code inspection in this checkout, not a new live generation or deployment test.

| Capability | Current owner | Existing behavior and practical limit |
| --- | --- | --- |
| Scientific extraction | [source-extraction.ts](../src/lib/source-extraction.ts), [sources.ts](../worker/sources.ts) | Preserves equations, tables, and captions; bounds excerpts and marks truncation. Captions are extracted without figure pixels. The fallback may honestly remain abstract-only. |
| Mechanism reconstruction | [quality.ts](../worker/quality.ts) | Plans inputs, operations, outputs, phases, unknowns, and the relationship the diagram should make visible. It does not build a reusable prerequisite curriculum. |
| Technical recall | [index.ts](../worker/index.ts) | Requests roughly 400–600 words for supported full-text material, essential equations, and worked examples. This is a refresher contract, not a chapter-length teaching contract. |
| Scientific and visual review | [quality.ts](../worker/quality.ts), [diagram-review.ts](../worker/diagram-review.ts) | Independent model passes check source support and rendered figures; deterministic geometry checks run first. Opening generation allows five attempts, with at most four repairs. |
| Supplement and quiz | [study.ts](../src/lib/study.ts), [index.ts](../worker/index.ts) | Produces one to three figures and two to four questions; checks semantics, geometry, answers, and distractors. Supplement generation has a separate three-attempt bound. |
| Interaction | [paper-study.tsx](../src/components/paper-study.tsx) | Network figures can switch among declared states. This is narrower than continuous parameter controls, simulation traces, or a general scientific timeline. |
| Appearance | [theme.css](../src/app/theme.css), [paper-study.tsx](../src/components/paper-study.tsx) | Browser presentation adapts figures to the page theme. Stored scientific geometry stays separate from appearance. |
| Evaluation | [reading-set findings](diagram-evaluation-reading-set.md) | Records full local reading-kit evaluations and source/representation failures. Those findings provide a stronger starting point than cosmetic imitation. |

The important gaps are persistent claim verification, explicit prerequisite teaching, parameterized scientific interaction, and evidence that a rewrite improves on an accepted artifact. Existing review gates should remain; additional model calls alone will not close those gaps.

## Proposed generation sequence

### 1. Build a versioned evidence package

Retrieve the relevant paper sections, equations, tables, and figure captions, then assess whether the selected lesson needs evidence outside that paper. Retrieve a prerequisite source only for a named unresolved concept. Retrieve an official implementation only for a named implementation question. Record source version, exact locator, retrieval time, and content digest so later reviews refer to the same evidence.

Do not equate the presence of some full-text excerpts with complete method coverage. Keep a coverage map for the selected claims, including truncation and missing appendices. Reject an unsupported deep lesson while retaining an honest abstract-level preview.

A paper/code disagreement is not automatically a paper correction. Different releases, configurations, or implementation shortcuts may explain it. Identify the exact revision and conditions, then classify the disagreement as unresolved, a documented implementation difference, or a verified correction. Fetch code as bounded text; never execute repository instructions or install dependencies during evidence collection.

### 2. Create a claim ledger and equation reference

Introduce a proposed private artifact containing the important statements the lesson must preserve. Each entry needs a stable claim ID, source locator and digest, claim type, conditions, verification result, and any counterevidence. Useful claim types include mechanism, equation, result, implementation detail, prerequisite, correction, caveat, and illustrative example.

Numerical results must carry metric, unit, baseline, dataset, configuration, and denominator where applicable. Two matching numbers in an excerpt do not prove that the lesson assigned them to the right experiment.

For equations, record the source expression separately from the teaching notation. Define symbols, dimensions, index ranges, assumptions, and any absorption or normalization convention. A small deterministic calculation should verify an applicable worked example. Do not claim a model review proves an arbitrary identity; use computation or symbolic checking where practical and retain unresolved qualifications.

Drafts and repairs should reference ledger IDs. A changed supported fact requires re-verification; an editorial rewrite should not silently mutate it. Distinguish illustrative arithmetic from measured results throughout prose, figures, and quizzes.

### 3. Plan a lesson before writing it

Extend the mechanism plan with an intended reader, prerequisite dependencies, learning objectives, likely misconceptions, and a sequence of questions the lesson answers. Separate background sources from sources supporting the new contribution.

Each section should have a purpose: establish a prerequisite, reconstruct a computation, work an example, connect it to a result, or explain a limitation. Include an analogy only if its correspondence and failure boundary are explicit. A broad subject lesson can span several papers; it must not pretend to be one paper's recall.

Keep the existing opening diagram narrow. A complete lesson can use several focused figures without forcing every objective into one oversized scene. Preserve the notecard for quick recall rather than stretching its schema into an entire article.

### 4. Specify an experiment for every interactive figure

For each figure, write the scientific question, the quantity a control changes, the quantities recomputed from it, and the invariant that remains true. Then select a typed representation.

The proposed contract includes:

- A supported mechanism and ledger references, plus explicit omissions.
- Stable scientific object identities and a useful static poster.
- Bounded input domains, defaults, units, and supported controls.
- Deterministic state updates and derived outputs, implemented by product code.
- A visible explanation of the changed quantity and an accessible text equivalent.
- Endpoint, midpoint, reset, and invalid-input expectations.

The worker may select an allowlisted simulation or timeline and supply bounded semantic parameters. It must not generate JavaScript, arbitrary SVG, coordinates, or executable assets. Start with an authored reusable primitive, validate it, and only then enable worker selection. Reuse the existing semantic scene and renderer vocabulary whenever it can express the relationship.

An illustrative noise lesson might compare radial concentration across dimensions with a dimension control and a shared seeded sample. Scientific assumptions, any simplified geometry, and the difference between a schematic shell and actual sampled radii must be stated. The implementation and explanation would be original; the supplied screenshot is a reference for meaningful exploration, not a specification to duplicate its composition.

A memory-tiling lesson could instead animate identifiable block visits while preserving accumulator state; a token-verification lesson could expose one accepted prefix and the separately appended fallback. These use concepts already represented in AfterImage and provide lower-risk first integrations than introducing an unrestricted simulation engine.

### 5. Separate reviews and adjudicate disputed findings

Use focused passes for evidence/equations, teaching clarity, visual/interaction behavior, and quiz correctness. Reviewers receive primary evidence and the current artifact; a planner's claim of correctness is not proof. A finding must identify a claim or object, its source or rendered state, the defect, and a targeted repair.

Keep existing schema, arithmetic, topology, and geometry failures as deterministic blockers. Reserve a confirmation pass for consequential or disputed model findings. Confirmation must independently inspect the evidence, not just vote on the first reviewer's prose. A reviewer can be wrong, and disagreement should remain visible in private diagnostics until resolved.

Track a finding through an explicit repair or evidence-backed dismissal. A later clean review does not prove that an earlier defect disappeared when its affected fields remain unchanged. The Subjects cleanup exposed this in a Switch FLOPs comparison and an OpenVLA quantization-result condition: both needed targeted corrections despite a subsequent passing report. Automating finding closure is a proposed pipeline improvement; the current editorial run resolved these cases by inspecting the source and candidate changes before a fresh full review.

Preserve the current repair bounds rather than increasing them to imitate another site. Patch the smallest defective part, retain verified claims and valid geometry, and rerun every affected gate. Exhaustion produces a rejected private draft and a reader-safe failure state; it never publishes the best-looking failed candidate.

### 6. Test interactions in a real browser

Static raster review cannot verify dragging, keyboard controls, pause/resume, reset, or parameter propagation. Add browser acceptance for every supported primitive, including input extrema and representative intermediate states. Verify that a changed control changes the intended scientific result and that unchanged objects retain identity.

Desktop remains the product acceptance target. Test normal desktop reading width and the narrower paper column with the assistant open, inherited Light/Dark appearance, keyboard access, reduced motion, printing, and hidden/offscreen behavior. Preserve existing responsive checks without creating a separate mobile product initiative.

For motion, inspect samples along each transition as well as endpoints: swept collisions, premature outputs, lost persistent state, and false serialization are scientific defects. Explicit pause must survive visibility changes; reset must restore the declared initial state. Animation pacing is illustrative unless backed by measured timing evidence.

Use the page palette at the browser boundary. Exports must identify their format and capabilities: a static SVG poster must not be described as a fully interactive export. Browser results and critique artifacts should bind to the scene, renderer, evidence, and presentation versions that were actually checked.

### 7. Make rewrites prove improvement

Before replacing an accepted lesson, compare its verified claim inventory and figure teaching purposes with the candidate. Dropping an important fact, caveat, or learning objective requires an explicit reason; correcting a verified mistake requires fresh evidence, not blind retention of the old version.

After scientific and behavioral gates pass, compare the old and new material with identities hidden and ordering swapped. Assess explanation quality and ease of tracing the mechanism. Record both outcomes; a split preference is inconclusive and should preserve the accepted version unless a separately justified correction is necessary.

Model preference remains a heuristic. Keep a small human-reviewed benchmark and use short reader tasks to assess actual comprehension: predict a changed output, explain a preserved invariant, and identify when the model's assumptions fail. Track unsupported claims, interaction defects, repair churn, and inference time alongside preference results.

## Subjects as a separate content model

Propose a Subjects shelf for broad concepts and multi-paper lessons, with related paper links. Keep a distinct identity for subjects, lessons, and papers. Subject membership, prerequisite dependencies, and lesson reading progress should not manufacture arXiv IDs or paper-generation status.

The default shelf should show a title, a short original description, prerequisite cues, and available lesson status. Full lesson generation starts only from an explicit reader action, with active-job deduplication. Hover, navigation prefetch, and discovery must not trigger generation.

Store full lesson content, evidence packages, ledgers, and detailed review artifacts outside the ordinary polling projection. Public/private browser payloads still expose only the material the owner is allowed to read and reader-facing milestones, never raw generation errors, leases, or rejected drafts. A new storage design needs explicit schema and bridge work before implementation; this document chooses no new authoritative database or public service.

Authorized supplied article assets could use a separate import path with attribution and an explicit distinction between editorially imported material and freshly generated lessons. Attribution alone is not an import authorization, and recoloring alone is not scientific re-review. External scripts must not run under the authenticated application origin without a designed and tested isolation boundary.

## Implementation order and acceptance

| Phase | Concrete deliverable | Acceptance |
| --- | --- | --- |
| 1. Evidence | A versioned private ledger and equation reference for existing paper evaluations | Claims map to exact evidence; altered conditions, symbols, and unsupported results are rejected; existing accepted kits remain intact. |
| 2. Teaching | An evaluation-only deep lesson with prerequisite plan and ledger-linked sections | A reader can trace a worked example; missing prerequisite evidence and abstract-only depth claims fail. No production queue mutation. |
| 3. Interaction | One authored, typed interactive primitive with deterministic replay/poster | Real browser controls, extrema, intermediate states, themes, keyboard access, and motion behavior pass. Review fingerprints identify the tested artifact. |
| 4. Review | Focused critique, disputed-finding confirmation, and regression comparison | Known scientific and interaction defects are caught; a worse rewrite cannot replace an accepted artifact; repair limits remain bounded. |
| 5. Subjects | Image mockup, then a native desktop shelf and explicit lesson preparation | Paper and subject identities remain separate; listing works without downloading complete lessons; no hidden generation. |
| 6. Release | Compatible schema, validation, reader, storage bridge where needed, then workers | Web and any necessary bridge compatibility precede new worker payloads; active work finishes before restart; live persistence and reading behavior are verified. |

First evaluate an existing memory or token-tree mechanism, where the current semantic vocabulary can carry a meaningful interaction. Then evaluate an original noise-geometry lesson to test continuous controls and scientific limitations. Expand across subjects only after these examples pass the full loop. A request to ingest a whole catalog should not imply that one hundred lessons have been source-reviewed or that their interactions work.

Update README and AGENTS when implementation changes the architecture or release boundaries. Preserve legacy renderers and stored accepted material; enable regeneration through explicit requests after compatibility is deployed. This design note itself changes none of those boundaries and requires no worker restart or deployment.

## Immediate next engineering step

Implement the ledger behind evaluation mode first, with fixtures for a correctly supported claim, a metric with mismatched conditions, an equation with a sign/convention disagreement, and a repair that accidentally drops an accepted caveat. Reuse the existing source and quality interfaces. Once that passes, author one interactive worked example and its browser review harness before extending the production worker or building the Subjects view.
