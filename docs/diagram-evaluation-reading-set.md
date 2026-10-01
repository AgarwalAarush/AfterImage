# Sequential evaluation of a research reading set

The owner requested a personalized reading set, full pipeline runs one paper at a time, visual evaluation after each, and generator adjustments based on the observed failures. These evaluations use public paper sources and existing model authentication. They do not deploy, publish to the library, or enqueue production jobs.

## Reading order and coverage

1. [MegaBlocks (2211.15841)](https://arxiv.org/abs/2211.15841): follows Expert Choice with a hardware-aware solution to dynamic MoE workloads. Tests capacity, padding, and sparse block structure.
2. [FlashAttention (2205.14135)](https://arxiv.org/abs/2205.14135): connects GPU memory hierarchy to exact attention. Tests IO and tiling illustrations.
3. [SpecInfer (2305.09781)](https://arxiv.org/abs/2305.09781): tree-based speculative serving. Tests branching proposals and verification.
4. [DreamerV3 (2301.04104)](https://arxiv.org/abs/2301.04104): an adjacent world-model topic. Tests learned temporal state and imagined rollouts.

These are a goal-specific reading recommendation and a varied regression set, not a claim about papers the owner has already read. Recommendation rationale uses the owner's previously stated MoE, GPU kernel, serving, and world-model interests; paper-specific claims are verified from original sources.

## Procedure

Run `node --import tsx worker/index.ts --evaluate-paper ID --full` for one paper. This retrieves sources, plans, drafts, validates geometry and citations, performs independent technical and desktop/phone visual review, then generates and reviews supplementary figures and the quiz. Reviewed notecard artifacts are saved before supplement generation, so a failed study pack does not erase the successful notecard. The normal repair ceilings and publication gates remain enabled.

Evaluation writes `reviewed-paper.json` for a `--study-file` continuation when needed. `--candidate` still resumes a saved notecard through fresh sources and every gate. The full result separates the opening paper and the supplement's own sources. All generated files remain ignored under `.artifacts/`.

For each output, inspect the actual desktop and phone images and assess: scientific fidelity; whether the defining relationship is visible without prose; whether geometry carries scientific meaning; reading order and label legibility; simplifications and illustrative-value disclosure. Gate approval is necessary, but does not alone establish strong visual communication. Record specific improvements and unresolved weaknesses, not only a pass badge.

## Outcomes

### MegaBlocks: first finding

Initial run `.artifacts/evaluation-z73qV6` produced routing plus used/allocated bars. Technical review rejected its visual explanation: the defining padding and block-diagonal regions were only described numerically. A repair used token/bank schematics, but the two-objects-per-layer bound forced artificial “other routes” nodes and a sprawling three-panel composition. The process was interrupted during its fourth technical review; it has no final pass report.

The generator now has allocation panels: fixed or ragged lanes and disjoint diagonal regions. Assigned identities, allocated padding and counts are concrete data. The planner favors a narrow capacity/block-structure comparison and does not require unrelated restoration or metadata detail in the overview. `sparseAllocationScene` checks the same six identities across a nine-slot baseline and six-slot sparse example, with feature-width columns explicitly collapsed and boundary padding disclosed. A fresh full run follows these changes.


### MegaBlocks: supplement finding

Fresh opening `.artifacts/evaluation-lB87BS` passed technical and visual review on attempt 1. It preserves eight toy token identities while comparing twelve fixed-capacity slots with ten locally rounded sparse slots, including boundary padding. The picture now encodes the allocation distinction directly. Block granularity is still explained in the caption rather than by nested block outlines; the full feature-width dimension is omitted.

The supplement exhausted its three repairs: a stage-only timeline lacked the mechanism and truncated descriptions, a binary operand table omitted a backward operation and had tiny mobile labels, then an unsupported numeric table failed provenance validation. Study figures now accept the same validated object illustrations as openings. Mobile matrices recompose as labelled rows with 13–14 px text, timelines retain all copy with directional connectors, and ratio bars mark 1× parity. The reviewed opening is reused for a fresh supplement run; no failed study draft is published.


The first shared-illustration supplement run `.artifacts/study-evaluation-cRwGTg` then identified renderer-owned defects: Unicode superscript T was missing from the review font, an empty selection still showed a selection legend, and relative-throughput bars lacked a parity threshold. These are now fixed centrally: native SVG superscripts, selection legends only when selections exist, and explicit bar reference markers. Repairs receive their previous draft so correcting one defect can retain already correct content. These changes keep the three-attempt review ceiling intact; a fresh supplement run exercises the compatible renderer.


### MegaBlocks: completed

Opening `.artifacts/evaluation-lB87BS` passed on attempt 1; supplement `.artifacts/study-evaluation-0R8KGw` passed on attempt 3 after replacing an all-module schematic and correcting illustrative provenance. The approved pack has three study figures and four independently checked questions. `reading-pack.md` packages only the approved material, with source links and answer explanations.

Human inspection of both sizes: the opening is **strong (4/5)** for the chosen allocation lesson. Unequal load, repeated identities, padded slots and absent expert regions are visible. Its main remaining limitation is conceptual block granularity conveyed in copy rather than nested outlines. The supplement's shared-store/transpose-index view is useful (3/5 visually): repeated B0–B2 identities clarify two access orders, but its generous graph spacing and relationship ledger make the phone version tall. Evidence bars are readable with explicit 1×/100% parity; they are evidence displays rather than mechanism illustrations. No further blocking source or geometry defect was found by human inspection. These are subjective communication ratings, not model confidence scores.


### FlashAttention: memory representation gap

First full run `.artifacts/evaluation-UL9Vvn` exhausted five notecard attempts. Generic vectors named full matrices without drawing their areas or memory residency; an iterative edge violated the DAG bound, then additional state objects violated the layer bound. A later schematic passed technical review but failed phone readability and then the final technical review. The reviewer also required the partial-output merge equation in addition to online-softmax m/l updates.

Memory panels now contain two typed regions with bounded matrix objects, symbolic shapes, stored/transient/absent residency, cross-region transfers and an explicit repetition description. Equal-sized grid cells encode relative matrix area; a crossed-out full grid means not stored, never skipped attention computation. Models cannot transfer absent objects or invent coordinates. The planner avoids the unsupported claim that only the final O ever returns to HBM; repeated output/state updates remain possible. The mechanism focus and source/math gates are preserved in a fresh full run.


Second run `.artifacts/evaluation-BMeg3e` corrected an arithmetic error in the online-merge example and reached technical approval on attempt 5, but failed visual review: traffic icons were detached from objects, local probability-to-output dependencies were missing, duplicated tile panels were too tall, and a caption contained unsupported missing-glyph characters. Memory transfers now anchor to actual matrix grids through obstacle-aware routes and may depict local SRAM operations. Bounded tile-coverage schedules show every block-pair visit without claiming that the schedule is stored. Region objects allow six entries to avoid artificial S/P grouping; symbolic shapes wrap. Shared glyph labels were increased and narrow banks widened for phone legibility.

Tall images had an additional review artifact: the full 350×4418 phone PNG was automatically downscaled to 162×2048, misleading typography assessment. Reviews now receive overlapping scroll slices of the native vector render at the full publication width, plus the overview; all source/mechanism checks remain mandatory. `--candidate FILE --redraw --full` retains a corrected recall, requests a fresh compact scene, and repeats every gate. It never directly approves the reused content.


Run `.artifacts/evaluation-DR2RQe` reached technical approval after preserving the corrected recall, but native Resvg viewport slicing crashed before visual review. Review slicing now crops the already successful full PNG with the existing Sharp runtime, avoiding this native clipping failure. The dense six-object/two-tier fixture additionally caught annotation/route conflicts; labels now avoid routes and memory regions recompose into one column on phones. A saved candidate resumes through every gate after these renderer fixes.


Run `.artifacts/evaluation-kNO6cx` passed the opening on attempt 4 and the supplement on attempt 3 (two figures, four questions). Human inspection then caught an area inconsistency the model reviewers had accepted: symbolic N rows differed across objects labelled with the same N. The deterministic validator now requires common illustrative N/d and accounts for grouped-matrix multiplicity; unsupported grouping cannot silently distort the area encoding. Its approved supplement remains independent of these geometry repairs: the evidence chart gives exact benchmark conditions and the backward schematic identifies saved O/m/l, reloaded Q/K/V and rebuilt local attention tiles. A new opening-only candidate run repeats all gates before packaging the unchanged supplement.

`--study-file PAPER --study-candidate DRAFT` supports a local continuation after renderer-owned defects, retaining the source/quiz/visual reviews and normal repair ceiling. Rebuild module text wraps within the actual glyph's inner box; it can no longer encroach on incoming arrows merely because its node label fits the outer routing box.


The dimension-fix run `.artifacts/evaluation-WNpWs9` exposed a repair-orchestration bug: the visual reviewer assigned view “recall” to defects located in the diagram's SRAM objects, and the worker repeatedly rewrote recall prose while preserving the defective scene. Target selection now uses explicit diagram locations to override that mislabel; mixed text/diagram failures still repair both and repeat all gates. The IO overview is also narrowed to persistent versus transient S/P intermediates and equal dense compute coverage, with routine operands/output and merge arithmetic explicitly omitted from the opening. Those remain in the complete notecard and complementary study, avoiding a crowded, incomplete algorithm picture.


The next repair run `.artifacts/evaluation-xoVciP` still drifted into a full forward arithmetic diagram and exhausted five attempts: its memory panel omitted the score tile, routed normalization statistics from already normalized probabilities, and omitted V from value weighting. Memory transfers now allow twelve anchored relationships, rather than dropping required inputs to fit six. The drafting contract explicitly separates an intermediate-residency overview from a full arithmetic view. A manually scoped candidate retains the generated recall and narrows its two panels to stored versus absent full S/P and transient tiles; it is not approved by editing and must repeat all independent gates. One evaluation was interrupted by model-service capacity exhaustion, and the candidate was retried without changing the review requirements.


The scoped candidate passed every technical check, but visual review demanded the entire online-softmax algorithm despite its intentionally narrower memory-residency focus. The visual rubric now matches the technical rubric: a picture must make its declared lesson visible and correct, while the notecard explains the full method. Omitting arithmetic from a storage overview is permitted; depicting incomplete or incorrect arithmetic is still a must-fix defect. This avoids an automatic repair broadening a useful comparison into an unreadable full algorithm. The interrupted repair has no approval.


### FlashAttention: completed

The scoped opening `.artifacts/evaluation-iCbZUH` passed on attempt 1 after both technical and visual review. Its generated recall is retained, while its manually scoped candidate focuses only on intermediate residency: the baseline reads stored S into a softmax workspace and writes P; FlashAttention has crossed-out full S/P plus transient score/exponential tiles and complete block-pair visits. Operands, output and online row-state arithmetic are explicitly omitted from that picture and fully described in the notecard. The previously independently approved study `.artifacts/evaluation-kNO6cx/study` supplies two complementary figures and four checked questions. `reading-pack.md` packages both.

Human inspection of desktop and full-width phone scroll slices: **3.5/5**. The area/residency comparison communicates the IO lesson, and the all-pairs schedule avoids implying sparse attention. It remains too vertically spacious on phones, and its pale residency text could have stronger contrast. The reviewer recorded both as suggestions, with no blocking defects. This is a materially stronger scientific explanation than a four-stage chain, but not the final word on layout polish.


### SpecInfer: service reliability finding

The first run `.artifacts/evaluation-PGfjJS` completed source planning, then drafting was rejected by the model service at capacity. It has no approved draft. Model calls now retry only an explicit capacity/overload rejection, at most twice with 20/40-second backoff; successful planning steps are not repeated within a run. Invalid JSON, source rejection, geometry defects, and timeouts never receive this transport retry. Independent tests check eventual success, the hard retry bound, and non-retry of content failures.


### SpecInfer: token-tree representation gap

Run `.artifacts/evaluation-AGbRxm` produced opaque token lists and duplicated the shared identity A to satisfy a minimum glyph size. Technical review rejected that encoding, its missing verifier boundary, and its omission of the target fallback in a greedy verification iteration. Native tree panels now contain individual token identities and parent relationships; sibling identities must be merged, ancestry is valid and bounded, and accepted nodes must form one connected path. The verified prefix stays outside the optional verifier frame. An optional `targetToken` creates a separate committed-output ribbon derived from accepted proposals plus the target fallback, rather than pretending that fallback was a proposed node. Wide trees recompose as a vertical branching structure on phones. Tests cover topology errors, exact identity retention, correct output roles, and maximum bounded trees at full phone width. The saved recall is reused only through fresh source, technical and visual gates.


### SpecInfer: completed

Run `.artifacts/evaluation-Zt1Vgl` passed the opening on attempt 4 and the supplement on attempt 2. The opening compares the same illustrative A/B/C/D identities: a single sequence matches A then uses fallback C, while the shared-prefix tree matches A→C and appends target T. Prefix context P is represented separately; rejected descendants do not commit. Human inspection of desktop and native phone slices: **4.5/5** for this greedy coverage lesson. The tree, verifier boundary and committed-output ribbon make the scientific relationship visible. The original approved image has a non-blocking “PURPLE = candidate” legend even though every candidate has already been marked accepted/rejected. The renderer now derives legend entries from statuses actually present; original review evidence is preserved rather than overwritten. Stochastic verification is explicitly outside this opening's scope.

The three supplementary figures show ancestor/self attention with siblings masked; reported stochastic WebQA verification success at k=1 versus k=5; and the reported naive-versus-multi-step sampling comparison at width 5/depth 8. Four questions passed independent source review. The first supplement failed because it omitted the decoding mode and rendered an essential heatmap at 8–10 px. Its repair replaced that figure with a correctly labelled, readable two-point bar view rather than concealing those conditions. The native heatmap renderer remains a known typography limitation for future evaluations. `reading-pack.md` packages the independently approved material.


The heatmap renderer has now been repaired centrally: desktop condition labels wrap horizontally at 13–14 px; phones recompose complete dataset/condition/value/color rows. Probability colors retain 0–1 and percentage colors 0–100 endpoints. An 8×8 stress test confirms no lost labels/values or font-outline collisions. Existing approved SpecInfer artifacts keep their reviewed bar representation; failed heatmap drafts remain unpublished. Native tree legends now list only statuses actually present.

### DreamerV3: scope finding

Initial run `.artifacts/evaluation-zoA4bG` exhausted five attempts. Its plan and drafts tried to cover replay learning, imagined trajectories, actor/critic returns and deployment in three overview panels. Repairing an opaque “Imagined rollout” module required more layers than the schematic bound; loss arithmetic also needed two-hot interpolation and a complete actor surrogate. Instead of expanding every graph bound, a scoped candidate retains the generated, math-repaired recall and focuses only on observed posterior state traces versus imagined prior state traces. Each snapshot explicitly groups latent h/z with a labelled outgoing action; it is not a combined tensor or fictitious computation. Transition dependencies include both state and action, and fresh observations enter replay posteriors but not imagined priors. Training objectives and updates remain in the notecard and supplement. This candidate repeats every gate; authoring it does not approve it. The planner now encourages this narrow state-trace representation when appropriate.


Run `.artifacts/evaluation-KtZE4N` initially repaired missing symlog/loss definitions and an internally disconnected worked example, but its reviewer continued requiring the earlier broad diagram plan even though the candidate explicitly chose a narrower posterior-versus-prior trace. The evaluation-only `--diagram-focus` option now constrains planning's diagram focus and visible proof to a stated source-supported lesson, while the full recall/math/evidence plan remains unchanged. It rejects empty/overlong arguments; reviewers still reject an inaccurate or visually empty focus. This option is not enabled for normal production worker jobs. The corrected recall is retained for another complete run; the interrupted broad scene repair has no approval.


The explicit-focus run `.artifacts/evaluation-lzDJI2` still exhausted five attempts. Source checks repaired apparent entropy-sign tension in the rendered equation, unsourced claims that bin count was missing, and examples that treated 6/8 as actual adjacent symexp bins. The diagram repairs oscillated between generic flow boxes and oversize schematics: separate panels could not show the source-required shared boundary, and action token glyph minimums duplicated a single action. A native `state-trace` panel now provides the required semantics directly: one shared replay posterior, two labelled branches, paired h/z components, incoming action tokens, actor-conditioning links and observation inputs only in replay. It unrolls two steps without expanding the general graph bounds or inventing intermediate operations. Deterministic checks reject duplicated state identities and imagined observations; both sizes retain five states, four actions and three observations. The last source-corrected recall is reused through the full pipeline with this panel.


The first native trace run `.artifacts/evaluation-hDxLCW` passed source review, then visual review correctly found a heading touching the initial observation circle and observation arrowheads hidden by state fills. Connectors now paint above target fills and land directly on the z component; the phone heading has clear separation and the imagined branch is tighter. The run's scene repair passed, but its supplement failed all three attempts: an eight-character matrix-cell bound caused the model to split prose into extra array cells, so rows did not match columns. The study prompt now explicitly forbids that misuse, reserving illustration matrices for atomic values/masks instead of qualitative treatment prose. The revised native trace repeats full review in `.artifacts/evaluation-y1STAw`.


### DreamerV3: completed

The final opening `.artifacts/evaluation-y1STAw` passed all gates on attempt 1. Its native trace shows one shared replay posterior, observed states with recorded actions and fresh observations, and imagined states with actor-conditioned actions and no fresh observations. Human desktop and native phone inspection: **4/5**. Paired h/z identities and the shared branching boundary make the distinction visible; the phone dependency spine remains long, and the hero deliberately excludes loss updates and deployment. Those are explained in the full notecard.

Its initial supplement exhausted three attempts on a false loss-to-symexp chain, conflation of target encoding and learned probabilities, and fabricated capacity/bin support. The scoped continuation `.artifacts/study-evaluation-TTQ8Vg` retained the four generated questions and repeated fresh source, technical, geometry, and visual checks. It passed on attempt 1 with no issues. Two figures distinguish reported objective coefficients (1, 1, 0.1) from an explicitly illustrative two-hot encoding. The target 6.72402 lies between actual adjacent symexp supports expm1(2)=6.38905609893065 and expm1(3)=19.085536923187668; target weights 0.9736175790988169 and 0.02638242090118319 sum to one and reconstruct that target. The remaining 39 bins have zero target mass. No learned prediction or measured loss magnitude is implied.

`reading-pack.md` packages the independently approved opening, notecard, two figures, and four questions.

## Completed set and findings

All four papers completed the full pipeline sequentially, including reviewed opening/notecard, supplementary figures, and quizzes: **four openings, ten supplementary figures, sixteen questions**. The local hub is `.artifacts/reading-set-2026-09-30/index.md`; its manifest records the exact approved directories, counts, and subjective communication scores. These scores are human critique, separate from pass/fail gates. Some papers needed multiple runs and scoped authored candidates, with fresh review after each; final-run attempt counts do not describe the entire iteration history.

The main lesson is to select a scientific representation before drawing. Occupied/padded space, memory residency, shared-prefix trees, and observed/imagined state traces carry meaning that generic stage boxes cannot. Review must protect that narrow explanatory lesson without silently expanding it into every operation in the paper. Approval still leaves polish work: block boundaries and traversal labels in MegaBlocks, spacing/contrast in FlashAttention, and a long phone dependency spine in DreamerV3.

Final verification: **98 tests passed**, standalone TypeScript checking passed, and the production build passed. Generated artifacts remain ignored, and all linked guide/figure files exist. This is a local change and evaluation set: no library state or production queue was mutated, and no web or worker deployment was performed. Compatible web schema/renderer/validation must be released before the worker.
