import katex from "katex";
import type { Recall, Source } from "./types";
export const mathOptions = {
  throwOnError: true,
  trust: false,
  strict: "error",
  maxExpand: 500,
} as const;
export function validateRecall(
  recall: Pick<
    Recall,
    | "sourceIds"
    | "equations"
    | "idea"
    | "problem"
    | "mechanism"
    | "evidence"
    | "limitation"
    | "significance"
    | "walkthrough"
  >,
  sources: Source[],
) {
  const ids = new Set(sources.map((s) => s.id));
  if (
    [
      ...recall.sourceIds,
      ...(recall.equations || []).map((eq) => eq.sourceId),
      ...(recall.walkthrough ? [recall.walkthrough.sourceId] : []),
    ].some((id) => !ids.has(id))
  )
    throw new Error("Unknown source citation");
  const check = (latex: string) => {
    // Links, HTML, macros, and external resources have no place in paper notation.
    if (
      /\\(?:href|url|includegraphics|html\w*|def|gdef|newcommand)\b/.test(latex)
    )
      throw new Error("Unsupported command in equation");
    katex.renderToString(latex, mathOptions);
  };
  for (const eq of recall.equations || []) check(eq.latex);
  for (const value of [
    recall.idea,
    recall.problem,
    recall.mechanism,
    recall.evidence,
    recall.limitation,
    recall.significance,
    ...(recall.equations || []).flatMap((eq) => [eq.title, eq.explanation, eq.example]),
    recall.walkthrough?.title,
    recall.walkthrough?.introduction,
    ...(recall.walkthrough?.steps || []).flatMap(s => [s.label, s.input, s.operation, s.output]),
  ]) {
    if (!value) continue;
    for (const match of value.matchAll(/\$([^$\n]+)\$|\\\(([\s\S]*?)\\\)/g))
      check(match[1] || match[2]);
  }
}
