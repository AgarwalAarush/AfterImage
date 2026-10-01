# AfterImage integration boundary

Resolve paths from repository root and re-read current code before changes.

## Current gap

`src/lib/types.ts` defines `Recall.equations[].example` as an optional string. `src/components/paper-view.tsx` renders it with `RecallText` in `.math-example`, with no visual reference/playback state.

`src/lib/study.ts` defines reviewed figures placed at `mechanism` or `evidence`, including static typed illustrations and switchable networks. It currently has no equation-example association or animation storyboard.

`worker/index.ts` requests example prose during recall generation. Separate study generation uses `studyPrompt` and validates/reviews the pack. Installing a skill changes neither prompt nor publication schema. The reader assistant's isolated runtime is not a path for arbitrary SVG generation.

## Existing pipeline to reuse

- `docs/diagram-creation-v3.md`: visible proof/visual encoding, source-supported typed panels, source/geometry/technical/visual gates, bounded repair.
- `src/lib/scene-illustration.ts`, `scene-illustration-svg.ts`: semantic objects, validation, deterministic geometry/glyphs.
- `src/lib/scene-layout.ts`: obstacle-aware dependencies/layout.
- `worker/diagram-review.ts`: font-outline inspection and defect rubric. Final-frame review alone cannot prove temporal correctness.
- `src/lib/diagram-theme.ts`, `export-diagram.ts`: presentation colors and standalone export colors.
- `src/components/paper-study.tsx`: supplementary figure presentation and state controls.
- `worker/generation-schema.ts`, `worker/output-schema.ts`, publication API: extend all boundaries, not just TypeScript.

Use `flow-v2` for dependency graphs, `explanatory-v3` for concrete panels; preserve legacy/stored geometry. Models supply bounded semantics, never SVG/coordinates.

## Extension when product integration is requested

Add an optional bounded, versioned worked-example animation in the reviewed study supplement, addressed by a stable equation ID. Add equation IDs before associations; array indices shift during repairs. Reject duplicate/unknown IDs, unsupported sources, and invalid semantic targets.

Keep prose as accessible fallback. Hide unchecked drafts when study is queued/running/failed. Decide explicitly whether a failed animation withholds the supplement or is omitted under existing publication rules. Unreviewed partial output is never ready.

Generate storyboard from equation/example; render deterministic geometry using existing panels or a narrow typed renderer. Require source/semantic review, every-beat geometry, and rendered temporal review; bounded repair follows the existing worker ceiling.

Browser playback applies presentation-only timing/highlights. Keep stored semantics deterministic. Library JSON alone needs no new bridge action. Keep raw worker errors/leases and executable assets out of browser state.

Release web validation/rendering before workers, let active jobs finish, and verify actual live queue/APIs. Older APIs can strip fields. Regenerate stored examples only through explicit reviewed preparation. A local authored preview does not prove production generation/deployment.

Read installed `node_modules/next/dist/docs/` before Next.js code. Update README/docs and AGENTS if boundaries change. This skill and standalone example do not implement that extension or release.

## Editorial web integration (October 1)

`src/lib/worked-examples.ts` selects one reviewed authored figure using paper identity, saved source and matching equation semantics. `src/components/worked-example.tsx` owns visibility-aware native playback and inherited colors. `public/worked-examples/manifest.json` records reviewed fingerprints and shipped hashes. This curated web path does not extend worker schemas or automate generation; all future generated-animation boundaries above still apply.
