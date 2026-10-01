# Scientific diagrams and animation mode — October 1, 2026

`Recall.equations[].example` remains a string rendered by `RecallText`; reviewed study figures are separate supplements. Automatic equation-to-animation associations require a bounded reviewed schema and compatible web/worker integration. This change supplies the reusable authoring skill, authored example, and local evaluation loop.

## One diagram workflow

[scientific-diagrams](../skills/scientific-diagrams/SKILL.md) owns semantic planning, source grounding, typed visual vocabulary, math/label/prose typography, deterministic geometry, source/geometry/technical/visual review, and bounded repairs. [Animation mode](../skills/scientific-diagrams/references/animation.md) adds ordered state changes, identity continuity, timing, swept collision checks, and playback. The older scientific-svg-animation skill is a thin compatibility router; its examples link to the canonical folder. Both are installed locally.

The [integration map](../skills/scientific-diagrams/references/afterimage-pipeline.md) reuses existing AfterImage planner/render/review boundaries. The local harness does not replace the product validators, run an unattended model, or independently approve scientific claims.

## Cursor study

[Git at any scale](https://cursor.com/blog/git-at-any-scale) contains 15 inline main SVGs: nine animated mechanism diagrams, two charts, four control icons. All were downloaded as DOM snapshots, with computed typography/style evidence and browser captures for the eleven substantive figures. The page's application drives the animation; raw snapshots do not contain its complete replay logic.

[Reference findings](../skills/scientific-diagrams/references/cursor-git-reference.md) record measured text roles and observed state transitions, separately from inferred principles and proposed adaptation. Local `.artifacts/cursor-git-reference/cursor-git-svg-reference.zip` contains the downloads, styles, and contact sheet. Reference assets remain study material and are not shipped product illustrations.

## Revised EAGLE-3 example

The [storyboard](../skills/scientific-diagrams/examples/eagle-state-reuse.json), [timeline/renderer](../skills/scientific-diagrams/examples/state-reuse.mjs), [animated SVG](../skills/scientific-diagrams/examples/eagle-state-reuse.svg), [poster](../skills/scientific-diagrams/examples/eagle-state-reuse-poster.svg), and [preview](../skills/scientific-diagrams/examples/preview.html) explain §3.1/Figure 5. The input concatenates a_I and e(do); FC/draft decoder produces a_do; the LM head proposes it; the same state is copied into the next input with e(it). Proposal acceptance, training, earlier context, and dynamic trees are omitted explicitly. Brackets/semicolon encode concatenation rather than addition. Glyph shapes and pacing are illustrative.

Math uses licensed KaTeX-compatible glyphs with explicit subscript baselines. Labels use DM Sans, prose Newsreader, sparse metadata IBM Plex Mono. The 16-second timeline creates actual state/proposal changes and carries the reusable state along its feedback path, followed by a final hold and fade/reset. It generates sampled frames and the standalone SVG from the same tracks. SVG exports embed the font data, palette, and matching background.

The preview autoplays while visible and has one Play/Pause control. It inherits page colors without a local theme toggle. User pause survives offscreen/re-entry; reduced motion defaults to the complete poster, and print selects the poster. Author-only URL parameters inspect a fixed frame/theme without adding reader controls.

```sh
node skills/scientific-diagrams/scripts/build-example.mjs
python3 -m http.server 8765 --bind 127.0.0.1 --directory skills/scientific-diagrams/examples
```

Open `http://127.0.0.1:8765/preview.html`.

## Exercised review loop

The [render-review harness](../skills/scientific-diagrams/scripts/render-review.mjs) and [protocol](../skills/scientific-diagrams/references/review-loop.md) render 14 frames at 720px light/dark and 534px narrow desktop. A critique must bind to the current renderer, storyboard, presentation and frame fingerprint and cover every view/time and each source/geometry/visual/temporal gate. Missing review remains needs-review; failed gates/must-fix defects require repairs. Four rejected rounds are the ceiling; a fifth unresolved verdict stops at repair-limit. This is a local author-agent loop, not independently validated worker generation.

Two rejection rounds found moving-state/label collision, overlapping input headings, incorrect offline math sizing, and misleading addition notation. Repairs rerouted label space, switched headings discretely, made math properties explicit, and showed bracketed concatenation. Browser inspection also widened spacing around the input separator. The third critique approved the local fixture after all 42 offline and 42 actual-font browser frames were inspected. `.artifacts/animated-svg/review-loop/report.json` and `history.json` preserve the verdicts and fingerprints; native frames and filmstrips preserve render evidence. Offline labels use the installed review mono fallback; real typography acceptance comes from browser captures.

Meaningful checks pass for causal ordering, deterministic samples, interpolation, poster independence, XML safety, skill references and storyboard durations. The [guard check](../skills/scientific-diagrams/scripts/check-review-guards.mjs) rejects stale/malformed critiques and verifies repair-limit behavior. The official Python skill validator remains unavailable because PyYAML is absent; equivalent scaffold/frontmatter/reference checks ran with standard-library tools.

Desktop browser checks covered 1100px and 614px widths, inherited light/dark, live autoplay, a frozen mid-beat pause, resume without reset, and automatic offscreen pause/resume. The screenshot is `.artifacts/animated-svg/browser-preview-improved.png`. Reduced-motion preference changes, print, and hidden-page handling are code-inspected; no OS setting was changed for testing.

## Release boundary

This remains a local skill and source-grounded authored fixture. No app/worker schema, stored paper, library job, public route, or deployment changed. Product integration must use bounded semantic storyboards and stable equation associations, keep every publication gate, release compatible web validation/rendering before workers, and regenerate existing examples only through explicit reviewed preparation. No architecture/data-handling boundary changed, so AGENTS is unchanged.

## Additional mechanism evaluations

The follow-up [three-example evaluation](animation-example-evaluation-2026-10-01.md) adds LoRA and online softmax, checks their arithmetic against independent formulations, inspects117 browser frames, and fixes crowded annotation, ambiguous rescaling and SVG style leakage. The installed canonical skill includes the new fixtures and shared presentation primitives.
