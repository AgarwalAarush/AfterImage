import test from "node:test";
import assert from "node:assert/strict";
import { sourcesFromHtml,hasSubstantiveSourceBody } from "../src/lib/source-extraction";
import { researchFromHtml } from "../src/lib/source-extraction";
import { sourceLimits } from "../src/lib/research-bundle";
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

test("retains unsectioned scientific main text before sectioned supplementary methods",()=>{
  const html=`<article class="ltx_document" id="paper"><div class="ltx_abstract"><p class="ltx_p">Abstract duplicate.</p></div><p class="ltx_p">A network returns policy and value. Search improves its policy target.</p><div class="ltx_equation"><math alttext="l=(z-v)^2-\\pi^\\top\\log p"><mi>loss</mi></math></div><figure><figcaption class="ltx_caption"><p class="ltx_p">Figure 1: main algorithm.</p></figcaption></figure><section class="ltx_section" id="methods"><h2>Methods</h2><p class="ltx_p">Supplementary board encoding.</p></section><div class="ltx_bibliography"><p class="ltx_p">Reference text.</p></div></article>`;
  const sources=sourcesFromHtml(paper,html);
  assert.equal(sources.length,3);
  assert.equal(sources[1].id,"main-text");
  assert.equal(sources[1].label,"Original paper · unsectioned main text");
  assert.ok(sources[1].url.endsWith("#paper"));
  assert.match(sources[1].excerpt,/Search improves its policy target/);
  assert.match(sources[1].excerpt,/LATEX: l=\(z-v\)\^2/);
  assert.equal(sources[1].excerpt.match(/Figure 1: main algorithm/g)?.length,1);
  assert.equal(sources[2].id,"section-1");
  assert.ok(sources[2].url.endsWith("#methods"));
  assert.ok(!sources.slice(1).some(source=>/Abstract duplicate|Reference text/.test(source.excerpt)));
  assert.equal(sources.filter(source=>source.excerpt.includes("Supplementary board encoding")).length,1);
});

test("nested section blocks occur once and acknowledgement/reference prose is omitted",()=>{
  const html=`<article class="ltx_document"><section class="ltx_section" id="intro"><h2>Introduction</h2><p class="ltx_p">Outer mechanism.</p><section class="ltx_section" id="inner"><h3>Nested experiment</h3><p class="ltx_p">Inner measured result.</p></section></section><section class="ltx_section"><h2>Acknowledgements</h2><p class="ltx_p">Thanks to every colleague.</p></section><section class="ltx_section"><h2>References</h2><p class="ltx_p">Bibliographic listing.</p></section><section class="ltx_acknowledgments"><p class="ltx_p">More thanks.</p></section></article>`;
  const sources=sourcesFromHtml(paper,html);
  assert.equal(sources.filter(source=>source.excerpt.includes("Inner measured result")).length,1);
  assert.equal(sources.filter(source=>source.excerpt.includes("Outer mechanism")).length,1);
  assert.ok(!sources.some(source=>/Thanks|thanks|Bibliographic/.test(source.excerpt)));
});

test("unsectioned text shares the existing bounded excerpt and total source budgets",()=>{
  const html=`<article class="ltx_document">${Array.from({length:20},(_,i)=>`<p class="ltx_p">Main argument ${i}. ${"Evidence. ".repeat(800)}</p>`).join("")}<section class="ltx_section"><h2>Methods</h2><p class="ltx_p">Later methods.</p></section></article>`;
  const sources=sourcesFromHtml(paper,html);
  assert.equal(sources.length,14);
  assert.equal(new Set(sources.map(source=>source.id)).size,sources.length);
  assert.ok(sources.every(source=>source.excerpt.length<=10000));
  assert.match(sources.at(-1)!.excerpt,/SOURCE BUDGET REACHED/);
});

test("appendix wrappers do not consume the unsectioned main-body budget before main sections",()=>{
  const html=`<article class="ltx_document"><section class="ltx_section" id="limits"><h2>Limitations</h2><p class="ltx_p">Main-paper limitations remain available.</p></section><section class="ltx_appendix"><h2>Appendix A</h2><p class="ltx_p">${"Long supplementary proof. ".repeat(600)}</p></section></article>`;
  const sources=sourcesFromHtml(paper,html);
  assert.ok(sources.length>2);
  assert.equal(sources[1].id,"section-1");
  assert.match(sources[1].excerpt,/Main-paper limitations remain available/);
  assert.ok(!sources.some(source=>source.id.startsWith("main-text")));
  assert.equal(sources[2].id,"appendix-1");
});
test("captures appendix algorithm equations and nested detail once after stable main sections",()=>{
  const html='<article class="ltx_document"><section class="ltx_section" id="S1"><h2>Method</h2><p class="ltx_p">Use a trust region.</p></section><section class="ltx_appendix" id="A3"><h2>Appendix C Efficient solution</h2><p class="ltx_p">Shrink the step exponentially until the objective improves within the constraint.</p><section class="ltx_section"><h3>Fisher product</h3><div class="ltx_equation"><math alttext="A x = g"></math></div></section></section></article>';
  const sources=sourcesFromHtml(paper,html);
  assert.deepEqual(sources.map(source=>source.id),["abstract","section-1","appendix-1"]);
  assert.equal(sources[2].url,"https://arxiv.org/html/2503.01840#A3");
  assert.match(sources[2].excerpt,/Shrink the step exponentially/);
  assert.equal(sources.filter(source=>source.excerpt.includes("LATEX: A x = g")).length,1);
});
test("embedded PDF pointers are not scientific body evidence or full-text scope",()=>{
  const html='<article class="ltx_document"><div class="ltx_abstract"><p class="ltx_p">Abstract metadata.</p></div><p class="ltx_p">See pages 1-last of 0_adam_main.pdf</p></article>';
  assert.deepEqual(sourcesFromHtml(paper,html),paper.sources);
  assert.equal(hasSubstantiveSourceBody([...paper.sources,{id:"main-text",label:"Main",url:"https://arxiv.org/html/1412.6980",excerpt:"See pages 1-last of 0_adam_main.pdf"}]),false);
  assert.equal(hasSubstantiveSourceBody([{...paper.sources[0],excerpt:"Long abstract. ".repeat(80)}]),false);
  assert.equal(hasSubstantiveSourceBody([...paper.sources,{id:"section-1",label:"Mechanism",url:"https://arxiv.org/html/1412.6980",excerpt:"The algorithm estimates first and second moments of stochastic gradients. ".repeat(8)}]),true);
});

test("appendices and inert listings retain indentation with stable anchor IDs", () => {
  const code = "def cost(gates):\n    return gates[..., 1:].sum(-1)  # null is free\n";
  const html = `<section class="ltx_section"><h2>Method</h2><p class="ltx_p">A null branch.</p></section><section class="ltx_appendix" id="A3"><h2>Appendix C</h2><div class="ltx_listing"><div class="ltx_listing_data"><a href="data:text/plain;base64,${Buffer.from(code).toString("base64")}">Download</a></div><pre>${code}</pre></div></section>`;
  const bundle = researchFromHtml(paper, html);
  const appendix = bundle.sources.find(s => s.id === "appendix-a3")!;
  assert.match(appendix.excerpt, /\n    return gates\[\.\.\., 1:\]/);
  assert.equal(appendix.excerpt.match(/null is free/g)?.length, 1);
  assert.equal(appendix.url, "https://arxiv.org/html/2503.01840#A3");
  assert.equal(bundle.coverage.sections[1].kind, "appendix");
  assert.ok(!appendix.excerpt.includes("Download"));
  assert.equal(bundle.sources[1].id, "section-1");
});

test("nested scientific sections and caption children appear exactly once", () => {
  const bundle = researchFromHtml(paper, `<section class="ltx_section" id="S1"><h2>Parent</h2><p class="ltx_p">Parent text.</p><section class="ltx_section" id="S1a"><h3>Child</h3><p class="ltx_p">Unique child.</p><figcaption><p class="ltx_p">Unique caption.</p></figcaption></section></section>`);
  assert.equal(bundle.catalogue.map(s => s.excerpt).join(" ").match(/Unique child/g)?.length, 1);
  assert.equal(bundle.catalogue.map(s => s.excerpt).join(" ").match(/Unique caption/g)?.length, 1);
  assert.ok(!bundle.catalogue[1].excerpt.includes("Unique child"));
});

test("active and catalogue omissions are private explicit coverage, with bounded chunks", () => {
  const html = Array.from({ length: 140 }, (_, i) => `<section class="ltx_section" id="S${i}"><h2>Section ${i}</h2><p class="ltx_p">${"Supported evidence. ".repeat(i ? 1 : 800)}</p></section>`).join("");
  const bundle = researchFromHtml(paper, html);
  assert.equal(bundle.sources.length, sourceLimits.active);
  assert.equal(bundle.catalogue.length, sourceLimits.catalogue);
  assert.equal(bundle.coverage.sections.length, 140);
  assert.equal(bundle.coverage.omittedChunks, 13);
  assert.equal(bundle.coverage.omittedActiveIds.length, 114);
  assert.equal(bundle.coverage.sections[0].truncatedBlocks, 1);
  assert.ok(bundle.catalogue.every(s => s.excerpt.length <= 9500));
  assert.ok(bundle.coverage.sections.at(-1)!.omittedBlocks > 0);
  assert.deepEqual(Object.keys(bundle.sources[0]).sort(), ["excerpt", "id", "label", "url"]);
});

test("long code listings split at line boundaries without discarding later branches", () => {
  const code = Array.from({ length: 1500 }, (_, i) => `    line_${i} = ${i}`).join("\n");
  const bundle = researchFromHtml(paper, `<section class="ltx_appendix" id="A3"><h2>Implementation</h2><pre>${code}</pre></section>`);
  assert.ok(bundle.catalogue.some(s => s.excerpt.includes("line_1499 = 1499")));
  assert.ok(bundle.catalogue.every(s => s.excerpt.length <= 9500));
  assert.equal(bundle.coverage.sections[0].truncatedBlocks, 0);
});
