import { prepareScene } from "../../src/lib/scene";

// Illustrative assignments following §3.2, not a reproduction of a paper experiment.
// https://papers.neurips.cc/paper_files/paper/2022/file/2f00ecd787b432c1d36f3de9800728eb-Paper-Conference.pdf
const tokens = ["t1", "t2", "t3", "t4", "t5", "t6"];
const experts = ["E1", "E2", "E3"];
export const expertChoiceScene = prepareScene({
  title: "Change who chooses. Change where compute goes.",
  description: "Six illustrative tokens and three experts: token top-1 gives expert loads 3, 2, 1. Expert top-2 gives each expert two tokens, while t5 gets no expert and t6 gets two. Arrows show selection, not data movement.",
  footnote: "Selection only; FFNs, weighted merging, and residual paths are omitted.",
  nodes: [], edges: [],
  illustration: {
    takeaway: "Fixed choices per token become fixed capacity per expert.",
    panels: [
      {
        kind: "routing", title: "Token choice · top-1", illustrative: true, sourceIds: ["method"],
        caption: "Each token chooses one expert. Expert loads vary: 3, 2, 1. Arrows show selection.",
        leftLabel: "Tokens", rightLabel: "Experts", left: tokens, right: experts,
        direction: "left-to-right", counts: "both",
        leftCountUnit: { singular: "expert", plural: "experts" }, rightCountUnit: { singular: "token", plural: "tokens" },
        links: [{ left: 0, right: 0 }, { left: 1, right: 1 }, { left: 2, right: 0 }, { left: 3, right: 2 }, { left: 4, right: 0 }, { left: 5, right: 1 }],
      },
      {
        kind: "routing", title: "Expert choice · top-2", illustrative: true, sourceIds: ["method"],
        caption: "Each expert chooses two tokens. All buckets have size 2; t5 gets 0 experts and t6 gets 2.",
        leftLabel: "Tokens", rightLabel: "Experts", left: tokens, right: experts,
        direction: "right-to-left", counts: "both",
        leftCountUnit: { singular: "expert", plural: "experts" }, rightCountUnit: { singular: "token", plural: "tokens" },
        links: [{ left: 0, right: 0 }, { left: 2, right: 0 }, { left: 1, right: 1 }, { left: 5, right: 1 }, { left: 3, right: 2 }, { left: 5, right: 2 }],
      },
    ],
  },
});

export const expertScoresPanel = {
  kind: "matrix" as const, title: "Select down each expert column", illustrative: true, sourceIds: ["method"],
  caption: "Illustrative affinity scores. Highlight the top two tokens in each column, not each row.",
  rowLabel: "Tokens", columnLabel: "Experts", rows: tokens, columns: experts,
  values: [["0.60", "0.30", "0.10"], ["0.40", "0.50", "0.10"], ["0.50", "0.20", "0.30"], ["0.20", "0.40", "0.40"], ["0.34", "0.33", "0.33"], ["0.20", "0.45", "0.35"]],
  selected: [{ row: 0, column: 0 }, { row: 2, column: 0 }, { row: 1, column: 1 }, { row: 5, column: 1 }, { row: 3, column: 2 }, { row: 5, column: 2 }],
  normalization: "row-normalized" as const, selectionRule: { axis: "column" as const, k: 2 },
};

export const expertObjectScene = prepareScene({ ...expertChoiceScene, illustration: {
  ...expertChoiceScene.illustration!, panels: expertChoiceScene.illustration!.panels.map(panel => ({ ...panel, presentation: "buckets" })),
} });
