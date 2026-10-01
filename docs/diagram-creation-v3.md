# Diagram creation: show the mechanism

The Expert Choice opening diagram was a four-stage chain: affinity scores, top-k, FFNs, merge. Its labels were plausible, but the illustration did not show experts choosing tokens, fixed expert buckets, or variable token computation. The original 800×470 legacy canvas also left substantial empty space. A geometry-safe flow graph cannot, by itself, solve this explanatory failure.

## Generation and review

The mechanism planner now chooses a representation, a `visibleProof`, and a `visualEncoding`: the precise relationship a reader should see. It considers supplied figure captions and chooses among dependencies, selection matrices, routing assignments, comparisons, and concept-specific schematics. The encoding states which geometric property carries which scientific fact. Opening diagrams prefer meaningful object illustrations; numeric tables remain useful when their entries are the central idea. The opening scene can contain either a graph or 1–3 typed panels. A panel cannot conceal a second unrendered graph. The model still supplies data and semantics, not executable SVG or positions.

`explanatory-v3` supports:

- Matrices with explicit row/column labels, values, and selected cells; no fabricated cell values or selections from shape decoration. Declared probability rows must sum to one; declared row/column top-k must agree with the selected cells and scores (ties are allowed).
- Object routing (`presentation: buckets`) uses colored expert/allocation buckets, repeated token identities inside them, and count dots below each token. Empty and multiply selected tokens are visibly distinct. Only short object identities fit the bounded tokens; general assignment labels retain the original links view.
- Bipartite routing with explicit assignments and selection direction. Captions distinguish selection from physical data dispatch. Counts are derived from links and can use domain nouns such as tokens and experts. Duplicate/out-of-range assignments and ambiguous duplicate group labels are rejected.
- Bars with units, a zero baseline, a labeled endpoint, and a shared scale across panels using the same unit. Percentages use 0–100. Exact numeric support is required for reported values; invented values must be marked illustrative.

- Schematics use 2–6 semantic glyph nodes: compute modules, bracketed vectors, token groups, capacity banks, Gaussian distributions with sample markers, and calibrated 0–1 gauges with optional reciprocal multipliers. Dependencies form up to four layers, at most two objects per layer. Missing/duplicate/cyclic relationships, bank overflow, long token identities, out-of-range samples, and zero or non-finite reciprocals are rejected. A schematic must include a data-bearing glyph; ordinary compute blocks use the flow representation. Modules do not assert hidden cardinalities.

Every panel cites supplied sources. Generation and scene-only repairs restrict citation IDs at the model boundary; the worker and publication API independently check panel citations and reported numeric support. Technical review checks selections, normalization, direction, counts, and consistency across the worked example. Visual review now includes `missing-visual-mechanism`: an accurate caption cannot rescue a diagram that only names a selection/allocation method. The earlier source, math, deterministic geometry, technical, and visual gates remain enabled, as does the four-repair ceiling. Caption-only visual defects now request just the ordered captions and accessible description; the worker patches that text onto the valid illustration and repeats all reviews. General scene defects retain the full scene repair path. This prevents a text correction from needlessly regenerating correct assignments. Raw failures stay in private diagnostics.

Flow graphs still use `flow-v2`, with their existing semantic routing and layout. Legacy unversioned scenes still use the original renderer. The stale generation contract claiming that `experts` depicts eight experts with two selected has been removed; flow shapes carry no implied cardinalities.

## Composition

Schematics occupy a full-width row, with dependency layers across desktop and down phones. Their branches recompose rather than shrinking desktop artwork. Glyphs share obstacle-aware routing with flow graphs, using ports aligned with the visual object instead of its explanatory text.

Other panels use at most two columns on desktop and stack on phones, with a content-derived canvas height. Long matrix values wrap at a fixed readable type size. Native SVG text and XML escaping remain in use. The existing SVG export and paper component render the new scene through the same entry points. Deterministic inspection now accounts for translated panel text, connectors, and node bounds.

`tests/fixtures/expert-choice-scene.ts` contains a source-informed illustrative six-token, three-expert comparison. Token top-1 gives expert loads 3, 2, 1; expert top-2 gives loads 2, 2, 2 and token allocations 1, 1, 1, 1, 0, 2. It shows selection only, explicitly omitting FFNs, weighted merging, and residual paths. `expertObjectScene` renders the same assignments as actual token circles and occupied buckets. A second fixture gives a row-normalized affinity matrix whose column top-2 selections reproduce those assignments. These are teaching values, not experimental results from the paper.

`tests/fixtures/concept-scenes.ts` adds an illustrative scalar reparameterization (μ=0, σ=1, ε=0.4, z=0.4) and Adam denominators at t=2 (β₁=0.9, β₂=0.999; values 0.19 and 0.001999). The reciprocal multipliers derive from the displayed denominators. These fixtures omit the full objective and update, respectively; distribution and gauge motifs must only be selected when the sources support their meanings. Sources: [AEVB §2.4](https://arxiv.org/abs/1312.6114), [Adam algorithm 1](https://arxiv.org/abs/1412.6980).

Source: [Expert Choice, §3.2](https://papers.neurips.cc/paper_files/paper/2022/file/2f00ecd787b432c1d36f3de9800728eb-Paper-Conference.pdf).

## Verification

`node --import tsx scripts/render-illustration-regression.ts` writes ignored SVG and PNG previews under `.artifacts/illustration-regression`, at desktop 880px and phone 350px publication widths. The fixtures pass font-outline inspection and were visually inspected at both widths. Tests cover selections and counts, citations and reported values, invalid references/dimensions, translated collision inspection, deterministic output, and maximum bounded labels/matrices.

`node --import tsx worker/index.ts --evaluate-paper 2202.09368` evaluates generation using public paper sources without changing the library or queue. Its outcome is recorded separately below; fixture rendering alone does not prove model generation quality.

The first full evaluation (`.artifacts/evaluation-RwzLsM`) chose a side-by-side selection-matrix comparison. Technical review rejected invalid illustrative probability rows; one scene repair changed the example to a consistent four-token, three-expert matrix. The repaired diagram then passed four successive technical reviews and deterministic desktop/mobile checks. Full notecard publication was still rejected on missing limitation citations: its eight-source citation inventory was already full, and repeated repairs preserved all eight while failing to add the requested two.

The recall citation inventory now permits fourteen references, matching the existing source-record limit in the publication API. Citation identifiers remain constrained to supplied sources. Evaluation mode accepts `--candidate path/to/candidate.json` to resume a saved candidate through fresh source retrieval, planning, geometry, technical and visual reviews with the normal repair ceiling; it never bypasses review or writes to library/queue state. This flag only applies to `--evaluate-paper` / `--evaluate-file` runs.

The resumed evaluation (`.artifacts/evaluation-eob6Jo`) passed all gates after one repair. Fresh planning and review required the new matrix normalization/selection declarations and the missing citations; the repair supplied both, preserving the valid scores and selections. Independent technical review passed, followed by desktop/mobile visual review with no must-fix issues. The final candidate uses row top-1 versus column top-2, and both matrices pass the declared normalization and selection-rule checks. This was a local evaluation using public sources; no library records or production jobs changed.

The conceptual-illustration run (`.artifacts/evaluation-slfh2U`) selected object buckets itself: baseline loads 4, 1, 1 versus Expert Choice loads 2, 2, 2, with T2 selected twice and T6 unselected. Scientific review passed. Visual review correctly rejected incomplete captions and phone labels around 9–10 px; these findings led to targeted text repair and larger illustrative qualifiers, token identities and occupancy labels. This initial run exhausted its repair allowance without publication.

The saved model candidate was resumed through fresh source retrieval, planning and all gates with the fixes (`.artifacts/evaluation-s46kP1`). Caption-only repair returned complete captions and an accessible description in 7 seconds, preserving every assignment. The second review passed scientific and desktop/phone visual checks with `approved: true`, `issues: []`, and pipeline version `conceptual-illustration-v3`. Its reviewed preview is `review-1.png`, with `review-mobile-1.png` for phones. No production record or job was modified. This verifies the Expert Choice object generation and targeted repair path; the distribution/gauge examples are authored renderer fixtures, not separate full generation evaluations.

The complete automated suite (78 tests) and type check pass, and the standard Turbopack production build passes using local, ignored dependencies.

## Release boundary

This work is local. Publish the compatible web schema, renderer, and publication validation first. Then update workers after active jobs finish. Older APIs may strip panel data or reject the new version. Only after both are compatible should an existing paper be regenerated through the normal review gates. No stored diagram or private production record is changed by these edits or evaluation scripts.


## Reading-set extension

The sequential [four-paper evaluation](diagram-evaluation-reading-set.md) adds allocation lanes/diagonal regions, two-tier memory residency panels, shared-prefix token trees with derived committed output, and replay/imagination state traces. These typed panels share source validation and renderer-owned geometry with supplementary figures. Native phone layouts retain identities and inputs instead of shrinking desktop drawings. Reviews use publication-width scroll slices; explicit model-service capacity errors receive bounded transport retries without relaxing content checks.

The final reading-set suite has 98 passing tests and a passing production build/type check. Approved local guides and a manifest are under `.artifacts/reading-set-2026-09-30/`. This supersedes the earlier 78-test count for the current changes; the release boundary above remains unchanged.


## Integration with current main

The release preserves the October 1 on-demand reading-kit and assistant interaction changes. Graph preparation retains current main's exact endpoint diagnostics and unambiguous underscore-to-hyphen normalization; illustration preparation still selects `explanatory-v3`. The combined suite passes 105 tests and the production build. Existing stored scenes and failed jobs are not regenerated automatically.
