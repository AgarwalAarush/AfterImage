import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { workedExampleForEquation, examplePlayback } from "../src/lib/worked-examples";

const paper = (id: string) => ({id, sources: [{id: "methods", label: "Methods", url: "https://arxiv.org", excerpt: ""}]});
const equation = (latex: string) => ({latex, explanation: "", sourceId: "methods"});
test("editorial animations match the actual mechanism, not the paper or array position alone", () => {
  const eagle = paper("2503.01840");
  assert.equal(workedExampleForEquation(eagle, equation("g_i=W_f[\\ell_i;m_i;h_i]")), null);
  assert.equal(workedExampleForEquation(eagle, equation("u_{i+2}=W_{\\rm in}[a_{i+1};e(x_{i+2})],a_{i+2}=D_\\theta(u_{i+2};C_{i+2})"))?.slug, "eagle-state-reuse");
  assert.equal(workedExampleForEquation(paper("2106.09685v2"), equation("h=W_0x+\\frac{\\alpha}{r}BAx"))?.slug, "lora-rank-one");
  assert.equal(workedExampleForEquation(paper("2106.09685"), equation("W=W_0+BA")), null);
  assert.equal(workedExampleForEquation(paper("2205.14135"), equation("m'=\\max(m,m_t),\\ell'=\\exp(m-m')\\ell+\\exp(m_t-m')\\ell_t"))?.slug, "online-softmax");
  assert.equal(workedExampleForEquation(paper("2205.14135"), equation("P=\\operatorname{softmax}(QK^T)")), null);
  assert.equal(workedExampleForEquation(paper("9999.99999"), equation("h=W_0x+BAx")), null);
  assert.equal(workedExampleForEquation(eagle, {...equation("[a_{i+1};e(x_{i+2})]D_"), sourceId: "missing"}), null);
});
test("autoplay preserves user pause across visibility and uses posters for motion preference/print", () => {
  const input = {reduced: false, explicitPlay: false, userPaused: false, visible: true, hidden: false, printing: false};
  assert.deepEqual(examplePlayback(input), {poster: false, playing: true});
  assert.equal(examplePlayback({...input, visible: false}).playing, false);
  assert.equal(examplePlayback({...input, hidden: true}).playing, false);
  assert.equal(examplePlayback({...input, userPaused: true}).playing, false);
  assert.deepEqual(examplePlayback({...input, reduced: true}), {poster: true, playing: false});
  assert.deepEqual(examplePlayback({...input, reduced: true, explicitPlay: true}), {poster: false, playing: true});
  assert.deepEqual(examplePlayback({...input, printing: true, explicitPlay: true}), {poster: true, playing: false});
});
test("deployed SVG assets retain reviewed hashes, static posters and local reference closure", () => {
  const manifest = JSON.parse(readFileSync("public/worked-examples/manifest.json", "utf8"));
  for (const example of manifest.examples) for (const file of example.files) {
    const svg = readFileSync("public/worked-examples/" + file.name, "utf8");
    assert.equal(createHash("sha256").update(svg).digest("hex"), file.sha256);
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image)\b|\son\w+=/i);
    const ids = new Set(Array.from(svg.matchAll(/\bid="([^"]+)"/g), m => m[1]));
    for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(match[1]), match[1]);
    for (const match of svg.matchAll(/aria-labelledby="([^"]+)"/g)) for (const id of match[1].split(" ")) assert.ok(ids.has(id), id);
    assert.equal(/<animate\b|<animateTransform\b/.test(svg), !file.name.includes("-poster"));
  }
});
