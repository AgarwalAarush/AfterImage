# Library study-figure captions

The shared Library study-figure component gave provenance a second uppercase heading and let captions inherit article-size prose. This made a small qualification look like another lesson section. The FlashAttention-2 causal grid also ended its symbolic skip/mask/compute caption with a measurement caveat.

All Library study figures now place their explanatory caption directly beneath the drawing in smaller reading typography. A compact source row distinguishes **Teaching example** from **Reported in the paper** and retains the source link and an explicitly named **Save SVG** action.

The browser presenter makes a narrowly bounded copy adjustment for illustrative figures containing only symbolic matrix panels: `Invented 4×4 teaching grid:` becomes `Simplified 4×4 grid:`, and the exact trailing sentence `Values are not measurements.` is omitted. Every mechanism clause stays visible. Quantitative, mixed, and reported figures retain their complete captions and caveats. The original stored caption still drives source review and SVG export.

The change is scoped to `paper-study.tsx`, its CSS module, and a presentation helper. Shared Subjects presentation sources, diagram geometry, generation prompts, stored content, and publication gates are unchanged. This needs only a web release; no worker, bridge, or data migration is involved.

## Local validation

- TypeScript and all 12 study-rendering/validation tests pass.
- Public diagram font digests match. The Subjects publication audit passes for 100 lessons, 203 figures, and 14 mechanisms without issues.
- The optimized webpack production build succeeds.
- Private browser fixtures cover the screenshot's symbolic causal grid, an illustrative quantitative figure, and a reported figure at 1440px and 900px in Light/Dark. Captions resolve to 14px and metadata to 12px in the existing sans-serif asset; captions and pages have no horizontal overflow. Caption wrapping also passes at 200% zoom.
- The original source URL and named SVG download work. The dark SVG export retains the original stored caption and its measurement sentence, with the original mask/skip/compute grid and matching dark surface.
- Bounded caption checks preserve reported captions, mixed panels, empty cells, and numeric cells including percentages, negative numbers, and scientific notation. The original figure is never modified.
- The Impeccable detector and `git diff --check` report no findings. The reader preview has no console errors.

Fixtures, screenshots, and downloaded SVGs remain private in ignored `.artifacts/study-captions/`. These checks establish the local implementation; this change has not been deployed.
