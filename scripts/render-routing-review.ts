import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { sceneSvg, sceneSvgMobile, validateScene } from "../src/lib/scene";
import { themedSvg } from "../src/lib/diagram-theme";
import { prepareDraftScene } from "../worker/diagram-presentation";
import { inspectPublicationSvg, publicationTextFacts } from "../worker/diagram-publication";
import { reviewFonts } from "../worker/diagram-review";
import { expertChoiceScene } from "../tests/fixtures/expert-choice-scene";

async function main() {
  const input = process.argv[2] ? JSON.parse(await readFile(process.argv[2], "utf8")) : { scene: expertChoiceScene };
  const scene = prepareDraftScene(input.scene ?? input);
  validateScene(scene);
  const directory = path.resolve(".artifacts/routing-review");
  await mkdir(directory, { recursive: true });
  const views: { name: string; width: number; svg: string }[] = [];
  for (const [name, render, width] of [["desktop", sceneSvg, 880], ["compatibility", sceneSvgMobile, 350]] as const) {
    const svg = render(scene), issues = inspectPublicationSvg(svg, width);
    if (issues.length) throw new Error(issues.join("; "));
    await writeFile(path.join(directory, `${name}.svg`), svg);
    await writeFile(path.join(directory, `${name}.png`), new Resvg(svg, { font: reviewFonts, background: "#ffffff", fitTo: { mode: "width", value: width } }).render().asPng());
    const facts = publicationTextFacts(svg, width);
    await writeFile(path.join(directory, `${name}.publication.json`), JSON.stringify(facts, null, 2));
    console.log(JSON.stringify({ name, width, identitySizes: [...new Set(facts.labels.filter(label => label.role === "identity").map(label => label.fontSizePx))], issues }));
    views.push({ name, width, svg: themedSvg(svg) });
  }
  const css = (await readFile("src/app/theme.css", "utf8")).replaceAll(':root[data-theme="dark"]', '[data-theme="dark"]');
  const base = (await readFile("src/app/globals.css", "utf8")).match(/^:root \{[^}]+\}/)![0];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Routing publication review</title><style>${base}${css}
    @font-face{font-family:"IBM Plex Mono";src:url("/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2") format("woff2");font-weight:400}
    body{margin:0;font-family:system-ui;background:var(--paper);color:var(--ink)}main{padding:24px;display:grid;gap:32px}
    section{padding:24px;background:var(--paper);color:var(--ink);border:1px solid var(--line)}figure{margin:16px 0;max-width:100%}svg{display:block;width:100%;height:auto}h1,h2{font-size:18px;margin:0 0 16px}
    </style></head><body><main><h1>Routing publication review · source draft · no Library writes</h1>${["light", "dark"].map(theme => `<section data-theme="${theme}" style="color-scheme:${theme}"><h2>${theme}</h2>${views.map(view => `<figure style="width:${view.width}px"><figcaption>${view.name} · ${view.width}px</figcaption>${view.svg}</figure>`).join("")}</section>`).join("")}</main></body></html>`;
  await writeFile(path.join(directory, "preview.html"), html);
  console.log(path.join(directory, "preview.html"));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
