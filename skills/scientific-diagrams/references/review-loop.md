# Render → inspect → critique → repair

Run this loop during authoring. It does not schedule recurring jobs or run an unattended model. The agent supplies the source-backed critique and targeted repair. Product integrations retain their existing validators/reviewers.

## Commands

From the repository root, with a runtime project containing `@resvg/resvg-js`, `sharp`, `cheerio`, KaTeX fonts and AfterImage review fonts:

```sh
node skills/scientific-diagrams/scripts/build-example.mjs
node skills/scientific-diagrams/scripts/render-review.mjs \
  --scene skills/scientific-diagrams/examples/state-reuse.mjs \
  --out .artifacts/animated-svg/review-loop \
  --runtime /absolute/path/to/AfterImage
```

Each adapter exports `render({time,theme,poster})`, bounded `sampleTimes`, `posterTime`, optional `semanticState(time)`, and `reviewFiles` relative to the scene module. Put source/storyboard and browser presentation files in reviewFiles so changing them invalidates old critiques. The shipped adapter is a state-reuse fixture, not a generic paper renderer.

The harness renders 14 before/after/midpoint frames at 720px light/dark and 534px narrow desktop. Native frames are authoritative for outline/geometry review; contact sheets show continuity. Offline frames use KaTeX outlines and the installed review mono as a fallback for DM Sans. Verify the actual DM Sans/math fonts and all movement in browser captures; offline fallback is not exact typography acceptance. Serve examples and use author-only `preview.html?frame=10000&theme=light` for deterministic browser inspection. The ordinary preview has only Play/Pause.

Inspect every frame/view against the source, accessible description, poster and final invariant. Record the report fingerprint in a critique:

```json
{
  "fingerprint": "copy-current-report-fingerprint-after-inspection",
  "reviewedTimes": [0,1600,3200,4200,5200,6400,7200,8200,9000,10000,11200,13200,15200,15800],
  "reviewedViews": ["dark-720", "light-720", "dark-534"],
  "gates": {"source":true,"geometry":false,"visual":false,"temporal":true},
  "issues": [{
    "category":"text-shape-collision", "severity":"must-fix",
    "location":"dark-720, 10000ms, reuse label",
    "evidence":"Moving state covers its label.",
    "repair":"Move label outside the state's swept bounds."
  }]
}
```

Submit with the same command plus `--review /path/to/critique.json`. Stale fingerprints and incomplete frame/view/gate coverage are rejected. False gates or must-fix issues produce `repair-required`; omitted critique produces `needs-review`. Only an explicit complete critique with every gate true and no must-fix issues produces `approved`.

Apply the smallest source/geometry/timeline/copy change, rerender, inspect, and submit a new critique. Four rejected rounds are the ceiling; the fifth unresolved verdict becomes `repair-limit`. Keep the same output directory/history for one evaluation; never evade the ceiling by moving folders. Archive source and frames before a repair if needed to preserve reproducible history. Approval is local author review, not worker publication approval.

## Defects

Reuse clipping, small text, text/shape/connector collision, spacing, uneven balance, arrowheads, inconsistent strokes, weak contrast, detached labels, wrong notation, misleading emphasis, unsupported claims, and missing visual mechanism. Add premature result, identity discontinuity, false serialization, hidden persistence, swept collision, and ambiguous reset. A merely highlighted stage name fails if the defining operation remains invisible.

## Exercise record

The EAGLE fixture was reviewed and repaired: the state tile crossed its reuse label; input headings overlapped at substitution; offline math font shorthand defaulted to the wrong size. Browser inspection then exposed insufficient spacing around the input separator, which was corrected. A second source review replaced misleading addition notation with bracketed concatenation. The later report/history and browser captures record final coverage. The loop does not fabricate independent reviewer consensus; this is one author-agent's local evaluation.
