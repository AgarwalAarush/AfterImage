import test from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { prepareScene, sceneSvg, sceneSvgMobile, validateScene } from "../src/lib/scene";
import { inspectSvg } from "../worker/diagram-review";
import { generationSchemas } from "../worker/generation-schema";
import { expertChoiceScene, expertObjectScene, expertScoresPanel } from "./fixtures/expert-choice-scene";
import { distributionScene, gaugeScene, sparseAllocationScene } from "./fixtures/concept-scenes";
import { validateIllustrationSources } from "../src/lib/scene-illustration";

test("Expert Choice comparison preserves selections, derived counts and direction at both sizes", () => {
  assert.equal(expertChoiceScene.layout, "explanatory-v3");
  for (const render of [sceneSvg, sceneSvgMobile]) {
    const svg = render(expertChoiceScene);
    assert.deepEqual(inspectSvg(svg), []);
    assert.equal((svg.match(/data-assignment=/g) || []).length, 12);
    assert.match(svg, /0 experts/);
    assert.match(svg, /2 experts/);
    assert.match(svg, /ILLUSTRATIVE EXAMPLE/);
    assert.equal(svg, render(expertChoiceScene));
  }
});

test("matrix and measurements render labeled values without fabricating cells", () => {
  const scene = prepareScene({ ...expertChoiceScene, illustration: { takeaway: "The selected entries define the assignments.", panels: [expertScoresPanel, { kind: "bars", title: "Expert loads", caption: "Counts from the illustrative assignment, not measured performance.", illustrative: true, sourceIds: ["method"], unit: "tokens per expert", items: [{ label: "E1", value: 2 }, { label: "E2", value: 2 }, { label: "E3", value: 2 }] }] } });
  for (const render of [sceneSvg, sceneSvgMobile]) {
    const svg = render(scene);
    assert.deepEqual(inspectSvg(svg), []);
    assert.equal((svg.match(/data-selected="true"/g) || []).length, 6);
    assert.equal((svg.match(/data-cell=/g) || []).length, 18);
    assert.match(svg, /0 baseline/);
  }
});

test("panels reject inconsistent dimensions, duplicate or dangling selections and hidden flow graphs", () => {
  const withPanel = (panel: unknown) => ({ ...expertChoiceScene, illustration: { ...expertChoiceScene.illustration, panels: [panel] } });
  assert.throws(() => validateScene(withPanel({ ...expertScoresPanel, values: [["1", "2"], ["3", "4"]] })), /match the labeled/);
  assert.throws(() => validateScene(withPanel({ ...expertScoresPanel, selected: [{ row: 0, column: 0 }, { row: 0, column: 0 }] })), /duplicate/);
  assert.throws(() => validateScene(withPanel({ ...expertScoresPanel, values: expertScoresPanel.values.map(row => row.map(() => "0.8")) })), /summing to one/);
  assert.throws(() => validateScene(withPanel({ ...expertScoresPanel, selected: [] })), /top-k/);
  const routing = expertChoiceScene.illustration!.panels[0];
  assert.throws(() => validateScene(withPanel({ ...routing, links: [{ left: 0, right: 5 }] })), /outside/);
  assert.throws(() => validateScene(withPanel({ ...routing, leftLabel: "$x$" })), /not raw LaTeX/);
  assert.throws(() => validateScene({ ...expertChoiceScene, layout: "flow-v2" }), /no illustration/);
  assert.throws(() => validateScene(prepareScene({ ...expertChoiceScene, illustration: null })), /at least two/);
});

test("reported values require source support, while invented values stay visibly illustrative", () => {
  const illustration = { takeaway: "Top selections", panels: [{ ...expertScoresPanel, illustrative: false }] };
  const sources = [{ id: "method", label: "Methods", url: "https://arxiv.org/abs/2202.09368", excerpt: "Capacity k = 2" }];
  assert.throws(() => validateIllustrationSources(illustration, sources), /reported diagram value/);
  assert.doesNotThrow(() => validateIllustrationSources({ ...illustration, panels: [expertScoresPanel] }, sources));
  assert.throws(() => validateIllustrationSources({ ...illustration, panels: [{ ...expertScoresPanel, sourceIds: ["invented"] }] }, sources), /unknown source/);
});

test("generation and scene repair schemas reject fabricated panel citation identifiers", () => {
  const scene = generationSchemas(["method"]).scene;
  assert.doesNotThrow(() => scene.parse(expertChoiceScene));
  assert.throws(() => scene.parse({ ...expertChoiceScene, illustration: { ...expertChoiceScene.illustration, panels: [{ ...expertScoresPanel, sourceIds: ["invented"] }] } }));
});

test("SVG inspection measures text and connectors in translated panels", () => {
  const svg = `<svg viewBox="0 0 400 200"><g transform="translate(200 100)"><text x="10" y="20" font-size="14" font-family="IBM Plex Mono">Target</text><path data-connector="true" d="M0 15H100"/></g></svg>`;
  assert.ok(inspectSvg(svg).some(issue => issue.includes("Connector crosses text")));
  assert.ok(inspectSvg(svg.replace("200 100", "390 100")).some(issue => issue.includes("Clipped text")));
});

test("maximum bounded matrices and routing labels stay readable and collision-free", () => {
  const labels = Array.from({ length: 6 }, (_, i) => `${i}bcdefghijklmnopqr`);
  const matrix = { ...expertScoresPanel, rowLabel: "abcdefghijklmnopqr", columnLabel: "abcdefghijklmnopqr", rows: labels, columns: labels, values: labels.map(() => labels.map(() => "12345678")), selected: [], normalization: null, selectionRule: null };
  const routing = { ...expertChoiceScene.illustration!.panels[0], left: labels, right: labels, leftLabel: "abcdefghijklmnopqr", rightLabel: "abcdefghijklmnopqr", links: labels.map((_, i) => ({ left: i, right: i })) };
  const scene = prepareScene({ ...expertChoiceScene, illustration: { takeaway: "A bounded stress fixture.", panels: [matrix, routing, matrix] } });
  for (const render of [sceneSvg, sceneSvgMobile]) assert.deepEqual(inspectSvg(render(scene)), []);
});

test("bar comparisons share units and scale, while percentages retain the full 100 endpoint", () => {
  const panel = { kind: "bars" as const, title: "A comparison", caption: "Illustrative values with one shared unit and a zero baseline.", illustrative: true, sourceIds: ["method"], unit: "milliseconds", items: [{ label: "A", value: 2 }, { label: "B", value: 4 }] };
  const scene = prepareScene({ ...expertChoiceScene, illustration: { takeaway: "Compare like quantities.", panels: [panel, { ...panel, items: [{ label: "A", value: 2 }, { label: "B", value: 8 }] }] } });
  const $ = cheerio.load(sceneSvg(scene), { xml: true });
  assert.equal($('[data-panel="0"] rect').eq(1).attr("width"), $('[data-panel="1"] rect').eq(1).attr("width"));
  const percent = prepareScene({ ...expertChoiceScene, illustration: { takeaway: "Half the range.", panels: [{ ...panel, unit: "percent", items: [{ label: "A", value: 25 }, { label: "B", value: 50 }] }] } });
  const p = cheerio.load(sceneSvgMobile(percent), { xml: true });
  assert.equal(Number(p('rect').eq(3).attr("width")) / Number(p('rect').eq(2).attr("width")), .5);
  assert.match(p('svg').text(), /max 100/);
  assert.throws(() => validateScene({ ...percent, illustration: { ...percent.illustration, panels: [{ ...panel, unit: "percent", items: [{ label: "A", value: 101 }, { label: "B", value: 50 }] }] } }), /0-100/);
});

test("object routing makes occupancy, repeated identity and uneven token compute visible", () => {
  for (const render of [sceneSvg, sceneSvgMobile]) {
    const svg = render(expertObjectScene), $ = cheerio.load(svg, { xml: true });
    assert.deepEqual(inspectSvg(svg), []);
    assert.equal($('[data-occupant]').length, 12);
    const ec = $('[data-panel="1"]');
    assert.equal(ec.find('[data-occupant="1,5"], [data-occupant="2,5"]').length, 2);
    assert.equal(ec.find('[data-compute^="4,"]').length, 0);
    assert.equal(ec.find('[data-compute^="5,"]').length, 2);
    for (let expert = 0; expert < 3; expert++) assert.equal(ec.find(`[data-occupant^="${expert},"]`).length, 2);
  }
});

test("distribution and gauge schematics retain scientific data, relationships and readable mobile geometry", () => {
  for (const scene of [distributionScene, gaugeScene]) for (const render of [sceneSvg, sceneSvgMobile]) {
    const svg = render(scene);
    assert.deepEqual(inspectSvg(svg), []);
    assert.equal(svg, render(scene));
    assert.doesNotThrow(() => generationSchemas(["method"]).scene.parse(scene));
    const $ = cheerio.load(svg, { xml: true });
    assert.equal($('[data-concept]').length, scene.illustration!.panels[0].kind === "schematic" ? scene.illustration!.panels[0].nodes.length : 0);
    if (scene === distributionScene) {
      assert.match(svg, /data-sample="0.4"/);
      assert.equal($('[data-connector]').length, 6);
      assert.match(svg, /independent draw/);
    } else {
      assert.match(svg, /data-gauge-value="0.19"/);
      assert.match(svg, /data-gauge-value="0.001999"/);
      assert.match(svg, /500.3×/);
    }
  }
});

test("schematics reject meaningless topology, overflow, undefined inverse and off-canvas samples", () => {
  const base = distributionScene.illustration!.panels[0];
  assert.equal(base.kind, "schematic");
  if (base.kind !== "schematic") return;
  const withPanel = (panel: unknown) => ({ ...distributionScene, illustration: { ...distributionScene.illustration, panels: [panel] } });
  assert.throws(() => validateScene(withPanel({ ...base, edges: [...base.edges, { from: "decoder", to: "encoder", label: "cycle", dashed: false }] })), /acyclic/);
  assert.throws(() => validateScene(withPanel({ ...base, edges: [] })), /participate/);
  assert.throws(() => validateScene(withPanel({ ...base, nodes: base.nodes.map(node => node.glyph === "gaussian" ? { ...node, sample: 4 } : node) })), /outside/);
  const pair = { ...base, nodes: [
    { id: "bank", label: "Occupied capacity", detail: "", glyph: "bank", capacity: 2, items: ["t1", "t2", "t3"] },
    { id: "gauge", label: "Denominator", detail: "", glyph: "gauge", value: 0, inverse: true },
  ], edges: [{ from: "bank", to: "gauge", label: "illustrative relationship", dashed: false }] };
  assert.throws(() => validateScene(withPanel(pair)), /capacity/);
  assert.throws(() => validateScene(withPanel({ ...pair, nodes: [{ ...pair.nodes[0], items: ["t1"] }, pair.nodes[1]] })), /positive denominator/);
  assert.throws(() => generationSchemas(["method"]).scene.parse(withPanel({ ...base, sourceIds: ["invented"] })));
});

test("bounded bank and token glyphs keep all six identities visible", () => {
  const items = ["t001", "t002", "t003", "t004", "t005", "t006"];
  const panel = { kind: "schematic", title: "Capacity and identities", caption: "A stress fixture, not a scientific claim.", illustrative: true, sourceIds: ["method"],
    nodes: [{ id: "tokens", glyph: "tokens", label: "abcdefghijklmnopqrstuv", detail: "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz", items },
      { id: "bank", glyph: "bank", label: "Occupied capacity", detail: "Slots contain repeated identities", capacity: 6, items }],
    edges: [{ from: "tokens", to: "bank", label: "Preserve identity", dashed: false }],
  };
  const scene = prepareScene({ ...expertChoiceScene, illustration: { takeaway: "Preserve data at both publication sizes.", panels: [panel] } });
  for (const render of [sceneSvg, sceneSvgMobile]) {
    const svg = render(scene);
    assert.deepEqual(inspectSvg(svg), []);
    assert.equal((svg.match(/data-occupied="true"/g) || []).length, 6);
  }
});

test("allocation views preserve identities while showing padded and absent regions", () => {
  for (const render of [sceneSvg, sceneSvgMobile]) {
    const svg = render(sparseAllocationScene), $ = cheerio.load(svg, { xml: true });
    assert.deepEqual(inspectSvg(svg), []);
    assert.equal($('[data-panel="0"] [data-occupied="true"]').length, 6);
    assert.equal($('[data-panel="0"] [data-occupied="false"]').length, 3);
    assert.equal($('[data-panel="1"] [data-occupied="true"]').length, 6);
    assert.equal($('[data-panel="1"] [data-occupied="false"]').length, 0);
    assert.match(svg, /Off-region blocks are absent/);
    assert.doesNotThrow(() => generationSchemas(["method"]).scene.parse(sparseAllocationScene));
    for (const identity of ["a0", "a1", "a2", "b0", "b1", "c0"]) assert.equal($('text').filter((_, node) => $(node).text() === identity).length, 2);
  }
  const base = sparseAllocationScene.illustration!.panels[0];
  if (base.kind !== "allocation") return;
  const withGroups = (groups: unknown[]) => ({ ...sparseAllocationScene, illustration: { ...sparseAllocationScene.illustration, panels: [{ ...base, groups }] } });
  assert.throws(() => validateScene(withGroups([{ label: "E1", capacity: 1, items: ["a0", "a1"] }, base.groups[1]])), /overflow/);
  assert.throws(() => validateScene(withGroups([{ label: "E1", capacity: 3, items: ["a0", "a0"] }, base.groups[1]])), /duplicate identities/);
});

test("allocation stress cases keep long group labels and four-character identities legible", () => {
  const base = sparseAllocationScene.illustration!.panels[0];
  if (base.kind !== "allocation") return;
  const groups = Array.from({ length: 4 }, (_, i) => ({ label: `${i}bcdefghijklmnopqr`, capacity: 6, items: ["t001", "t002", "t003", "t004", "t005", "t006"] }));
  const scene = prepareScene({ ...sparseAllocationScene, illustration: { takeaway: "A bounded allocation stress case.", panels: [{ ...base, groups }, { ...base, groups, arrangement: "diagonal" }] } });
  for (const render of [sceneSvg, sceneSvgMobile]) assert.deepEqual(inspectSvg(render(scene)), []);
});

test("memory panels encode residency and matrix area while validating transfers", () => {
  const panel={kind:"memory" as const,title:"Tiled memory",caption:"Illustrative N=4 and d=2; matrix area depicts shape, not actual device capacity.",illustrative:true,sourceIds:["s1"],regions:[{label:"HBM",objects:[{id:"q",label:"Q",shape:"N×d",rows:4,columns:2,residency:"stored" as const},{id:"s",label:"Full scores",shape:"N×N",rows:4,columns:4,residency:"absent" as const}]},{label:"SRAM",objects:[{id:"qi",label:"Q tile",shape:"Br×d",rows:2,columns:2,residency:"transient" as const}]}],coverage:{leftLabel:"Query blocks",rightLabel:"K/V blocks",left:["Q0","Q1"],right:["K0/V0","K1/V1"],order:"right-major" as const},transfers:[{from:"q",to:"qi",label:"load each Q block"}],repeat:"Repeat over all Q/K block pairs, maintaining m, l and partial O."};
  const scene=prepareScene({title:"Exact tiled attention",description:panel.caption,footnote:"Shapes are illustrative; exact attention is preserved.",nodes:[],edges:[],illustration:{takeaway:"Avoid storing full attention matrices in HBM.",panels:[panel,panel]}});
  for(const mobile of [false,true]){
    const svg=(mobile?sceneSvgMobile:sceneSvg)(scene);assert.match(svg,/NOT STORED/);assert.match(svg,/TRANSIENT/);assert.match(svg,/not a stored matrix/);assert.equal((svg.match(/data-tile-visit=/g)||[]).length,8);assert.equal((svg.match(/data-memory-cell="s:/g)||[]).length,32);assert.deepEqual(inspectSvg(svg),[]);
  }
  const bad=structuredClone(scene);const memory=bad.illustration!.panels[0];if(memory.kind!=="memory")throw new Error("fixture");memory.transfers[0].from="s";
  assert.throws(()=>validateScene(bad),/absent memory object/);
});

test("memory diagrams route dense internal and cross-tier dependencies without crossing labels",()=>{
 const objects=(prefix:string)=>Array.from({length:6},(_,i)=>({id:`${prefix}-${i}`,label:`Region object ${i}`,shape:"Longest symbolic shape",rows:6,columns:6,residency:"transient" as const}));
 const panel={kind:"memory" as const,title:"Dense memory example",caption:"Illustrative shapes test bounded routing and readable labels, not device capacity.",illustrative:true,sourceIds:["s1"],regions:[{label:"High bandwidth",objects:objects("a")},{label:"On-chip workspace",objects:objects("b")}],transfers:[...Array.from({length:6},(_,i)=>({from:`a-${i}`,to:`b-${i}`,label:"load"})),...Array.from({length:5},(_,i)=>({from:`b-${i}`,to:`b-${i+1}`,label:"local transform"})),{from:"b-5",to:"a-5",label:"save state"}],repeat:"Repeat the computation; shapes are illustrative.",coverage:{leftLabel:"Query blocks",rightLabel:"Key blocks",left:["query000","query001","query002","query003"],right:["keys0000","keys0001","keys0002","keys0003"],order:"right-major" as const}};
 const scene=prepareScene({title:"Bounded memory routing",description:panel.caption,footnote:"Every supplied dependency must remain visible.",nodes:[],edges:[],illustration:{takeaway:"Route actual objects through their memory regions.",panels:[panel]}});
 for(const mobile of [false,true])assert.deepEqual(inspectSvg((mobile?sceneSvgMobile:sceneSvg)(scene)),[]);
});


test("memory area encoding must preserve symbolic dimensions across both methods",()=>{
 const panel={kind:"memory" as const,title:"Shape test",caption:"Illustrative N=4,d=1 keeps grid area meaningful.",illustrative:true,sourceIds:["s1"],regions:[{label:"HBM",objects:[{id:"q",label:"Q",shape:"N×d",rows:4,columns:1,residency:"stored" as const},{id:"s",label:"S",shape:"N×N",rows:4,columns:4,residency:"stored" as const}]},{label:"SRAM",objects:[{id:"tile",label:"Tile",shape:"Br×Bc",rows:2,columns:2,residency:"transient" as const}]}],transfers:[],repeat:"Repeat over all blocks.",coverage:null};
 const result={title:"Consistent shapes",description:panel.caption,footnote:"Illustrative shapes.",nodes:[],edges:[],illustration:{takeaway:"Same N and d in both methods.",panels:[panel]}};
 assert.doesNotThrow(()=>validateScene(prepareScene(result)));
 const bad=structuredClone(result);bad.illustration.panels[0].regions[0].objects[0].rows=2;assert.throws(()=>validateScene(prepareScene(bad)),/same illustrative N/);
 const combined=structuredClone(result);combined.illustration.panels[0].regions[0].objects[1].shape="2 × N×N";assert.throws(()=>validateScene(prepareScene(combined)),/multiplicity/);
});
