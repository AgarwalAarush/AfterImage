import type { Paper, Recall } from "./types";

type Equation = NonNullable<Recall["equations"]>[number];
export type WorkedExample = {
  slug: "eagle-state-reuse" | "lora-rank-one" | "online-softmax";
  intro: string;
  caption: string;
  sourceUrl: string;
  sourceLabel: string;
};

/** Editorial, reviewed assets only. A paper match alone never places a figure. */
export function workedExampleForEquation(paper: Pick<Paper, "id" | "sources">, equation: Equation): WorkedExample | null {
  if (!paper.sources.some(source => source.id === equation.sourceId)) return null;
  const id = paper.id.replace(/v\d+$/, "");
  const latex = equation.latex.replace(/\s+/g, "");
  if (id === "2503.01840" && latex.includes("[a_{i+1};e(x_{i+2})]") && latex.includes("D_")) {
    return {slug: "eagle-state-reuse", intro: "After proposing “do”, the draft reuses its own state to propose “it”.", caption: "Reusing the draft state avoids a new target pass. Tokens remain proposals until verification.", sourceUrl: "https://arxiv.org/html/2503.01840v1#S3.SS1", sourceLabel: "EAGLE-3 §3.1"};
  }
  if (id === "2106.09685" && latex.startsWith("h=") && latex.includes("W_0x") && latex.includes("BAx")) {
    return {slug: "lora-rank-one", intro: "A rank-one update adds a learned correction to the frozen model.", caption: "Illustrative learned parameters, rank 1 and α/r = 1. Both branches share x; timing guides attention.", sourceUrl: "https://arxiv.org/html/2106.09685#S4.SS1", sourceLabel: "LoRA §4.1"};
  }
  if (id === "2205.14135" && /(?:\\ell|l_)/.test(latex) && /(?:\\exp|e\^)/.test(latex) && /(?:\\max|\\operatorname\{max\})/.test(latex)) {
    return {slug: "online-softmax", intro: "When the maximum changes, rescale the totals instead of starting over.", caption: "Illustrative one-row values; equivalent numerator form u = ℓO. Rescaling is an intermediate calculation. GPU storage and timing omitted.", sourceUrl: "https://arxiv.org/pdf/2205.14135", sourceLabel: "FlashAttention Algorithm 1"};
  }
  return null;
}

export function examplePlayback({reduced, explicitPlay, userPaused, visible, hidden, printing}: {
  reduced: boolean; explicitPlay: boolean; userPaused: boolean; visible: boolean; hidden: boolean; printing: boolean;
}) {
  const poster = printing || (reduced && !explicitPlay);
  return {poster, playing: !poster && !userPaused && visible && !hidden};
}
