import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { studySvg, type StudyPack } from "../src/lib/study";
import type { Paper, Source } from "../src/lib/types";
import { reviewFonts } from "../worker/diagram-review";

/** Package only reviewed public-paper evaluation artifacts as a readable local guide. */
async function main() {
  const dir = path.resolve(process.argv[2] || "");
  if (!process.argv[2]) throw new Error("Provide an evaluation directory.");
  const quality = JSON.parse(await readFile(path.join(dir, "quality-report.json"), "utf8"));
  if (quality.status !== "passed") throw new Error("Opening content has not passed review.");
  const paper: Paper = JSON.parse(await readFile(path.join(dir, "reviewed-paper.json"), "utf8"));
  const studyDir = path.resolve(process.argv[3] || path.join(dir, "study"));
  const studyQuality = JSON.parse(await readFile(path.join(studyDir, "study-quality-report.json"), "utf8"));
  if (!studyQuality.review.approved || studyQuality.review.issues.some((issue: { severity: string }) => issue.severity === "must-fix"))
    throw new Error("Study pack has not passed review.");
  const { study, sources }: { study: StudyPack; sources: Source[] } = JSON.parse(await readFile(path.join(studyDir, "result.json"), "utf8"));
  const source = (id: string) => [...paper.sources, ...sources].find(item => item.id === id);
  const cite = (id: string) => { const item = source(id); return item ? `[${item.label}](${item.url})` : id; };
  const recall = paper.recall!;
  const blocks = [`# ${paper.title}`, `[Original paper](https://arxiv.org/abs/${paper.arxivId}) · Local reviewed guide`, recall.idea,
    `![Opening diagram](${path.join(dir, `review-${quality.attempts - 1}.png`)})`];
  for (const field of ["problem", "mechanism", "evidence", "limitation", "significance"] as const) blocks.push(`## ${field[0].toUpperCase() + field.slice(1)}`, recall[field] || "");
  for (const equation of recall.equations || []) blocks.push(`## ${equation.title || "Equation"}`, `$$\n${equation.latex}\n$$`, equation.explanation, equation.example || "", cite(equation.sourceId));
  if (recall.walkthrough) {
    blocks.push(`## ${recall.walkthrough.title}`, recall.walkthrough.introduction);
    recall.walkthrough.steps.forEach((step, i) => blocks.push(`### ${i + 1}. ${step.label}`, `Input: ${step.input}\n\nOperation: ${step.operation}\n\nOutput: ${step.output}`));
    blocks.push(cite(recall.walkthrough.sourceId));
  }
  for (const figure of study.figures) {
    blocks.push(`## ${figure.title}`, figure.caption, cite(figure.sourceId));
    const states = figure.kind === "network" ? figure.states.length : 1;
    for (let state = 0; state < states; state++) {
      const file = path.join(dir, `figure-${figure.id}-${state}.png`);
      await writeFile(file, new Resvg(studySvg(figure, false, state), { font: reviewFonts, background: "#ffffff" }).render().asPng());
      blocks.push(`![${figure.title}](${file})`);
      if (figure.kind === "network") blocks.push(figure.states[state].explanation);
    }
  }
  blocks.push("## Check your understanding");
  study.quiz.forEach((question, i) => {
    blocks.push(`### ${i + 1}. ${question.question}`, question.options.map((option, j) => `${String.fromCharCode(65 + j)}. ${option.text}`).join("\n\n"),
      `<details><summary>Answer and explanations</summary>\n\nCorrect: ${String.fromCharCode(65 + question.answer)}\n\n${question.options.map((option, j) => `${String.fromCharCode(65 + j)}: ${option.explanation}`).join("\n\n")}\n\n${cite(question.sourceId)}\n\n</details>`);
  });
  blocks.push("## Sources", paper.sources.filter(item => recall.sourceIds.includes(item.id)).map(item => `- [${item.label}](${item.url})`).join("\n"));
  const file = path.join(dir, "reading-pack.md");
  await writeFile(file, blocks.filter(Boolean).join("\n\n") + "\n");
  console.log(file);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
