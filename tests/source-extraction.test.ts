import test from "node:test";
import assert from "node:assert/strict";
import { sourcesFromHtml } from "../src/lib/source-extraction";
import type { Paper } from "../src/lib/types";
const paper = {arxivId:"2503.01840",sources:[{id:"abstract",label:"Abstract",url:"https://arxiv.org/abs/2503.01840",excerpt:"Abstract"}]} as Paper;

test("extracts caption, math, and table values with spanning model labels intact",()=>{
  const html = `<section class="ltx_section" id="S4"><h2>Experiments</h2><p class="ltx_p">Compare speedup and acceptance length for the same model and temperature, rather than comparing incompatible experiments.</p><figure><figcaption class="ltx_caption"><p class="ltx_p">Table 1: measured speedup.</p></figcaption><table class="ltx_tabular"><tr><th>Model</th><th>Method</th><th>Speedup</th></tr><tr><td rowspan="2">8B</td><td>Baseline</td><td>3.23</td></tr><tr><td>New</td><td>4.44</td></tr></table></figure><div class="ltx_equation"><math alttext="g=W_f[l;m;h]"><mi>flattened</mi></math></div><script>ignore me</script></section>`;
  const source = sourcesFromHtml(paper,html)[1];
  assert.match(source.excerpt,/8B \| Baseline \| 3.23/);
  assert.match(source.excerpt,/8B \| New \| 4.44/);
  assert.equal(source.excerpt.match(/Table 1: measured speedup/g)?.length,1);
  assert.match(source.excerpt,/LATEX: g=W_f\[l;m;h\]/);
  assert.ok(!source.excerpt.includes("ignore me"));
  assert.ok(source.url.endsWith("#S4"));
});
test("bounded source excerpts disclose truncation instead of silently implying full coverage",()=>{
  const source=sourcesFromHtml(paper,`<section class="ltx_section"><h2>Methods</h2><p class="ltx_p">${"Supported evidence. ".repeat(800)}</p></section>`)[1];
  assert.ok(source.excerpt.length<=10000);
  assert.match(source.excerpt,/EXTRACTION TRUNCATED/);
});

test("long sections retain later tables in separately citable parts",()=>{
  const html=`<section class="ltx_section" id="S4"><h2>Results</h2>${Array.from({length:6},()=>`<p class="ltx_p">${"Evidence. ".repeat(300)}</p>`).join("")}<table class="ltx_tabular"><tr><th>Ablation</th><th>Score</th></tr><tr><td>Final method</td><td>9.87</td></tr></table></section>`;
  const sources=sourcesFromHtml(paper,html);
  assert.ok(sources.length>2);
  assert.ok(sources.some(s=>s.excerpt.includes("Final method | 9.87")));
  assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
  assert.ok(sources.every(s=>s.excerpt.length<=10000));
  assert.ok(sources.slice(1).every(s=>s.url.endsWith("#S4")));
});
