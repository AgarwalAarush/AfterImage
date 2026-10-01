import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { prepareScene, sceneSvg, sceneSvgMobile } from "../src/lib/scene";
import { inspectSvg, reviewFonts } from "../worker/diagram-review";
import { expertChoiceScene, expertObjectScene, expertScoresPanel } from "../tests/fixtures/expert-choice-scene";

import { distributionScene, gaugeScene, sparseAllocationScene, tokenTreeScene } from "../tests/fixtures/concept-scenes";

async function main() {
const dir = path.resolve(".artifacts/illustration-regression");
await mkdir(dir, { recursive: true });
for (const [name, scene] of [
  ["expert-choice", expertChoiceScene],
  ["expert-objects", expertObjectScene],
  ["distribution", distributionScene],
  ["gauges", gaugeScene],
  ["sparse-allocation", sparseAllocationScene],
  ["token-tree", tokenTreeScene],
  ["expert-scores", prepareScene({ ...expertChoiceScene, title: "Experts choose the top tokens in their own column", illustration: { takeaway: "Two selections per column; a token can appear in several columns.", panels: [expertScoresPanel] } })],
] as const) {
  for (const mobile of [false, true]) {
    const svg = (mobile ? sceneSvgMobile : sceneSvg)(scene);
    const file = path.join(dir, `${name}-${mobile ? "mobile" : "desktop"}`);
    await writeFile(`${file}.svg`, svg);
    await writeFile(`${file}.png`, new Resvg(svg, { font: reviewFonts, background: "#ffffff", fitTo: { mode: "width", value: mobile ? 350 : 880 } }).render().asPng());
    const issues = inspectSvg(svg);
    console.log(JSON.stringify({ file, issues }));
    if (issues.length) throw new Error(`${name}: ${issues.join("; ")}`);
  }
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
