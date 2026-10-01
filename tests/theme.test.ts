import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { themeBootstrap, themePreference } from "../src/lib/theme";
import { diagramPaint, themedSvg } from "../src/lib/diagram-theme";
import { prepareScene, sceneSvg } from "../src/lib/scene";
import { sglangScene } from "./fixtures/sglang-scene";

test("appearance resolves saved choices, system defaults, and blocked storage before paint", () => {
  for (const [saved, system, expected] of [["dark", false, "dark"], ["light", true, "light"], ["system", true, "dark"], ["invalid", false, "light"], [null, true, "dark"]] as const) {
    const root = {dataset: {} as {theme?: string}};
    runInNewContext(themeBootstrap, {document:{documentElement:root}, localStorage:{getItem:()=>saved},matchMedia:()=>({matches:system})});
    assert.equal(root.dataset.theme, expected);
  }
  const root = {dataset: {} as {theme?: string}};
  runInNewContext(themeBootstrap, {document:{documentElement:root}, localStorage:{getItem:()=>{throw Error("blocked");}},matchMedia:()=>({matches:true})});
  assert.equal(root.dataset.theme, "dark");
  assert.equal(themePreference("unexpected"), "system");
});

test("browser SVG theming preserves reviewed geometry, labels, and topology", () => {
  for (const scene of [sglangScene, prepareScene(sglangScene)]) {
    const original = sceneSvg(scene), themed = themedSvg(original);
    const withoutPaint = (svg:string) => svg.replace(/\b(fill|stroke|stop-color)="[^"]+"/g, "$1=PAINT");
    assert.equal(withoutPaint(themed), withoutPaint(original));
    assert.match(themed, /var\(--diagram-ink/);
    assert.match(themed, /var\(--diagram-violet/);
    assert.match(themed, /fill="none"/);
  }
  assert.equal(diagramPaint("url(#heatmap)"), "url(#heatmap)");
  assert.equal(diagramPaint("#8068be18"), "var(--diagram-violet-surface, #8068be18)");
  assert.equal(diagramPaint("#edf3ee"), "var(--diagram-green-surface, #edf3ee)");
});

test("heat scales retain distinct monotonic values and readable label colors", () => {
  const values = ["rgb(245,243,248)","rgb(182,170,209)","rgb(119,96,170)"];
  const dark = values.map(v => diagramPaint(v).match(/, rgb\((\d+),(\d+),(\d+)\)\)$/)!.slice(1).map(Number));
  assert.ok(dark[0][0] < dark[1][0] && dark[1][0] < dark[2][0]);
  assert.equal(diagramPaint("#ffffff", "fill", true), "#ffffff");
  assert.equal(diagramPaint("#353832", "fill", true), "var(--diagram-ink, #353832)");
  assert.match(themedSvg('<text fill="#555a54">minimum</text>', true), /--diagram-ink/);
  assert.equal(diagramPaint("#ffffff", "stroke"), "#ffffff");
});
