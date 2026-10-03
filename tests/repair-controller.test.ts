import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { repairCandidate, targetCatalog, applyPatch, fingerprint, patchSchema, RepairFailure, type RepairDefect, type Target, type RepairContext } from "../worker/repair-controller";
import { parseModelOutput, requestEdit, verifyObligations, assessRepresentationEdits } from "../worker/repair-model";
import { generationSchemas } from "../worker/generation-schema";
import { exampleContractSchema, validateExampleContract } from "../worker/capabilities";
import { mechanismPlanSchema, validateMechanismPlan } from "../worker/quality";
import { allocationSvg } from "../src/lib/scene-allocation-svg";
import { validateIllustration, illustrationPanelSchema } from "../src/lib/scene-illustration";
import { inspectSvg } from "../worker/diagram-review";

const schema = z.object({ recall: z.object({ mechanism: z.string().max(100), evidence: z.string().max(100), equations: z.array(z.object({ explanation: z.string().max(100), sourceId: z.enum(["method"]) })).max(5) }), scene: z.object({ unit: z.string().max(24), assignments: z.array(z.string().max(4)).max(6) }) });
const initial = { recall: { mechanism: "Incomplete prose", evidence: "Reviewed evidence", equations: [{ explanation: "N is routed assignments", sourceId: "method" as const }] }, scene: { unit: "token slots; each pair =", assignments: ["a1", "a2", "a3", "b1", "b2", "c1"] } };
const unit: RepairDefect = { id: "unit", category: "detached-label", owner: "content", targets: ["/scene/unit"], evidence: "The unit ends after an equals sign.", acceptance: "A complete unit under 24 characters.", sourceIds: ["method"] };
const notation: RepairDefect = { ...unit, id: "notation", category: "notation", targets: ["/recall/equations/0/explanation"], evidence: "The token definition is incorrect.", acceptance: "Define N as source token count." };
function patch(candidate: unknown, targets: Target[], values: unknown[]) {
  return { base: fingerprint(candidate), preimages: Object.fromEntries(targets.map((t, i) => [`t${i}`, t.fingerprint])), changes: Object.fromEntries(values.map((v, i) => [`t${i}`, v])) };
}
const verified = (context: RepairContext, resolved = true) => context.obligations.map(d => ({ id: d.id, resolved, evidence: resolved ? "The exact source-backed target correction is present." : "The target is still incorrect." }));
const record = async () => {};

test("unit and equation edits preserve unrelated recall, assignments and source identities", async () => {
  const result = await repairCandidate(initial, { schema, maxRepairs: 4, record, validate: () => {},
    review: async (candidate, context) => ({ defects: [...(candidate.scene.unit.includes("=") ? [unit] : []), ...(candidate.recall.equations[0].explanation.includes("assignments") ? [notation] : [])], verified: verified(context), complete: true }),
    edit: async (candidate, targets) => patch(candidate, targets, targets.map(t => t.path === "/scene/unit" ? "token slots" : "N is the number of tokens")),
    replan: async () => { throw new Error("Unnecessary replan"); },
  });
  assert.equal(result.rounds, 1);
  assert.equal(result.candidate.scene.unit, "token slots");
  assert.deepEqual(result.candidate.scene.assignments, initial.scene.assignments);
  assert.equal(result.candidate.recall.evidence, initial.recall.evidence);
  assert.equal(result.candidate.recall.mechanism, initial.recall.mechanism);
  assert.ok(result.ledger.every(d => d.status === "resolved"));
});

test("a scope/citation fix has no whole-recall target and cannot rewrite equations", () => {
  const targets = targetCatalog(initial, schema);
  assert.ok(!targets.some(t => t.path === "/recall" || t.path === "/scene"));
  const mechanism = targets.filter(t => t.path === "/recall/mechanism");
  const result = applyPatch(initial, schema, mechanism, patch(initial, mechanism, ["Complete sourced prose [method]"]));
  assert.deepEqual(result.recall.equations, initial.recall.equations);
  const invalid = patch(initial, mechanism, ["Correction"]);
  Object.assign(invalid.changes, { unrelated: "Changed evidence" });
  assert.throws(() => applyPatch(initial, schema, mechanism, invalid));
});

test("native target schema rejects overlength, invented sources, stale and unchanged patches", () => {
  const catalog = targetCatalog(initial, schema);
  const targets = catalog.filter(t => t.path === "/scene/unit");
  assert.throws(() => applyPatch(initial, schema, targets, patch(initial, targets, ["token slots; each pair = one illustrative block"])));
  assert.throws(() => applyPatch(initial, schema, targets, patch(initial, targets, [initial.scene.unit])), /no change/);
  const stale = patch(initial, targets, ["token slots"]); stale.base = "old";
  assert.throws(() => applyPatch(initial, schema, targets, stale));
  const source = catalog.filter(t => t.path === "/recall/equations/0/sourceId");
  assert.throws(() => applyPatch(initial, schema, source, patch(initial, source, ["invented"])));
  const changed = structuredClone(initial); changed.scene.unit = "new";
  assert.throws(() => applyPatch(changed, schema, targets, patch(changed, targets, ["token slots"])), /Stale/);
});

test("omitting an unresolved defect never approves it or freezes a prior positive review", async () => {
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 1, record, validate: () => {},
    review: async (_, context) => ({ defects: context.round ? [] : [notation], verified: [], complete: true }),
    edit: async (candidate, targets) => patch(candidate, targets, ["N is total assignments, still wrong"]),
    replan: async () => { throw new Error("Unexpected"); },
  }), (error: unknown) => error instanceof RepairFailure && error.ledger.some(d => d.id === "notation" && d.status === "disputed"));
});

test("rejected edits retain the original candidate and consume the existing budget", async () => {
  const hashes: string[] = [];
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 2, record, validate: () => {},
    review: async (candidate, context) => { hashes.push(fingerprint(candidate)); return { defects: [unit], verified: verified(context, false), complete: true }; },
    edit: async (candidate, targets) => patch(candidate, targets, ["x".repeat(30)]),
    replan: async () => { throw new RepairFailure("representation", "Fallback cannot repair this case.", [ { ...unit, status: "open", occurrences: 2 } ]); },
  }));
  assert.ok(hashes.length >= 2 && hashes.every(h => h === fingerprint(initial)));
});

test("rejection bookkeeping cannot hide a repeated repair from the two-attempt fallback", async () => {
  let edits = 0, replans = 0;
  const result = await repairCandidate(initial, { schema, maxRepairs: 2, record, validate: () => {},
    review: async (candidate, context) => ({ defects: candidate.scene.unit.includes("=") ? [unit] : [], verified: verified(context, !candidate.scene.unit.includes("=")), complete: true }),
    edit: async (candidate, targets) => { edits++; return patch(candidate, targets, ["x".repeat(30)]); },
    replan: async candidate => {
      replans++;
      const targets = [{ path: "/scene", schema: schema.shape.scene, value: candidate.scene, fingerprint: fingerprint(candidate.scene), constraints: {} }];
      return { targets, patch: patch(candidate, targets, [{ ...candidate.scene, unit: "token slots" }]) };
    } });
  assert.equal(edits, 1); assert.equal(replans, 1); assert.equal(result.rounds, 2);
  assert.deepEqual(result.candidate.recall, initial.recall);
  assert.deepEqual(result.candidate.scene.assignments, initial.scene.assignments);
});

test("one bounded representation fallback preserves the recall and rechecks every gate", async () => {
  let replans = 0;
  const result = await repairCandidate(initial, { schema, maxRepairs: 4, record, validate: () => {},
    review: async (candidate, context) => ({ defects: candidate.scene.unit.includes("=") ? [{ ...unit, owner: "representation" }] : [], verified: verified(context), complete: true }),
    edit: async () => { throw new Error("Expected replan"); },
    replan: async (candidate) => {
      replans++;
      const scene: Target = { path: "/scene", schema: schema.shape.scene, value: candidate.scene, fingerprint: fingerprint(candidate.scene), constraints: {} };
      return { targets: [scene], patch: patch(candidate, [scene], [{ ...candidate.scene, unit: "token slots" }]) };
    },
  });
  assert.equal(replans, 1); assert.deepEqual(result.candidate.recall, initial.recall); assert.equal(result.rounds, 1);
});

test("a second capability fallback stops instead of repeatedly redrawing", async () => {
  let replans = 0;
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 4, record, validate: () => {},
    review: async (_, context) => ({ defects: [{ ...unit, owner: "renderer" }], verified: verified(context, false), complete: true }),
    edit: async () => { throw new Error("Unexpected"); },
    replan: async candidate => { replans++; const targets = targetCatalog(candidate, schema).filter(t => t.path === "/scene/unit"); return { targets, patch: patch(candidate, targets, ["token slots"]) }; },
  }), /fallback exhausted/);
  assert.equal(replans, 1);
});

test("complete review is required even with no open defects, and interruptions are separate", async () => {
  for (const mode of ["incomplete", "execution"] as const) await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 1, record, validate: () => {},
    review: async () => ({ defects: mode === "execution" ? [{ ...unit, owner: "execution" }] : [], verified: [], complete: mode !== "incomplete" }),
    edit: async () => { throw new Error("No edit allowed"); }, replan: async () => { throw new Error("No replan allowed"); },
  }), (error: unknown) => error instanceof RepairFailure && error.owner === "execution");
});

test("the earlier MegaBlocks eight-token/six-token conflict fails before drafting", () => {
  const route = illustrationPanelSchema.options[1];
  const panel = { kind: "routing", title: "Routing", caption: "Illustrative routing.", illustrative: true, sourceIds: ["method"], leftLabel: "tokens", rightLabel: "experts", left: Array.from({ length: 8 }, (_, i) => `t${i + 1}`), right: ["E1", "E2", "E3"], links: [{ left: 0, right: 0 }], direction: "left-to-right", counts: "none" };
  assert.throws(() => route.parse(panel));
  assert.throws(() => exampleContractSchema.parse({ panels: [panel], sharedIdentities: panel.left }));
});

test("planning comparison preserves all declared identities and block arithmetic", () => {
  const panel = { kind: "allocation" as const, title: "Allocation", caption: "Two-slot blocks are illustrative.", illustrative: true, sourceIds: ["method"], arrangement: "diagonal" as const, unit: "token slots", blockSize: 2, groups: [{ label: "E1", capacity: 4, items: ["a1", "a2", "a3"] }, { label: "E2", capacity: 2, items: ["b1", "b2"] }, { label: "E3", capacity: 2, items: ["c1"] }] };
  const plan = mechanismPlanSchema.parse({ contribution: "Contribution", baseline: "Baseline", evidenceScope: "full-text", steps: [{ phase: "training", input: "tokens", operation: "allocate", output: "blocks", purpose: "retain tokens", sourceIds: ["method"] }], criticalDistinctions: ["Rows differ from blocks"], math: { essential: false, reason: "Visual lesson", computations: [] }, walkthrough: { essential: false, reason: "Visual lesson" }, diagram: { focus: "padding", transferredObjects: "tokens", omitted: "metadata", representation: "allocation", example: { panels: [panel], sharedIdentities: ["a1", "a2", "a3", "b1", "b2", "c1"] } }, unknowns: [] });
  assert.doesNotThrow(() => validateMechanismPlan(plan, [{ id: "method", label: "Methods", url: "https://arxiv.org/abs/2211.15841", excerpt: "Method evidence" }], "full-text"));
  const missing = structuredClone(plan); missing.diagram.example!.sharedIdentities.push("t8");
  assert.throws(() => validateExampleContract(missing), /preserve/);
  assert.throws(() => validateIllustration({ takeaway: "Block grouping", panels: [{ ...panel, groups: [{ ...panel.groups[0], capacity: 3 }, ...panel.groups.slice(1)] }] }), /divisible/);
  assert.throws(() => validateIllustration({ takeaway: "Block grouping", panels: [{ ...panel, illustrative: false }] }), /illustrative/);
  for (const arrangement of ["lanes", "diagonal"] as const) for (const width of [298, 400]) {
    const rendered = allocationSvg({ ...panel, arrangement }, width);
    assert.equal((rendered.svg.match(/data-allocation-block=/g) || []).length, 4);
    assert.equal((rendered.svg.match(/data-occupied="true"/g) || []).length, 6);
    assert.equal((rendered.svg.match(/data-occupied="false"/g) || []).length, 2);
    assert.deepEqual(inspectSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 40} ${rendered.height + 40}"><g transform="translate(20 20)">${rendered.svg}</g></svg>`), []);
  }
});

test("block grouping survives generation/publication schemas while legacy slot output is unchanged", () => {
  const allocation = illustrationPanelSchema.options[4];
  const old = allocation.parse({ kind: "allocation", title: "Legacy", caption: "Legacy independent slots.", illustrative: true, sourceIds: ["method"], arrangement: "lanes", unit: "tokens", groups: [{ label: "E1", capacity: 2, items: ["a1"] }, { label: "E2", capacity: 2, items: ["b1"] }] });
  assert.equal(allocationSvg(old, 400).svg, allocationSvg({ ...old, blockSize: null }, 400).svg);
  const generated = generationSchemas(["method"]).scene.shape.illustration.unwrap().unwrap().shape.panels;
  assert.equal((generated.parse([{ ...old, blockSize: 2 }])[0] as typeof old).blockSize, 2);
});

test("format recovery removes only received JSON fences and never invents missing content", () => {
  assert.deepEqual(parseModelOutput('```json\n{"value":1}\n```', z.object({ value: z.literal(1) })), { value: 1 });
  assert.throws(() => parseModelOutput('{"value":', z.object({ value: z.literal(1) })), RepairFailure);
  assert.throws(() => parseModelOutput('{}', z.object({ value: z.literal(1) })), RepairFailure);
});

test("edit model receives native constraints and fingerprint-bound output schema", async () => {
  const targets = targetCatalog(initial, schema).filter(t => t.path === "/scene/unit");
  const context: RepairContext = { round: 0, fingerprint: fingerprint(initial), catalog: targets, obligations: [] };
  const response = await requestEdit(async (prompt, output) => { assert.match(prompt, /maxLength/); assert.match(prompt, /Preserve all other native fields exactly/); return output.parse(patch(initial, targets, ["token slots"])); }, initial, targets, [unit], context, "Source method");
  assert.doesNotThrow(() => patchSchema(targets, context.fingerprint).parse(response));
});

test("rejected representation patches never adopt a replacement plan", async () => {
  let adopted = false;
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 1, record, validate: () => {},
    review: async (_, context) => ({ defects: [{ ...unit, owner: "representation" }], verified: verified(context, false), complete: true }),
    edit: async () => { throw new Error("Unexpected edit"); },
    replan: async candidate => { const targets = targetCatalog(candidate, schema).filter(t => t.path === "/scene/unit"); return { targets, patch: patch(candidate, targets, ["token slots"]), validate: () => { throw new Error("Bad replacement"); }, adopt: () => { adopted = true; } }; },
  }), /budget exhausted/);
  assert.equal(adopted, false);
});

test("supplement edits preserve every other figure and quiz question", async () => {
  const supplement = z.object({ figures: z.array(z.object({ title: z.string(), caption: z.string() })), quiz: z.array(z.object({ question: z.string(), options: z.array(z.string()), answer: z.number().int(), explanation: z.string() })) });
  const pack = { figures: [{ title: "A", caption: "Bad units" }, { title: "B", caption: "Reviewed figure" }], quiz: [{ question: "First?", options: ["Wrong", "Correct"], answer: 0, explanation: "Incorrect" }, { question: "Second?", options: ["Yes", "No"], answer: 0, explanation: "Reviewed answer" }] };
  const defect = { ...unit, targets: ["/figures/0/caption", "/quiz/0/answer", "/quiz/0/explanation"] };
  const result = await repairCandidate(pack, { schema: supplement, maxRepairs: 2, record, validate: () => {},
    review: async (_, context) => ({ defects: context.round ? [] : [defect], verified: verified(context), complete: true }),
    edit: async (candidate, targets) => patch(candidate, targets, targets.map(t => t.path.endsWith("caption") ? "Complete units" : t.path.endsWith("answer") ? 1 : "Source supports the second option")),
    replan: async () => { throw new Error("Unnecessary replan"); },
  });
  assert.deepEqual(result.candidate.figures[1], pack.figures[1]);
  assert.deepEqual(result.candidate.quiz[1], pack.quiz[1]);
  assert.deepEqual(result.candidate.quiz[0].options, pack.quiz[0].options);
  assert.equal(result.candidate.quiz[0].answer, 1);
});

test("overlapping targets are rejected and execution failures never become content retries", async () => {
  const catalog = targetCatalog(initial, schema), targets = catalog.filter(t => ["/recall/equations", "/recall/equations/0/explanation"].includes(t.path));
  assert.throws(() => applyPatch(initial, schema, targets, patch(initial, targets, [[], "N is tokens"])), /Overlapping/);
  let edits = 0;
  await assert.rejects(repairCandidate(initial, { schema, maxRepairs: 4, record, validate: () => {},
    review: async () => ({ defects: [unit], verified: [], complete: true }),
    edit: async () => { edits++; throw new RepairFailure("execution", "Model timed out"); },
    replan: async () => { throw new Error("Unexpected"); },
  }), (error: unknown) => error instanceof RepairFailure && error.owner === "execution" && error.ledger.length === 1);
  assert.equal(edits, 1);
});

test("review evidence binding changes with sources, schema or renderer inputs", async () => {
  const bindings: string[] = [];
  for (const inputs of [{ sources: "v1", renderer: "v1" }, { sources: "v2", renderer: "v1" }, { sources: "v1", renderer: "v2" }]) {
    await repairCandidate(initial, { schema, binding: inputs, maxRepairs: 0, validate: () => {}, record: async (name, data) => { if (name === "review-0") bindings.push((data as { binding: string }).binding); },
      review: async () => ({ defects: [], verified: [], complete: true }), edit: async () => null, replan: async () => { throw new Error("Unexpected"); },
    });
  }
  assert.equal(new Set(bindings).size, 3);
});

test("schematic token circles stay separate and connectors touch visible shapes", async () => {
  const { schematicSvg } = await import('../src/lib/scene-schematic-svg');
  const { load } = await import('cheerio');
  for (const count of [2, 6]) for (const width of [318, 840]) {
    const panel = illustrationPanelSchema.options[3].parse({ kind: 'schematic', title: 'Shared token route', caption: 'Illustrative controller branching.', illustrative: true, sourceIds: ['method'], nodes: [
      { id: 'tokens', label: 'Token identity', detail: 'Same input', glyph: 'tokens', items: ['Naka','mura','tok3','tok4','tok5','tok6'].slice(0,count) },
      { id: 'trunk', label: 'Shared controller', detail: 'Common trunk', glyph: 'module' },
      { id: 'attention', label: 'Attention', detail: 'Full context', glyph: 'module' },
      { id: 'expert', label: 'FFN expert', detail: 'Null at k=1', glyph: 'bank', capacity: 1, items: ['null'] },
    ], edges: [{ from:'tokens',to:'trunk',label:'state',dashed:false },{ from:'trunk',to:'attention',label:'mode',dashed:false },{ from:'trunk',to:'expert',label:'choice',dashed:true }] });
    const rendered=schematicSvg(panel as Extract<typeof panel,{kind:'schematic'}>,width,'#8068be','arrow','test');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rendered.height}">${rendered.svg}</svg>`;
    const $=load(svg,{xml:true});
    const circles=$('circle[data-token]').toArray().map(el=>({x:Number($(el).attr('cx')),y:Number($(el).attr('cy')),r:Number($(el).attr('r'))}));
    assert.equal(circles.length,count);
    for(let i=0;i<circles.length;i++)for(let j=i+1;j<circles.length;j++)assert.ok(Math.hypot(circles[i].x-circles[j].x,circles[i].y-circles[j].y)>circles[i].r+circles[j].r);
    const d=$('path[data-from="test-tokens"]').attr('d')!;
    const start=/^M([\d.]+) ([\d.]+)/.exec(d)!;
    assert.ok(circles.some(c=>Math.abs(Math.hypot(Number(start[1])-c.x,Number(start[2])-c.y)-c.r)<0.01));
    assert.deepEqual(inspectSvg(svg),[]);
  }
});

test("renderer defects locate a figure for one bounded replan without editable targets", async () => {
  const supplement=z.object({figures:z.array(z.object({caption:z.string(),layers:z.number().int().min(1).max(5)})),quiz:z.array(z.string())});
  const pack={figures:[{caption:'Correct operator sequence',layers:5},{caption:'Reviewed figure',layers:2}],quiz:['Reviewed question']};
  const defect={...unit,id:'layers',owner:'representation' as const,artifact:'/figures/0',targets:[],acceptance:'A truthful renderable figure with four dependency layers or fewer.'};
  let replans=0;
  const result=await repairCandidate(pack,{schema:supplement,maxRepairs:2,record,validate: next=>{assert.ok(next.figures[0].layers<=4);},
    review:async (_,context)=>({defects:context.round?[]:[defect],verified:verified(context),complete:context.round>0}),
    edit:async()=>{throw Error('No ordinary targets');},
    replan:async(candidate,defects)=>{replans++;assert.equal(defects[0].artifact,'/figures/0');const value=candidate.figures[0],target={path:'/figures/0',value,schema:supplement.shape.figures.element,fingerprint:fingerprint(value),constraints:{}};return{targets:[target],patch:patch(candidate,[target],[{...value,layers:4}])};},
  });
  assert.equal(replans,1);assert.deepEqual(result.candidate.figures[1],pack.figures[1]);assert.deepEqual(result.candidate.quiz,pack.quiz);
  await assert.rejects(repairCandidate(pack,{schema:supplement,maxRepairs:1,record,validate:()=>{},review:async()=>({defects:[{...defect,artifact:'/figures/99'}],verified:[],complete:true}),edit:async()=>null,replan:async()=>{throw Error('Unexpected');}}),/unavailable artifact/);
});


test("defect verification receives current renderings and rejects stale bindings", async () => {
  const context: RepairContext={round:1,fingerprint:fingerprint(initial),binding:fingerprint('current-source-renderer'),catalog:targetCatalog(initial,schema),obligations:[{...unit,status:'open',occurrences:1}]};
  const checks=await verifyObligations(async(prompt,output,name,images)=>{
    assert.deepEqual(images,['current-desktop.png','current-mobile.png']);
    assert.match(prompt,/attached current rendered images/);
    assert.throws(()=>output.parse({candidate:context.fingerprint,binding:'stale',checks:[{id:'unit',resolved:true,resolution:'same-representation',evidence:'Checked current unit'}]}));
    return output.parse({candidate:context.fingerprint,binding:context.binding,checks:[{id:'unit',resolved:true,resolution:'same-representation',evidence:'Checked current rendered unit'}]});
  },initial,context,'Current source',['current-desktop.png','current-mobile.png']);
  assert.equal(checks[0].resolved,true);
});

test("duplicate findings in one review retain both obligations without counting recurrence", async()=>{
 const result=await repairCandidate(initial,{schema,maxRepairs:1,record,validate:()=>{},
  review:async(_,context)=>({defects:context.round?[]:[unit,{...unit,evidence:'A second view has the same incomplete unit.',acceptance:'The short unit is complete in both views.'}],verified:verified(context),complete:true}),
  edit:async(candidate,targets,defects)=>{assert.match(defects[0].acceptance,/both views/);return patch(candidate,targets,['token slots']);},replan:async()=>{throw Error('Unexpected');},
 });
 assert.equal(result.ledger.length,1);assert.equal(result.ledger[0].occurrences,1);assert.equal(result.ledger[0].status,'resolved');
});


test("representation feasibility selects native edits without weakening acceptance", async()=>{
 const defect={...unit,id:'proof',owner:'representation' as const,artifact:'/scene',targets:[],acceptance:'The complete operand dependency is visible in both views.'};
 const context: RepairContext={round:0,fingerprint:fingerprint(initial),catalog:targetCatalog(initial,schema),obligations:[]};
 const revised=await assessRepresentationEdits(async(prompt,output)=>{assert.match(prompt,/Do not change or waive/);return output.parse({binding:context.fingerprint,decisions:[{id:'proof',action:'edit',targets:['/scene/unit'],rationale:'The native field can express the correction.'}]});},initial,[defect],context,'Actual source and capabilities');
 assert.equal(revised[0].owner,'content');assert.deepEqual(revised[0].targets,['/scene/unit']);assert.equal(revised[0].acceptance,defect.acceptance);assert.equal(revised[0].evidence,defect.evidence);
 await assert.rejects(assessRepresentationEdits(async(_,output)=>output.parse({binding:context.fingerprint,decisions:[{id:'proof',action:'edit',targets:['/scene'],rationale:'Replace the artifact'}]}),initial,[defect],context,'Sources'),/Invalid native|Invalid option/);
});

test("source numeric gates recognize thousands without inventing fragments or values", async()=>{
 const {sourceNumbers}=await import('../src/lib/source-numbers');
 const {validateStudy}=await import('../src/lib/study');
 assert.deepEqual(sourceNumbers('5,048 MB; -12,345.5 units; 26 MB; 1,2 items'),[5048,-12345.5,26,1,2]);
 assert.ok(!sourceNumbers('5,048 MB').includes(5));assert.ok(!sourceNumbers('5,048 MB').includes(48));assert.ok(!sourceNumbers('50,48').includes(5048));
 const sources=[{id:'method',label:'Methods',url:'https://arxiv.org/abs/2305.14314',excerpt:'Frozen base weights 5,048 MB; LoRA parameters 26 MB under the stated setting.'}];
 const figure={id:'memory',kind:'bars' as const,title:'Memory',placement:'evidence' as const,caption:'Reported memory components in the cited training setting; these are not total memory.',sourceId:'method',provenance:'reported' as const,unit:'MB',series:[{label:'Base',value:5048,note:'Reported'},{label:'LoRA',value:26,note:'Reported'}]};
 const question={id:'q1',question:'Which component occupies more memory?',options:[{text:'Base',explanation:'The base occupies the larger reported amount.'},{text:'LoRA',explanation:'The adapters occupy the smaller reported amount.'},{text:'Equal',explanation:'The supplied values clearly differ in magnitude.'}],answer:0,sourceId:'method'};
 assert.doesNotThrow(()=>validateStudy({figures:[figure],quiz:[question,{...question,id:'q2'}]},sources));
 assert.throws(()=>validateStudy({figures:[{...figure,series:[{...figure.series[0],value:5049},figure.series[1]]}],quiz:[question,{...question,id:'q2'}]},sources),/absent/);
 const {validateIllustrationSources}=await import('../src/lib/scene-illustration');
 assert.doesNotThrow(()=>validateIllustrationSources({takeaway:'Reported memory',panels:[{kind:'bars',title:'Memory',caption:figure.caption,sourceIds:['method'],illustrative:false,unit:'MB',items:[{label:'Base',value:5048},{label:'LoRA',value:26}]}]},sources));
});

test("crowded memory transfer numbers have explicit leaders to their own connector",async()=>{
 const {memorySvg}=await import('../src/lib/scene-memory-svg');const {load}=await import('cheerio');
 const panel={kind:'memory' as const,title:'Memory transfers',caption:'Illustrative local operand transfers.',illustrative:true,sourceIds:['method'],regions:[{label:'HBM',objects:[{id:'q',label:'Q',shape:'N×d',rows:2,columns:2,residency:'stored' as const},{id:'k',label:'K',shape:'N×d',rows:2,columns:2,residency:'stored' as const}]},{label:'SRAM',objects:[{id:'s',label:'Score tile',shape:'Br×Bc',rows:1,columns:1,residency:'transient' as const}]}],transfers:[{from:'q',to:'s',label:'Q operand'},{from:'k',to:'s',label:'K operand'}],repeat:'Illustrative transfers, not physical capacities.'};
 for(const width of [318,840]){
  const rendered=memorySvg(panel,width,'arrow','test');const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width+40} ${rendered.height+40}">${rendered.svg}</svg>`;const $=load(svg,{xml:true});
  for(let n=1;n<=panel.transfers.length;n++){
   const d=$(`path[data-transfer="${n}"]`).attr('d')!,start=/^M([\d.]+) ([\d.]+)/.exec(d)!;
   const leader=$(`path[data-transfer-leader="${n}"]`).last().attr('d')!,end=/L([\d.]+) ([\d.]+)$/.exec(leader)!;
   assert.deepEqual(end.slice(1).map(Number),start.slice(1).map(Number));assert.equal($(`text[data-transfer-label="${n}"]`).text(),String(n));
  }
  assert.deepEqual(inspectSvg(svg),[]);
 }
});

test("adopted replans support explicit geometry resolution but never auto-resolve scientific findings",async()=>{
 const supplement=z.object({figures:z.array(z.object({kind:z.enum(['schematic','matrix']),caption:z.string()}))});
 const pack={figures:[{kind:'schematic' as const,caption:'Bad caption'},{kind:'matrix' as const,caption:'Reviewed figure'}]};
 const geometry={...unit,id:'geometry',owner:'renderer' as const,artifact:'/figures/0',targets:[],acceptance:'Old graph arrows must be distinct.'};
 const content={...unit,id:'science',owner:'content' as const,artifact:'/figures/0',targets:['/figures/0/caption'],acceptance:'The caption defines the source maximum and normalization.'};
 const result=await repairCandidate(pack,{schema:supplement,maxRepairs:2,record,validate:()=>{},
  review:async(_,context)=>{
   if(context.round){const receipt=context.obligations.find(d=>d.id==='geometry')?.replacement;if(context.round===1){assert.equal(receipt?.beforeKind,'schematic');assert.equal(receipt?.afterKind,'matrix');}}
   return{defects:context.round===0?[geometry]:context.round===1?[content]:[],verified:context.obligations.map(d=>({id:d.id,resolved:true,resolution:d.id==='geometry'?'replacement' as const:'same-representation' as const,evidence:'Current source and rendered proof were independently checked.'})),complete:true};
  },
  replan:async candidate=>{const value=candidate.figures[0],target={path:'/figures/0',value,schema:supplement.shape.figures.element,fingerprint:fingerprint(value),constraints:{}};return{targets:[target],patch:patch(candidate,[target],[{...value,kind:'matrix'}])};},
  edit:async(candidate,targets)=>patch(candidate,targets,['Complete maximum and normalized output']),
 });
 assert.equal(result.rounds,2);assert.ok(result.ledger.every(d=>d.status==='resolved'));assert.ok(!result.ledger.find(d=>d.id==='science')?.replacement);assert.deepEqual(result.candidate.figures[1],pack.figures[1]);
 await assert.rejects(repairCandidate(initial,{schema,maxRepairs:1,record,validate:()=>{},review:async(_,context)=>({defects:context.round?[]:[unit],verified:context.obligations.map(d=>({id:d.id,resolved:true,resolution:'replacement' as const,evidence:'Claimed replacement'})),complete:true}),edit:async(candidate,targets)=>patch(candidate,targets,['token slots']),replan:async()=>{throw Error('Unexpected');}}),/adopted artifact replan/);
});

test("retain corrected A privately with unrelated disputed B, then resolve B", async () => {
 const shape=z.object({a:z.number(),b:z.number(),untouched:z.string()}), start={a:0,b:0,untouched:"Keep"};
 const issue=(name:string):RepairDefect=>({id:name,owner:"content",category:"math",invariant:"positive",objectId:name,targets:[`/${name}`],sourceIds:[],evidence:"Must be positive",acceptance:"Set to one"});
 const snapshots:unknown[]=[];
 const result=await repairCandidate(start,{schema:shape,maxRepairs:2,record,validate:c=>{assert.equal(c.a,1);assert.equal(c.b,1);},inspect:c=>["a","b"].filter(k=>c[k as "a"|"b"]===0).map(k=>({invariant:"positive",objectId:k,paths:[`/${k}`],dependencies:[],message:"Must be positive"})),
 review:async(c,ctx)=>{snapshots.push(structuredClone(c));const defects=[...(c.a===0?[issue("a")]:[]),...(c.b===0?[issue("b")]:[])];return{defects,disputedIds:ctx.round===0?["b"]:[],verified:ctx.obligations.map(d=>({id:d.id,resolved:c[d.objectId as "a"|"b"]===1,evidence:"Checked current field"})),complete:c.a===1&&c.b===1};},
 edit:async(c,t)=>patch(c,t,t.map(()=>1)),replan:async()=>{throw Error("Unexpected");}});
 assert.deepEqual(snapshots,[start,{...start,a:1},{...start,a:1,b:1}]); assert.equal(result.candidate.untouched,"Keep");
});
test("defect identity survives category changes and wider field localization",async()=>{
 let seen=0;
 await assert.rejects(repairCandidate(initial,{schema,maxRepairs:1,record,validate:()=>{},review:async(_,ctx)=>{
 const finding={...unit,id:ctx.round?"new-review-id":"old-review-id",objectId:"unit-label",invariant:"complete-unit",category:ctx.round?"different-category":"old-category",targets:ctx.round?["/scene/unit","/recall/mechanism"]:["/scene/unit"]};
 seen=ctx.obligations.length;return{defects:[finding],verified:verified(ctx,false),complete:false};},edit:async(c,t)=>patch(c,t,["still wrong"]),replan:async()=>{throw Error("Unexpected");}}),(e:unknown)=>e instanceof RepairFailure&&e.ledger.length===1&&e.ledger[0].occurrences===2);
 assert.equal(seen,1);
});
test("an interrupted edit reserves its budget in the checkpoint before execution",async()=>{
 let checkpoint:any;
 await assert.rejects(repairCandidate(initial,{schema,maxRepairs:1,record,validate:()=>{},checkpoint:async c=>{checkpoint=structuredClone(c);},review:async()=>({defects:[unit],verified:[],complete:false}),edit:async()=>{throw new RepairFailure("execution","interrupted");},replan:async()=>{throw Error("Unexpected");}}));
 assert.equal(checkpoint.round,1); assert.deepEqual(checkpoint.candidate,initial);
 await assert.rejects(repairCandidate(initial,{schema,maxRepairs:1,resume:checkpoint,record,validate:()=>{},review:async(_,ctx)=>({defects:[unit],verified:verified(ctx,false),complete:false}),edit:async()=>{throw Error("Budget incorrectly reset");},replan:async()=>{throw Error("Unexpected");}}),/budget exhausted/);
});

test("complete overlength drafts stay private and shorten through native field repairs",async()=>{
 const native=z.object({title:z.string().max(12),body:z.string().max(20)});
 const draft={title:"A complete title that is too long.",body:"This complete body is also too long."};
 const observed:unknown[]=[];
 const result=await repairCandidate(draft,{schema:native,maxRepairs:2,record,validate:c=>{native.parse(c);},inspect:()=>[],review:async(c,ctx)=>{observed.push({...c});return{defects:[],verified:ctx.obligations.map(d=>({id:d.id,resolved:true,evidence:"The full field now fits its native bound."})),complete:true};},edit:async(c,t)=>patch(c,t,t.map(x=>x.path==="/title"?"A title.":"A complete body.")),replan:async()=>{throw Error("No fallback");}});
 assert.deepEqual(observed[0],draft);assert.deepEqual(result.candidate,{title:"A title.",body:"A complete body."});assert.equal(result.rounds,1);
});
test("native text findings override duplicate reviewer ownership and survive exhaustion",async()=>{
 const native=z.object({text:z.string().max(5)});let checkpoint:any;
 await assert.rejects(repairCandidate({text:"A complete longer sentence."},{schema:native,maxRepairs:0,record,validate:()=>{},checkpoint:async c=>{checkpoint=c;},review:async()=>({defects:[{id:"reviewer",invariant:"native-text-length",objectId:"/text",category:"scientific-native-text-length",owner:"content",targets:["/text"],evidence:"Text exceeds the maximum.",acceptance:"Shorten it.",sourceIds:[]}],verified:[],disputedIds:["reviewer"],complete:false}),edit:async()=>{throw Error("Unexpected");},replan:async()=>{throw Error("Unexpected");}}),/budget exhausted/);
 assert.equal(checkpoint.ledger.length,1);assert.equal(checkpoint.ledger[0].owner,"schema");assert.equal(checkpoint.ledger[0].status,"open");
});

test('identity reconciliation preserves renamed and relocated defects without merging distinct invariants',async()=>{
 const {reconcileDefectIdentities}=await import('../worker/repair-model');
 const old={...notation,id:'controller-owned',invariant:'essential-safeguards',objectId:'safeguards-equation',status:'resolved' as const,occurrences:1};
 const renamed={...notation,id:'reviewer-new',invariant:'Complete safeguards formulas',objectId:'equation-at-new-position',targets:['/recall/equations/1/explanation']};
 const distinct={...renamed,id:'distinct',invariant:'unit-consistency'};
 const context={round:1,fingerprint:fingerprint(initial),catalog:[],obligations:[],history:[old]};
 const result=await reconcileDefectIdentities(async(_p,s)=>s.parse({candidate:context.fingerprint,mappings:{f0:{sameAs:old.id,reason:'Same missing safeguards after a move.'},f1:{sameAs:null,reason:'A separate unit mismatch.'}}}),[renamed,distinct],initial,context);
 assert.equal(result[0].id,old.id);assert.equal(result[0].objectId,old.objectId);assert.equal(result[0].invariant,old.invariant);
 assert.deepEqual(result[0].targets,renamed.targets);assert.equal(result[1].id,'distinct');assert.equal(old.status,'resolved');
});
test('duplicate identities within the first review share one controller obligation',async()=>{
 const {reconcileDefectIdentities}=await import('../worker/repair-model');
 const first={...notation,id:'first',invariant:'safeguards',objectId:'equation-safeguards'};
 const renamed={...first,owner:'representation' as const,id:'renamed',invariant:'Complete planned safeguards',objectId:'equation-4'};
 const context={round:0,fingerprint:fingerprint(initial),catalog:[],obligations:[]};
 const result=await reconcileDefectIdentities(async(_p,s)=>s.parse({candidate:context.fingerprint,mappings:{f0:{sameAs:null,reason:'New obligation.'},f1:{sameAs:'first',reason:'Same object and missing equation.'}}}),[first,renamed],initial,context);
 assert.equal(result[0].id,result[1].id);assert.equal(result[1].objectId,first.objectId);assert.equal(result[1].owner,first.owner);
});
test('text repair receives the rejected math error and retains targeted retries',async()=>{
 let attempts=0;
 const result=await repairCandidate(initial,{
  schema,maxRepairs:4,allowRepresentationFallback:false,record,
  validate(candidate){if(candidate.recall.equations[0].explanation==='bad-command')throw Error('Unsupported KaTeX command: textsc');},
  review:async(candidate,context)=>({complete:candidate.recall.equations[0].explanation==='N is source tokens',defects:candidate.recall.equations[0].explanation==='N is source tokens'?[]:[notation],verified:verified(context,candidate.recall.equations[0].explanation==='N is source tokens')}),
  edit:async(candidate,targets,defects)=>{
   attempts++;if(attempts===2)assert.ok(defects.some(d=>d.evidence.includes('Unsupported KaTeX command')));
   return patch(candidate,targets,[attempts===1?'bad-command':'N is source tokens']);
  },
  replan:async()=>{throw Error('Text must never request a visual fallback');},
 });
 assert.equal(attempts,2);assert.equal(result.candidate.recall.equations[0].explanation,'N is source tokens');
});
test('first patch audit receives the newly registered targeted defect',async()=>{
 let audited=false;
 await repairCandidate(initial,{
  schema,maxRepairs:1,record,validate:()=>{},
  review:async(candidate,context)=>({complete:candidate.scene.unit==='token slots',defects:candidate.scene.unit==='token slots'?[]:[unit],verified:verified(context)}),
  edit:async(candidate,targets)=>patch(candidate,targets,['token slots']),
  auditPatch:async(_before,_after,_targets,context)=>{audited=true;assert.equal(context.obligations[0].id,unit.id);assert.equal(context.obligations[0].acceptance,unit.acceptance);},
  replan:async()=>{throw Error('Unexpected fallback');},
 });
 assert.equal(audited,true);
});
test('owning-array patches retain an unchanged overlong sibling privately but reject newly overlong text',()=>{
 const s=z.object({items:z.array(z.object({text:z.string().max(5)})).max(3)});
 const before={items:[{text:'bad'},{text:'existing overlong draft'}]};
 const target=targetCatalog(before,s).filter(t=>t.path==='/items');
 const after=applyPatch(before,s,target,patch(before,target,[[{text:'fixed'},before.items[1]]]));
 assert.equal(after.items[0].text,'fixed');assert.equal(after.items[1].text,before.items[1].text);
 assert.throws(()=>applyPatch(before,s,target,patch(before,target,[[{text:'newly overlong'},before.items[1]]])),/Too big/);
});
test('an owning-array patch adopts A while unchanged unrelated B remains disputed',async()=>{
 const s=z.object({items:z.array(z.object({text:z.string().max(20)})).max(3)});
 const before={items:[{text:'bad A'},{text:'bad B'}]};let saved=before;
 const a={...unit,id:'a',targets:['/items'],evidence:'A is incorrect.',acceptance:'A is fixed.'};
 const b={...a,id:'b',evidence:'B is disputed.',acceptance:'B is supported.'};
 await assert.rejects(repairCandidate(before,{
  schema:s,maxRepairs:2,record,validate:()=>{},checkpoint:async state=>{saved=structuredClone(state.candidate);},
  inspect:candidate=>candidate.items.flatMap((item,i)=>item.text.startsWith('bad')?[{invariant:'valid',objectId:`item-${i}`,paths:[`/items/${i}/text`],dependencies:[],message:'Invalid item'}]:[]),
  review:async(candidate,context)=>({complete:false,defects:context.round?[b]:[a,b],disputedIds:context.round?['b']:[],verified:context.obligations.map(d=>({id:d.id,resolved:d.id==='a'&&candidate.items[0].text==='fixed A',evidence:'Checked the corresponding item.'}))}),
  edit:async(candidate,targets)=>patch(candidate,targets,[[{text:'fixed A'},candidate.items[1]]]),
  replan:async()=>{throw Error('Unexpected replacement');},
 }),/unresolved source disputes/);
 assert.deepEqual(saved,{items:[{text:'fixed A'},{text:'bad B'}]});
});
test('identical defect IDs retain one repair owner despite reviewer category disagreement',async()=>{
 const {reconcileDefectIdentities}=await import('../worker/repair-model');
 const first={...unit,id:'same',invariant:'same-invariant',objectId:'panel'};
 const second={...first,owner:'representation' as const,category:'visual-representation'};
 const result=await reconcileDefectIdentities(async()=>{throw Error('No semantic identity call is needed');},[first,second],initial,{round:0,fingerprint:fingerprint(initial),catalog:[],obligations:[]});
 assert.deepEqual(result.map(d=>d.owner),['content','content']);assert.deepEqual(result.map(d=>d.id),['same','same']);
});
