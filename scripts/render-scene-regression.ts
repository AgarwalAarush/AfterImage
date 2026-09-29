import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { prepareScene, sceneSvg, sceneSvgMobile } from "../src/lib/scene";
import { inspectSvg, reviewFonts } from "../worker/diagram-review";
import { sglangScene } from "../tests/fixtures/sglang-scene";

async function main() {
  const directory = path.resolve(".artifacts/scene-regression");
  await mkdir(directory, { recursive: true });
  for (const mobile of [false, true]) {
    for (const revised of [false, true]) {
      const scene = revised ? prepareScene(sglangScene) : sglangScene;
      const svg = (mobile ? sceneSvgMobile : sceneSvg)(scene);
      const name = `${revised ? "revised" : "original"}-${mobile ? "mobile" : "desktop"}`;
      await writeFile(path.join(directory, `${name}.svg`), svg);
      await writeFile(path.join(directory, `${name}.png`), new Resvg(svg, { font: reviewFonts, background: "#ffffff", fitTo: { mode: "width", value: mobile ? 350 : 880 } }).render().asPng());
      console.log(JSON.stringify({ name, issues: inspectSvg(svg), file: path.join(directory, `${name}.png`) }));
    }
  }
  const candidateIndex = process.argv.indexOf("--candidate");
  if (candidateIndex !== -1) {
    const candidate = JSON.parse(await readFile(process.argv[candidateIndex + 1], "utf8"));
    for (const mobile of [false, true]) {
      const svg = (mobile ? sceneSvgMobile : sceneSvg)(candidate.scene || candidate.result.scene);
      const file = path.join(directory, `candidate-${mobile ? "mobile" : "desktop"}.png`);
      await writeFile(file, new Resvg(svg, { font: reviewFonts, background: "#ffffff", fitTo: { mode: "width", value: mobile ? 350 : 880 } }).render().asPng());
      console.log(JSON.stringify({ file, issues: inspectSvg(svg) }));
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
