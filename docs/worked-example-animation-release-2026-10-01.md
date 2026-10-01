# Reviewed worked-example animations

The web reader now attaches one curated editorial animation to the matching equation in a readable notecard. EAGLE-3's draft recurrence uses the reviewed state-reuse example; LoRA's forward equation uses the rank-one calculation; FlashAttention's online maximum/rescaled-denominator equation can use the online-softmax example. A paper ID alone is insufficient: the saved equation must match the mechanism and refer to an existing saved source. The first matching equation receives the figure; array positions are not stored associations. Unmatched equations keep their original prose.

These are reviewed authored explanations, not newly generated reading-kit output. Public SVG/poster pairs are copied from the scientific-diagrams fixtures with namespaced IDs. The committed manifest records their reviewed frame fingerprints and deployed file hashes. Native text, embedded licensed fonts, scientific descriptions and all timing/geometry are retained. Read [example evaluation](animation-example-evaluation-2026-10-01.md) for source scopes, illustrative values and repaired defects.

The client fetches only allowlisted asset names from the curated registry. It does not accept URLs or SVG from the library or worker. It applies inherited page colors at the browser presentation boundary and scopes its host styles through a CSS module. Autoplay starts while visible, one Play/Pause button controls native SVG time, and explicit user pause survives leaving/reentering the viewport. Hidden pages pause. Reduced-motion users receive a still poster until explicit Play; printing uses the poster. Failed asset loading keeps the original worked prose. Stored prose also remains in Markdown exports.

This release changes no recall/study schema, database, signed bridge actions or worker prompts. No worker restart or stored-paper regeneration is needed. A future generated storyboard remains a separate bounded semantic schema with source, geometry, visual and temporal review gates and compatible web-before-worker release order; installing the skill does not enable it.

Release verification is recorded below after deployment. Local checks cover mechanism matching, native asset references/hashes, playback state, independent fixture arithmetic, typechecking, the full existing test suite, production build and the full desktop reader.

## Local acceptance

All 112 tests, typechecking and the optimized production build passed. The built reader used an isolated snapshot of the current library; no production records were changed. EAGLE-3 was verified in inherited light/dark appearance, native pause/resume and the assistant split view at 1280px and 1100px desktop widths. The 1100px split view gives the SVG 542px, preserves full bounds and one control, and retains legible mathematical text. A pause check compared actual animated group opacity before and after elapsed time. LoRA's forward equation receives the rank-one fixture and inherits light appearance.

The React review checked parallel fetching, cancellation, lifecycle cleanup, primitive effect dependency, one control with an accessible name and inherited presentation colors. No unresolved must-fix issue was found. Vercel's dry inventory includes the seven reviewed public assets and excludes skill sources, private artifacts, environment files and local databases.
