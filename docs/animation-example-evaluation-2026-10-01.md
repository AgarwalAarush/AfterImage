# Animation example evaluation — October 1, 2026

The initial iteration tested one EAGLE-3 state-reuse fixture. This follow-up adds two different source-backed worked mechanisms using the scientific-diagrams skill and its render/review loop. These are authored local fixtures, not a production worker generation benchmark.

| Example | Scientific check | Browser samples |
| --- | --- | --- |
| EAGLE-3 | State precedes proposal; the same state enters the next input; tokens remain unverified | 42 |
| LoRA | A(1×2)x(2×1) gives scalar1; B(2×1) gives [3,2]; frozen W₀x=[2,1]; sum=[5,3] | 36 |
| Online softmax | New maximum rescales prior ℓ and u by1/2; final ℓ=3/2,u=10; output20/3 equals direct softmax weighted sum | 39 |

Each fixture was rendered at 720px light/dark and534px narrow desktop; browser viewports were1100px and614px. All117 browser frames cover beats, transition samples, final holds and fades. New fixtures share authored presentation primitives and scoped SVG CSS. After scoping,111 figure crops matched their earlier pixels exactly; six fade samples differed and were inspected. Across every sample, page captions remained14px and SVG captions18px. SVG styles no longer leak into surrounding reading text.

## Source and numeric scope

[LoRA §4.1 Eq.3](https://arxiv.org/html/2106.09685#S4.SS1) supplies the shared input, frozen W₀, low-rank BA branch and coordinate-wise sum, including alpha/r scaling. The displayed matrices are invented learned parameters with rank1 and alpha1; this is not LoRA's zero-B initialization. Both branches appear together at their first result; timing guides attention rather than asserting serial latency.

[FlashAttention §3.1 Algorithm1](https://arxiv.org/pdf/2205.14135) supplies the changing maximum and rescaled contributions. The fixture uses a derived equivalent numerator u=ℓO to show the arithmetic for one row with scores[0,ln2] and values[4,8]. It does not claim Algorithm1 stores u. The rescale-only intermediate is a calculation within the update, not a separate GPU write. Physical tiling, storage, masks, dropout and performance are omitted.

`check-example-math.mjs` checks LoRA's branch calculation against an independently assembled merged weight matrix, including rank2 and alpha/r≠1, and verifies that inputs/weights are not mutated. Online softmax is checked against direct stabilized softmax for four traces, including logits near±1000 and negative values. It also checks prefixes, the displayed20/3 result and temporal dependencies. These checks pass.

## Defects found and repaired

The softmax score/value line had about4px side padding; splitting its two fields onto separate lines restored space. Its rescaling annotation failed to name ℓ and u, potentially suggesting that m was also multiplied; the revised annotation identifies the affected quantities explicitly. Block focus follows the consumed source block.

Browser inspection also found that embedded SVG `.caption` selectors changed the host page's caption size from14px to18px. All three fixtures now scope their authored selectors to their SVG root, preserving the shared font-face declarations. Every browser sample verifies the distinct page/figure type sizes.

Critiques bind to current scene, shared primitives, storyboard, presentation and frame fingerprints. Reports/history are in `.artifacts/animated-svg/{review-loop,lora-rank-one,online-softmax}/`. The softmax history preserves its rejected round and final repair. Current explicit critiques approve the three local fixtures; this is one author-agent's evaluation, not independent reviewer consensus. Original worker gates remain unchanged.

## Preview and coverage

- EAGLE-3: `http://127.0.0.1:8765/preview.html`
- LoRA: `http://127.0.0.1:8765/preview.html?example=lora`
- Online softmax: `http://127.0.0.1:8765/preview.html?example=softmax`

The shared reader has one Play/Pause button and visible autoplay. Live checks confirm pause freezes the animation, resume continues, and offscreen behavior preserves user pause. XML, native text, embedded fonts, poster independence, source/scene references and deterministic frames are checked. Reduced-motion preference changes, hidden-page and print behavior remain code-inspected rather than OS/emulation-tested. No app release or stored diagram regeneration is involved.
