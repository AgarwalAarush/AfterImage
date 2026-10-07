import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { sceneSvg, sceneSvgMobile, validateScene } from "../src/lib/scene";
import { expertChoiceScene, expertObjectScene } from "./fixtures/expert-choice-scene";
import { prepareDraftScene, prepareDraftIllustration } from "../worker/diagram-presentation";
import { publicationTextFacts, inspectPublicationSvg } from "../worker/diagram-publication";
import { inspectSvg } from "../worker/diagram-review";
import { generationSchemas } from "../worker/generation-schema";
import { outputSchema } from "../worker/output-schema";

const hash = (svg: string) => createHash("sha256").update(svg).digest("hex");

test("unversioned routing and bucket scenes retain their exact approved renderer bytes", () => {
  assert.deepEqual([expertChoiceScene, expertObjectScene].flatMap(scene => [sceneSvg, sceneSvgMobile].map(render => hash(render(scene)))), [
    "0ba0e4a239c939c089520bd8d21b04cb85a3da1138d3d9712059d8cd720679e4",
    "19e80f42f1d41b052f387f0d91acb8faca87d8b2e90e92c827d2c23811aba126",
    "1f2802e652876b941728155b0fd183f311cfc4f80cf1f3ae73add680ce2cd40a",
    "5254fd7a98caa44c121d954d4e9c8f62960f04f70ec0ee08b82e54a437da56a5",
  ]);
});

test("fresh routing identities stay readable at the actual review widths without changing assignments", () => {
  const draft = prepareDraftScene(expertChoiceScene);
  for (const [render, width] of [[sceneSvg, 880], [sceneSvgMobile, 350]] as const) {
    const svg = render(draft), $ = cheerio.load(svg, { xml: true });
    assert.deepEqual(inspectPublicationSvg(svg, width), []);
    const facts = publicationTextFacts(svg, width);
    assert.ok(facts.labels.filter(label => label.role === "identity").every(label => label.fontSizePx! >= 14));
    assert.equal($('[data-assignment]').length, 12);
    const legacy = cheerio.load(render(expertChoiceScene), { xml: true });
    assert.deepEqual($('[data-assignment]').toArray().map(el => $(el).attr("data-assignment")),
      legacy('[data-assignment]').toArray().map(el => legacy(el).attr("data-assignment")));
    assert.match(svg, /0 experts/);
    assert.equal(svg, render(draft));
  }
  assert.deepEqual(draft.illustration!.panels.map(panel => {
    if (panel.kind !== "routing") return panel;
    const { layout: _layout, ...original } = panel;
    return original;
  }), expertChoiceScene.illustration!.panels);
  assert.deepEqual(prepareDraftIllustration(expertObjectScene.illustration!), expertObjectScene.illustration);
});

test("long routing labels and count nouns remain complete at maximum bounded size", () => {
  const base = expertChoiceScene.illustration!.panels[0];
  assert.equal(base.kind, "routing");
  if (base.kind !== "routing") return;
  const labels = Array.from({ length: 6 }, (_, i) => `Line ${i + 1}: sample ABC`);
  const panel = { ...base, left: labels, right: labels.map(label => label.replace("Line", "Side")),
    leftLabel: "Readout identities", rightLabel: "Shared parameters", counts: "both" as const,
    leftCountUnit: { singular: "relationship", plural: "relationships" }, rightCountUnit: { singular: "relationship", plural: "relationships" },
    links: Array.from({ length: 18 }, (_, i) => ({ left: Math.floor(i / 3), right: i % 6 })) };
  const draft = prepareDraftScene({ ...expertChoiceScene, illustration: { takeaway: "Illustrative labels preserve the complete assignments.", panels: [panel] } });
  validateScene(draft);
  for (const [render, width] of [[sceneSvg, 880], [sceneSvgMobile, 350]] as const) {
    const svg = render(draft), $ = cheerio.load(svg, { xml: true });
    assert.deepEqual(inspectPublicationSvg(svg, width), []);
    assert.equal($('[data-assignment]').length, 18);
    for (const [side, identities] of [["left", panel.left], ["right", panel.right]] as const) identities.forEach((identity, i) => {
      const node = $(`[data-concept="panel-0-${side}-${i}"]`), y = Number(node.attr("y")), h = Number(node.attr("height"));
      const rendered = $('[data-text-role="identity"]').toArray().filter(el => {
        const x = Number($(el).attr("x")), textY = Number($(el).attr("y"));
        return x === Number(node.attr("x")) + Number(node.attr("width")) / 2 && textY > y && textY < y + h;
      }).map(el => $(el).text()).join(" ");
      assert.equal(rendered, identity);
    });
  }
});

test("publication manifests report scaled font size, rather than SVG units or glyph ink height", () => {
  const svg = '<svg viewBox="0 0 380 100"><text x="20" y="30" font-size="12" font-family="IBM Plex Mono">L1A</text></svg>';
  const facts = publicationTextFacts(svg, 350);
  assert.equal(facts.labels[0].fontSizePx, 11.053);
  assert.equal(facts.svgDigest, hash(svg));
  assert.equal(facts.widthPx, 350);
  assert.ok(facts.fonts.every(font => /^[a-f0-9]{64}$/.test(font.sha256)));
  assert.throws(() => publicationTextFacts(svg, 0), /publication dimensions/);
  assert.throws(() => publicationTextFacts(svg.replace('380', '0'), 350), /publication dimensions/);
});

test("routing headings use their full half-column instead of splitting a word that fits", () => {
  const panel = expertChoiceScene.illustration!.panels[0];
  const scene = prepareDraftScene({ ...expertChoiceScene, illustration: { takeaway: "Share one motion parameter within each line.", panels: [{ ...panel, rightLabel: "2D displacement" }] } });
  const $ = cheerio.load(sceneSvgMobile(scene), { xml: true });
  assert.ok($('[data-text-role="axis"]').toArray().some(el => $(el).text() === "2D displacement"));
  assert.deepEqual(inspectPublicationSvg(sceneSvgMobile(scene), 350), []);
});

test("partial unsupported glyphs fail even when the rest of their label has a valid outline", () => {
  const svg = '<svg viewBox="0 0 380 100"><text x="20" y="30" font-size="16" font-family="IBM Plex Mono">x ∈ D</text></svg>';
  assert.deepEqual(inspectSvg(svg), []);
  assert.ok(inspectPublicationSvg(svg, 350).some(issue => issue.includes("U+2208") && issue.includes("x ∈ D")));
  assert.deepEqual(publicationTextFacts(svg, 350).labels[0].unsupportedGlyphs, [{ char: "∈", codePoint: "U+2208" }]);
  assert.deepEqual(inspectPublicationSvg(svg.replace("∈", "="), 350), []);
});

test("new-layout typography failures remain hard blockers; the model cannot select a renderer version", () => {
  const svg = '<svg viewBox="0 0 1000 100"><text data-text-role="identity" x="20" y="30" font-size="16">L1A</text></svg>';
  assert.ok(inspectPublicationSvg(svg, 350).some(issue => issue.includes("5.6px") && issue.includes("minimum 14px")));
  const schema = outputSchema(generationSchemas(["method"]).scene);
  assert.ok(!JSON.stringify(schema).includes("readable-routing-v1"));
  const draft = prepareDraftScene(expertChoiceScene);
  assert.throws(() => validateScene({ ...draft, illustration: { ...draft.illustration, panels: draft.illustration!.panels.map(panel => ({ ...panel, layout: "unknown" })) } }));
});
