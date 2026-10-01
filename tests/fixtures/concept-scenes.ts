import type { Scene } from "../../src/lib/types";
import { prepareScene } from "../../src/lib/scene";

// Teaching parameters, not experimental measurements. AEVB §2.4 and Adam algorithm 1.
const common = { illustrative: true, sourceIds: ["method"] };
export const distributionScene = prepareScene({
  title: "Learn a distribution. Sample a latent state.",
  description: "Encoder branches into mean and scale parameters of a Gaussian. Independent noise combines with them into a latent sample for the decoder.",
  footnote: "One illustrative scalar latent coordinate; vectors and the training objective are omitted.", nodes: [], edges: [],
  illustration: { takeaway: "The encoder learns μ and σ; independent ε determines each draw.", panels: [{
    ...common, kind: "schematic", title: "Reparameterized sampling", caption: "For this example μ=0, σ=1 and ε=0.4, so z=0.4. The curve shows the Gaussian and the dot marks z.",
    nodes: [
      { id: "encoder", glyph: "module", label: "Encoder", detail: "input x" },
      { id: "noise", glyph: "vector", label: "Independent noise", detail: "ε from N(0,1)", values: ["0.4"] },
      { id: "mean", glyph: "vector", label: "Mean μ", detail: "learned from x", values: ["0"] },
      { id: "scale", glyph: "vector", label: "Scale σ", detail: "learned from x", values: ["1"] },
      { id: "latent", glyph: "gaussian", label: "Latent sample z", detail: "z = μ + σ·ε", mean: 0, deviation: 1, sample: .4 },
      { id: "decoder", glyph: "module", label: "Decoder", detail: "receives sampled z" },
    ],
    edges: [
      { from: "encoder", to: "mean", label: "learn mean", dashed: false },
      { from: "encoder", to: "scale", label: "learn scale", dashed: false },
      { from: "mean", to: "latent", label: "location", dashed: false },
      { from: "scale", to: "latent", label: "spread", dashed: false },
      { from: "noise", to: "latent", label: "independent draw", dashed: true },
      { from: "latent", to: "decoder", label: "sample z", dashed: false },
    ],
  }] },
});
export const gaugeScene = prepareScene({
  title: "Small denominators amplify early moment estimates.",
  description: "Two calibrated gauges show Adam's first and second moment correction denominators at step two with beta1=0.9 and beta2=0.999. Their inverses multiply the raw estimates.",
  footnote: "Illustrative step t=2; the parameter update and square-root operation are omitted.", nodes: [], edges: [],
  illustration: { takeaway: "At t=2, the second-moment correction multiplier is about 500×.", panels: [{
    ...common, kind: "schematic", title: "Adam bias correction", caption: "Both gauges use the same 0–1 scale. Divide each raw moment by its own denominator; these are separate corrections.",
    nodes: [
      { id: "first", glyph: "gauge", label: "First moment", detail: "1−β₁²; β₁=0.9", value: .19, inverse: true },
      { id: "second", glyph: "gauge", label: "Second moment", detail: "1−β₂²; β₂=0.999", value: .001999, inverse: true },
      { id: "corrected", glyph: "vector", label: "Corrected moments", detail: "separate estimates", values: ["m-hat", "v-hat"] },
    ],
    edges: [
      { from: "first", to: "corrected", label: "m / denominator", dashed: false },
      { from: "second", to: "corrected", label: "v / denominator", dashed: false },
    ],
  }] },
});

export const sparseAllocationScene = prepareScene({
  title: "Keep the assignments. Change the allocated shape.",
  description: "Fixed-capacity expert lanes leave empty cells; unequal sparse regions preserve the same six illustrative block identities with different expert loads.",
  footnote: "Divisible teaching loads; boundary padding, dispatch, and restoration are omitted.", nodes: [], edges: [],
  illustration: { takeaway: "Shared capacity reserves nine blocks; these unequal regions use six.", panels: [
    { ...common, kind: "allocation", title: "Common capacity", caption: "Three positions per expert leave three padded positions. Every identity is preserved.", unit: "1 block = 128 token rows", arrangement: "lanes", groups: [
      { label: "E1", capacity: 3, items: ["a0", "a1", "a2"] }, { label: "E2", capacity: 3, items: ["b0", "b1"] }, { label: "E3", capacity: 3, items: ["c0"] },
    ] },
    { ...common, kind: "allocation", title: "Block-sparse regions", caption: "Expert-width columns collapse to one region each. This divisible example needs no padded block; boundary padding can remain.", unit: "1 block = 128 token rows", arrangement: "diagonal", groups: [
      { label: "E1", capacity: 3, items: ["a0", "a1", "a2"] }, { label: "E2", capacity: 2, items: ["b0", "b1"] }, { label: "E3", capacity: 1, items: ["c0"] },
    ] },
  ] },
});

/** Greedy example: an extra sibling proposal permits one more verified token. */
export const tokenTreeScene: Scene = prepareScene({
  title: "A shared prefix supports several proposed continuations",
  description: "An illustrative greedy verification comparison. P represents an already verified prefix; matched proposals and the appended target fallback are distinct.",
  footnote: "One target pass verifies alternatives; one continuation commits.",
  nodes: [], edges: [],
  illustration: { takeaway: "A sibling alternative can extend the matched path beyond a single speculative chain.", panels: [
    { kind: "tree", title: "One proposed chain", caption: "P is verified context. B mismatches; target C follows the matched proposal A.", illustrative: true, sourceIds: ["method"], prefixLabel: "Verified prefix", verificationLabel: "One sequence-verification pass", targetToken: "C", nodes: [
      {id:"p",parentId:null,token:"P",status:"accepted"},
      {id:"a",parentId:"p",token:"A",status:"accepted"},
      {id:"b",parentId:"a",token:"B",status:"rejected"},
      {id:"e",parentId:"b",token:"E",status:"rejected"},
    ] },
    { kind: "tree", title: "Sibling alternatives", caption: "A appears once. The target selects sibling C, then appends target D after the matched proposals.", illustrative: true, sourceIds: ["method"], prefixLabel: "Verified prefix", verificationLabel: "One ancestor-masked LLM pass", targetToken: "D", nodes: [
      {id:"p",parentId:null,token:"P",status:"accepted"},
      {id:"a",parentId:"p",token:"A",status:"accepted"},
      {id:"b",parentId:"a",token:"B",status:"rejected"},
      {id:"c",parentId:"a",token:"C",status:"accepted"},
    ] },
  ] },
});
