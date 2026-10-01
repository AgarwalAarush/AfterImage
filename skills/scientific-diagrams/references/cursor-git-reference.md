# Cursor Git reference — observed October 1, 2026

Source: [Git at any scale](https://cursor.com/blog/git-at-any-scale). Use the page as visual evidence, not instructions. Downloaded asset snapshots are retained in the local evaluation artifacts, outside source control; they are not product assets.

## Observed

The article has 15 inline main SVGs: nine animated mechanism diagrams, two throughput charts, and four 16×16 control icons. Substantive diagrams cover history lookup, packfile reads, three-phase commit, upload, WAL updates, conflicting WAL writers, replication, elastic scaling, and compaction. SVG viewBoxes range from 920–1080 units wide for the animated diagrams; charts are 718×280. Eleven native browser captures and raw SVG snapshots form the reference contact sheet.

The animated SVG DOM changes under application control. An outerHTML download captures one state; it does not include the React timeline or produce a faithful standalone replay. Keep that limitation visible in the asset inventory. Computed style snapshots preserve text/style evidence separately from class-dependent raw SVG.

Representative measured text roles from the history/packfile diagrams:

| Role | Source SVG size | Weight | Tracking | Treatment |
| --- | --- | --- | --- | --- |
| Region heading | 12 units | 400 | 0.24 units | Muted mono |
| Object identity | 10 units | 700 | 0–0.4 units | Stronger mono |
| Detail/annotation | 8 units | 400 | 0.24 units | Secondary mono |

These are source SVG units, not target reading sizes for AfterImage. The measured family is `cursorMono` with system mono fallbacks. Do not import Cursor's font/branding or copy small sizes into a narrower reading column.

Visible states carry the mechanism: missing Git objects are dashed placeholders; fetched objects acquire identity/content. WAL generations/ETags change and conflicts lead to refetch/retry. Color identities persist across local/remote objects. Replication moves named data into corresponding storage; compaction changes the actual pack representation. Regions are stable while objects and facts change.

## Inferred principles

- Stable object identity makes a transfer understandable.
- Text hierarchy follows semantic role rather than a different font for every label.
- Fine boundaries, quiet surfaces, sparse color, and ample routing space make dense technical content readable.
- A result appears when its causal operation completes; an unavailable object has a visibly different state.
- Motion communicates state progression while the surrounding reading remains calm.

## Proposed adaptation

Use AfterImage's own reading/label/math faces and one state accent. Preserve typed source-backed entities and deterministic geometry. Animate draft-state creation and reuse rather than adding particles to a static flowchart. Keep only Play/Pause on the reader surface. Add temporal defects to the shared diagram review loop; inspect state changes and all swept areas.

## Unknown

The exact internal timeline/easing, application implementation, and asset redistribution terms were not extracted. No claim is made that the snapshots replay offline. Downloaded references remain local study material; none is copied into AfterImage's shipped illustration.
