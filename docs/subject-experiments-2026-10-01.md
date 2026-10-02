# Original subject experiments

The Subjects reader uses authored numeric computations and native SVG drawing, with AfterImage appearance tokens applied in the browser. No reference-site animation code or visual assets are included. Figure questions stay beside the interaction; the surrounding lesson explains assumptions and interpretation. Review captions and scope remain in the content schema but are not repeated below every figure.

## Teaching through geometry

Attention shows one query connected to four keys with widths derived from normalized weights. Graph aggregation retains the three-node chain and updates its node features. Search retains binary-tree topology and displays unknown leaf values as question marks. Optimization, recurrence, Euler integration, Gaussian densities, and scalar guidance use connected numeric curves with fixed domains. Matrix experiments expose row and column identities, memory experiments distinguish live, padded, and unallocated slots, and all numeric tables derive from the same state as their drawings.

## Exact online attention

`streaming-attention` holds four key scores `[2, 1, 0, -1]` and scalar values `[3, 5, -2, 1]` fixed. The owner can change tile width from one to four and visit tiles in either direction. After each tile the renderer shows the running maximum `m`, normalizer `ℓ`, weighted accumulator `u`, and partial output `u / ℓ`. The update rescales the previous accumulators by `exp(m_previous - m_new)` before adding the tile. Reverse order makes this rescaling visible. Empty-state maximum and output remain unavailable until the first tile arrives.

Every completed partition yields the same dense softmax-weighted result. Playback advances actual tile states, holds the final state, and resets to the empty state. Previous/next controls permit inspection without playback. The print view uses the complete poster.

Reset restores the initial two-score tile width, reverse visit order, and empty accumulation state. SVG coordinates, dimensions, paths and opacities are rounded to four decimal places at the presentation boundary to resolve observed ulp-scale hydration mismatches. Scientific calculations retain their full precision. Short numerical trajectories deduplicate repeated axis sample indices.

## Rotatable RMS spheres

`noise-shells` projects two ideal thin spheres about one data point with `D = 3` and `d = 0`. Outer `σ = 1` fixes its RMS radius at `√3`; the inner control changes its radius to `σ√3`. Each sphere uses the same 240 seeded unit directions scaled to its own radius. Point identities persist across drag, keyboard, automatic camera rotation, and visibility changes. Perspective and opacity derive from the shared camera pose; rotation changes neither radius nor scientific state. The native canvas is 420px tall with a 140px outer display radius at normal desktop widths; below a 500px column it recomposes at 350px height. Its inline height and viewBox agree, preserving readable labels when global SVG rules load in a different order.

These are explicitly ideal RMS surfaces. The lesson must explain the spread of actual noisy observations and the dimensions under which concentration applies. The drawing does not supply an empirical noise distribution or a high-dimensional projection.

## NeRF ray accumulation

`volume-rendering` evaluates the sampled volume-rendering recurrence in [NeRF, Section 4, Equation (3)](https://arxiv.org/html/2003.08934#S4). The source ledger's `c3` and `c4` establish the continuous integral and front-to-back sample weights; the private primary excerpt includes the explicit alpha and transmittance equations. A constructed finite ray has four unit-length intervals, with fixed RGB values `[(.85,.25,.15),(.2,.65,.35),(.2,.35,.85),(.8,.65,.2)]`. Only the front sample's density varies from zero to four; later densities stay at `[.5,1.5,.75]`.

Each sample computes `αᵢ = 1 − exp(−σᵢΔᵢ)`, starting with `T₁ = 1`, followed by `wᵢ = Tᵢαᵢ` and `Tᵢ₊₁ = Tᵢ(1 − αᵢ)`. The last transmittance weights an explicitly white background `(1,1,1)` beyond the finite ray. Final RGB is `Σ wᵢcᵢ + T₅c_background`. This declared boundary condition makes the total color weights sum to one. Constructed values provide a worked calculation rather than reported scene measurements.

The native ray preserves sample positions, identities, interval lengths, and emitted colors across density changes. Per-sample alpha, prefix transmittance and weight appear beneath each sample. A shared contribution strip represents all four weights plus the surviving background; its fixed total width permits comparison across the slider range. The final pixel swatch and numeric RGB derive from exactly those weights. Physical color swatches retain their declared RGB across appearance changes, while text, borders and controls use browser-local theme tokens. The inspectable table exposes every input and intermediate quantity.

The lesson must connect increasing front density to reduced visibility of later samples and explain the white finite-ray boundary. A fixed four-interval computation does not exercise a learned field, stratified sampling, hierarchical resampling, view-dependent prediction or measured reconstruction quality. The source-gated lesson refinement remains responsible for adopting this figure and linking its explanation to the primary claims. Computation, occlusion, conservation and stable geometry tests pass; browser acceptance remains required before release.

## Playback and acceptance

Playback is owner-initiated and pauses on explicit pause, document hiding, or leaving the viewport. Reduced-motion preference changes pause playback. Camera rotation and tile timing express teaching interactions, with no latency interpretation.

## SmoothQuant paired scaling

`paired-scaling` implements [SmoothQuant, Section 4, Equations (3) and (4)](https://arxiv.org/html/2211.10438#S4) on constructed matrices `X = [[8,2,-1],[-4,1,.5]]` and `W = [[.5,-.25],[1,.5],[-1,.5]]`. Primary claims `c6`, `c8`, and `c9` support the paired transform, scale rule, and difficulty tradeoff. The activation-channel maxima are `[8,2,1]`, while matching weight-row maxima are `[.5,1,1]`. The continuous migration control gives `s_j = a_j^α / b_j^(1−α)`. Activation columns divide by `s_j` and weight rows multiply by the same value, preserving each channel contribution and therefore `XW`.

The renderer shows actual original and transformed maxima on fixed amplitude axes, with complete input/scaled matrices and both matrix products in the numeric table. At `α=.5`, scales `[4,√2,1]` give paired activation/weight maxima `[2,√2,1]`; every `α` retains output `[[7,−1.5],[-1.5,1.75]]`, up to floating-point roundoff. This calculation stops before quantization. It neither simulates calibration nor infers measured accuracy, rounding error, throughput, or an optimal model-specific migration strength. The independent source/teaching/experiment/quiz review must replace the former standardization contrast in the lesson's `s3`.

## Mistral causal window and rolling cache

`rolling-window` teaches the two formulas in [Mistral, Section 2](https://arxiv.org/html/2310.06825#S2), supported by primary claims `c5` and `c8`: inclusive causal eligibility `i−W…i` and cache slot `i mod W`. It declares a read-before-write instance with `W=4` previous-token slots, positions `0…11`, and the current position's locally computed key/value available separately. Before query `i`, four slots retain the previous positions `max(0,i−4)…i−1`. The query reads those cached states plus current `i`; it then writes current `i` into slot `i mod4`, overwriting `i−4` after that state has participated in the read. The updated cache retains the latest four states for the next query.

This explicit phase convention preserves both cited formulas: four stored previous states and the current local state can supply up to five inclusive eligible positions. The lesson must define this convention rather than silently treating a cache already containing current `i` as five slots. Stable rows show causal eligibility and cache identities before/after insertion; the numeric table exposes each write and eviction. It does not generate attention weights, model output, layered-reach predictions, pre-fill chunking, measured memory capacity, or throughput. The independent review must replace the former allocation-padding analogy in `s4` and verify the phase explanation against the primary evidence.

Tests sweep SmoothQuant's migration range, verify every per-channel product and complete output, and check the balanced/end-point maxima. The rolling cache is tested sequentially at all twelve positions: before-state equals the preceding after-state, eligibility never reaches the future, modulo writes preserve slot identities, and the oldest key is read before eviction. Native desktop/narrow/light/dark previews are inspected independently of actual browser control acceptance. Neither addition edits the mechanism renderer's fingerprint files.

## Continuous controls

The shared `SubjectRange` retains the native range input and keeps its pointer position continuous (`step="any"`). Integer scientific quantities—rank, bit width, block width, selected experts, aggregation rounds, search visits, retrieval count, and attention tile width—derive separately from that position. A thumb at 2.41 can therefore move freely while a two-score tile remains exactly two scores. Continuous parameters feed their actual numeric value into the computation; visible readouts round only their text. Arrow keys use each experiment's declared semantic increment, Page Up/Down use ten increments, and Home/End select the bounds.

Pointer interaction updates immediately, with no transition, spring, or trailing interpolation. The range surface is transparent and unboxed; keyboard focus receives a ring around the thumb. Generic parameter exploration follows a linear animation-frame clock in both directions, with a 900ms hold at each bound and no reset jump. Each direction takes 5.5 seconds across the range. Pause retains phase and direction; manually choosing a value starts forward exploration from that position, and manual changes pause playback. Sphere rotation also updates each frame. Attention playback continues to advance complete, exact tile states rather than interpolating nonexistent accumulator states.

Following the Emil design and animate skill guidance, functional controls remain direct and motion serves inspection of the displayed computation. Static per-dimension seeded Gaussian norms are cached before scaling so continuous noise adjustment does not regenerate the same sample on every frame. Discrete drawings memoize their numeric state and SVG subtree while the raw thumb moves between valid quantities.

Euler and Gaussian curves use exact numeric abscissae independently of their display labels. A short final Euler interval stays at its actual time during continuous adjustment, and quarter-unit Gaussian samples retain their exact horizontal positions. Only text and final SVG attributes are rounded.

| Before | After | Why |
| --- | --- | --- |
| Whole-number native steps snapped the thumb between tick positions. | Raw pointer positions remain continuous; diagrams derive valid counts separately. | Smooth dragging preserves exact rank, tile, token, and selection math. |
| A focus outline surrounded the entire range input during pointer adjustment. | Transparent track and thumb-only keyboard focus cue. | The active thumb stays legible without enclosing the control in a box. |
| Generic playback updated in quantized 80ms bursts. | Linear animation-frame parameter movement and camera rotation. | Continuous quantities move smoothly; discrete algorithm steps remain discrete. |

The range tests cover continuous positions, discrete scientific values, meaningful keyboard increments, exact extrema, adjacent playback frames, continuity at both endpoint holds and the cycle boundary, pause/resume direction, resuming from a manually chosen parameter, and accessible slider markup. Actual browser pointer/focus rendering remains a release acceptance check.

The deterministic tests validate finite geometry at normal and narrow desktop widths, graph/tree relationships, reference curves, every tile partition and order against dense attention, intermediate sums, sphere norms, projection bounds, and stable visibility identities. Native SVG multi-beat previews are ignored artifacts under `.artifacts/subjects/experiment-review/`; their offline font fallback is not a substitute for browser review in the application's inherited Overused Grotesk face. This work does not change stored paper diagrams or production workers.

The local browser fixture audit checked all 25 experiment families at 1142px and 361px native drawing widths: every visible SVG text label remained inside its canvas, with matching native height and viewBox. Home/End interaction checked all 50 minimum/maximum states in the browser, with finite readouts, correct control bounds, and complete labels. Light/Dark screenshots inspected online-softmax, RMS spheres, paired scaling, ray accumulation, and the rolling cache. Actual pointer dragging moved the tile-width thumb to 2.451 while its scientific value stayed 2; Arrow Right selected 3 with keyboard focus. Reset produced the empty online-softmax state, two exact tile steps recovered the dense output, shell visibility selected 240 of 480 stable points, and keyboard/animated camera rotation changed projection. Playback and pause retained the shell pose and paired-scaling parameter; reset restored the scaling control to 0.5 while its matrix product stayed fixed. These are local browser checks, not a production release.
