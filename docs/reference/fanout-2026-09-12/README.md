# Fanout reference capture

Captured from the public lottery-ticket paper page and labs page on 2026-09-12 using browser inspection. These are third-party reference assets for local analysis. Keep them outside production assets; implement AfterImage's own styling and figures from the extracted principles.

- `site.css`: observed `index-BU2C1CDc.css`.
- `paper-and-diagrams.css`: observed `DailyExplainerOpening-ByZXUsmb.css`, including article layout, lottery diagrams, interactive figure styling, mobile, reduced-motion and print rules.
- `brand.css`: observed `brand-q-gmNaul.css`.
- `asset-manifest.json`: original browser bundle manifest with source URLs and capture paths; the temporary paths are historical, not durable project paths.
- `lottery-desktop.svg`: exact observed opening desktop markup, 4718 characters excluding trailing newline.
- `lottery-mobile.svg`: exact observed portrait opening markup, 2134 characters.
- `lottery-interactive-original.svg`: exact observed original-initialization state, 2617 characters.
- `lottery-bars.svg`: exact observed evidence chart markup, 1842 characters.

These SVGs depend on CSS class styling and fonts; they are DOM source captures rather than self-contained styled exports. The source font files and site logo were not downloaded. The random-initialization state was exercised and inspected: nodes and edges stay fixed, values change from `+.12 / −.08 / +.31 / +.06` to `−.27 / +.19 / −.04 / +.22`, and the stage/readout changes with `data-mode="random"`.

Full analysis: [design-reference.md](../../design-reference.md). Implementation proposal: [development-plan.md](../../development-plan.md).
