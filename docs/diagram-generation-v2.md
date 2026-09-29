# Diagram generation v2

## Failure being addressed

SGLang job `a81dd839-7804-41da-9ea2-953881eb9a18` completed five draft/review passes and was rejected on September 16, 2026. Its final desktop SVG had four connector/text intersections: “GPU state for exact,” “pages,” “Matched KV,” and “insert path + KV refs.” Repairs alternated between scientific claims, graph semantics, and geometry; a full-notecard repair could replace previously corrected scene geometry.

## Implementation

The model-facing scene schema requests concepts, concise labels/details, directed relationships, and a caption. It does not request coordinates. `prepareScene` stamps `layout: "flow-v2"`; legacy coordinate fields remain as compatibility fields in storage and are ignored by this renderer. Unversioned scenes continue using the legacy renderer.

`scene-layout.ts` uses a stable dependency order, desktop rows, and a portrait stack. Cycles retain every directed edge. It wraps labels (including long identifiers), reserves the full node bounds for text, and routes orthogonal connections on a bounded grid around expanded node obstacles. Each incident edge gets a separate port; connections cannot share routed segments. White separation at crossings distinguishes intersecting paths from junctions. Circle endpoints meet the ellipse boundary. The actual canvas height follows content.

Nonempty edge labels appear as captions naming their source and destination. This preserves labels on feedback and skip connections on mobile; the old mobile renderer omitted labels for non-adjacent edges. The renderer does not infer new graph edges, fabricate matrix cell values, or depict an unsupported count of selected experts.

Technical review classifies repairs as scene, recall, or both. A recall repair cannot replace the scene and a scene repair cannot replace the recall. Earlier repair findings are retained in subsequent prompts, and each normalized candidate and the bounded source context are saved privately. Review prompts receive the semantic graph, without compatibility coordinates. All candidates still pass the citation/math, deterministic SVG, technical, and visual gates before publication. Deterministic review now also detects arrows through unrelated node bounds, even when they miss its text. The repair ceiling remains four.

The model-output schema limits citation identifiers to the supplied sources. Technical findings with known field ownership request only those recall fields (for example, evidence or the worked example), merging the patch into the unchanged recall. Broad scope failures may still require a complete recall repair. Walkthrough repair instructions explicitly allow combining earlier operations to fit all required steps within the six-row limit.

## Verification

`tests/fixtures/sglang-scene.ts` preserves the actual rejected scene. `tests/scene-layout.test.ts` reproduces the old connector failures and tests the revised desktop/portrait output, graph preservation, shape avoidance, deterministic rendering, cycles, branches, merges, disconnected nodes, long labels, and the semantic output schema. `tests/quality.test.ts` checks that review findings target only the affected artifact.

Run `node --import tsx scripts/render-scene-regression.ts` to generate before/after SVGs and publication-size PNGs under `.artifacts/scene-regression`. These artifacts remain ignored. Run `node --import tsx worker/index.ts --evaluate-paper 2312.07104` for a fresh generation and review with official arXiv metadata and source retrieval. Evaluation mode needs Codex authentication but no queue credentials; it writes artifacts without calling the worker API.

The initial local full evaluation (`.artifacts/evaluation-0t4Lkw`) cleared geometry on every checked candidate and preserved the scene through recall-only repairs, but exhausted its repair budget on an omitted final walkthrough operation. This exposed the need for citation constraints and field-specific repairs; it is not recorded as an overall generation success.

After those changes, a fresh SGLang evaluation (`.artifacts/evaluation-KTzMaq`) passed all notecard gates in two attempts: one initial draft and one recall-only repair. The semantic graph remained unchanged. The final visual reviewer approved both publication-size images with no issues; deterministic SVG inspection also returned no defects. This evaluates the notecard and its diagram, not the separate study-guide job or production queue. The complete automated suite passes 54 tests; type checking and the production build also pass.

## Release boundary

This change is local until explicitly deployed. The web release must precede the worker release, because the old API strips an unfamiliar scene layout field and rejects the compatibility coordinates as overlapping. Publish the shared schema and renderer, then synchronize the worker and shared modules while its generation queue is idle. Do not publish a flow-v2 result through the old API. No existing paper is migrated or regenerated by this code change.

The regression proves geometry repair, not scientific correctness of the saved draft. A fresh full evaluation is required to assess a new generated explanation. The deterministic layout supports the bounded 2–8-node, 10-edge schema; it is not a general scientific-figure engine.
