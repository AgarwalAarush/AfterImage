import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateKit } from "../worker/component-pipeline";
import { initialState } from "../src/lib/catalog";
import { abstractResearch } from "../src/lib/research-bundle";
import { fingerprint, targetCatalog, applyPatch, defectScope } from "../worker/repair-controller";
import { glyphSchema } from "../src/lib/scene-glyphs";
import { expertChoiceScene } from "./fixtures/expert-choice-scene";
import { viableNativeFinding, type Model } from "../worker/repair-model";
import { componentTeachingContract, teachingOwnership, evidenceAvailability, evidenceGroups } from "../worker/component-contracts";
import { sourcePassages } from "../worker/evidence";

const globalControl = "Teach heterogeneous relaxations, gradient normalization, and per-axis whitening.";
const table = "GFLOPs: standard 66.6, FlashAttention 75.2. HBM R/W: 40.3 GB versus 4.4 GB. Runtime: 41.7 ms versus 7.3 ms.";
async function diagramCase(check: (prompt: string, name: string) => void, requestOmitted=false) {
 const dir=await mkdtemp(path.join(os.tmpdir(),"component-contract-"));
 try {
  const paper=initialState().papers[0];
  const sources=[{id:"method",label:"Method",url:"https://arxiv.org/html/2607.06601v1",excerpt:"A shared controller makes independent read, FFN, and cache choices."},
   {id:"overview",label:"Overview",url:"https://arxiv.org/html/2607.06601v1#S1",excerpt:"The independent choices are shown in an illustrative comparison."},
   {id:"profile",label:"Profiling table",url:"https://arxiv.org/html/2607.06601v1#S3",excerpt:table}, {id:"late",label:"Later boundary appendix",url:"https://arxiv.org/html/2607.06601v1#A1",excerpt:"Late exact evidence establishes the boundary convention."}];
  const ids=sources.map(s=>`${s.id}:${fingerprint([s.url,s.excerpt]).slice(0,16)}`);
  paper.sources=sources;paper.scene=null;paper.recall={version:2,idea:"Independent choices.",problem:"Dense compute is costly.",mechanism:"Select the three actions independently.",evidence:"Only the reported profiling conditions are supported.",limitation:"No independent verification.",significance:"Allocate resources.",sourceIds:["method"]} as any;
  const scene={title:expertChoiceScene.title,description:expertChoiceScene.description,footnote:expertChoiceScene.footnote,nodes:[],edges:[],illustration:{...expertChoiceScene.illustration!,panels:expertChoiceScene.illustration!.panels.map(p=>({...p,sourceIds:["method","overview"]}))}};
  const reviews: {prompt:string;name:string}[]=[];let requested=false;
  const model:Model=async(prompt,schema,name)=>{
   if(name==="kit-plan")return schema.parse({requirements:[globalControl,"Explain the reported profiling conditions."],equations:["Resource cost fractions and their dense references."],example:"An illustrative pair of tokens makes separate choices.",diagram:{proof:"Show independent attention, FFN, and cache choices.",objects:5,representation:"illustration"},figures:[{id:"collapse",question:"How do the training controls prevent routing collapse?",kind:"illustration"}],sourceIds:[ids[0],ids[2]]});
   if(name==="plan-evidence")return schema.parse({sourceIds:[ids[0],ids[2]]});
   if(name.startsWith("plan-feasibility"))return schema.parse({feasible:true,blockers:[]});
   if(name.endsWith("select-sources"))return schema.parse({sourceIds:[ids[0]]});
   if(name.includes("source-review")||name.includes("visual-review")){reviews.push({prompt,name});if(requestOmitted&&!requested&&name.includes("source-review")){requested=true;return schema.parse({approved:false,findings:[{evidenceStatus:"unsupported-by-supplied",requiredSourceIds:[ids[3]],invariant:"Boundary evidence is omitted",objectId:"boundary",owner:"content",targets:["/content/description"],evidence:"The boundary excerpt was not supplied to this group.",acceptance:"Receive the known boundary excerpt before judging the claim.",sourceIds:[ids[0]]}],equationAudits:[]});}return schema.parse({approved:true,findings:[],equationAudits:[]});}
   throw Error(`Unexpected fixture call ${name}`);
  };
  const result=await generateKit(paper,{target:"diagram",initial:{scene},research:{...abstractResearch(sources),sources:[sources[0]],catalogue:sources},dir,checkpointRoot:path.join(dir,"checkpoints"),runId:"contract",implementationDigest:"a".repeat(64),model,render:async()=>["private-fixture-view"],progress:async()=>{},status:async()=>{},publish:async()=>({revision:"fixture-approved"})});
  reviews.forEach(r=>check(r.prompt,r.name));
  assert.equal(result.outcomes[0]?.status,"passed");
  if(requestOmitted)assert.equal(result.outcomes[0].rounds,0,"Context correction must not spend a content repair");
 } finally {await rm(dir,{recursive:true,force:true});}
}

test("TriRoute opening review owns its narrow proof without inheriting the separate collapse lesson",async()=>{
 let scientific=0,visual=0;
 await diagramCase((prompt,name)=>{assert.ok(!prompt.includes(globalControl),`${name} inherited a global explanation requirement`);assert.ok(prompt.includes("Show independent attention, FFN, and cache choices."));name.includes("source-review")?scientific++:visual++;});
 assert.ok(scientific>0&&visual>0);
});
test("FlashAttention retained plan table and known baseline citations reach scientific and visual review",async()=>{
 let scientific=0,visual=0;
 await diagramCase((prompt,name)=>{assert.ok(prompt.includes(table),`${name} omitted the retained plan profiling table`);assert.ok(prompt.includes("The independent choices are shown in an illustrative comparison."),`${name} omitted a retained baseline citation`);name.includes("source-review")?scientific++:visual++;});
 assert.ok(scientific>0&&visual>0);
});
const glyph={id:"retain",glyph:"vector" as const,label:"Retain term",detail:"History weighted by the gate.",values:["(1-g)h"]};
const native=z.object({content:z.object({node:glyphSchema,unchanged:z.string()})});
const candidate={content:{node:glyph,unchanged:"Preserve gate limits and the other panel."}};
test("Mamba glyph correction uses the smallest native union owner instead of an immutable discriminator leaf",()=>{
 const catalog=targetCatalog(candidate,native);assert.ok(!catalog.some(t=>t.path==="/content/node/glyph"));
 const target=catalog.find(t=>t.path==="/content/node");assert.ok(target,"Native union owner was not catalogued");
 const scalar={id:glyph.id,glyph:"module",label:"(1-gₜ)hₜ₋₁",detail:glyph.detail};assert.equal(target.schema.safeParse(scalar).success,true);
 const after=applyPatch(candidate,native,[target],{base:fingerprint(candidate),preimages:{t0:target.fingerprint},changes:{t0:scalar}});assert.equal(after.content.unchanged,candidate.content.unchanged);
});
test("Mamba exact operand keeps native limits and can move to an owning scalar node without losing dependencies",()=>{
 const catalog=targetCatalog(candidate,native),leaf=catalog.find(t=>t.path==="/content/node/values/0")!;
 assert.equal(leaf.schema.safeParse("(1-gₜ)hₜ₋₁").success,false,"The eight-character native field must remain bounded");
 const owner=catalog.find(t=>t.path==="/content/node");assert.ok(owner,"An infeasible leaf correction needs its legal native owner");
 assert.equal(owner.schema.safeParse({id:glyph.id,glyph:"module",label:"(1-gₜ)hₜ₋₁",detail:glyph.detail}).success,true);
});

test("known omitted evidence refreshes before scientific deletion authority without spending a repair",async()=>{
 let suppliedScientific=0,suppliedVisual=0;
 await diagramCase((prompt,name)=>{const evidence=prompt.split("\nPRIMARY EVIDENCE:\n")[1];if(evidence.includes("Late exact evidence establishes"))name.includes("source-review")?suppliedScientific++:suppliedVisual++;},true);
 assert.ok(suppliedScientific>0&&suppliedVisual>0);
});
test("ownership retains every frozen global requirement and equation while binding narrow visuals",()=>{
 const plan={requirements:[globalControl,"State the benchmark evidence boundary."],equations:["Exact cost normalization."],example:"Illustrative route.",diagram:{proof:"Show the separate actions."},figures:[{id:"collapse",question:"How is collapse prevented?"}],sourceIds:["method"]};
 const owned=teachingOwnership(plan);assert.equal(owned.filter(r=>r.owner==="explanation").length,4);
 const explanation=componentTeachingContract(plan,"explanation"),diagram=componentTeachingContract(plan,"diagram"),figure=componentTeachingContract(plan,"figure:collapse"),quiz=componentTeachingContract(plan,"quiz");
 assert.equal(explanation.owned.length,4);assert.deepEqual(diagram.owned.map(r=>r.text),[plan.diagram.proof]);assert.deepEqual(figure.owned.map(r=>r.text),[plan.figures[0].question]);assert.equal(quiz.inheritedExplanation,true);assert.match(quiz.quizRule!,/distractor/);
 assert.notEqual(fingerprint(diagram),fingerprint(componentTeachingContract({...plan,requirements:[...plan.requirements,"Preserve source provenance."]},"diagram")),"Ownership changes must invalidate narrow review bindings too");
});
test("availability distinguishes unknown, known omitted and supplied without assuming scientific support",()=>{
 const a={id:"a",label:"A",url:"https://example.test/a",excerpt:"Exact evidence"},b={...a,id:"b"};
 assert.deepEqual(evidenceAvailability([a,b],[a],["missing","b","a"]),[{sourceId:"missing",state:"unknown"},{sourceId:"b",state:"known-omitted"},{sourceId:"a",state:"supplied"}]);
 const sources=Array.from({length:31},(_,i)=>({...a,id:`s${i}`}));assert.deepEqual(evidenceGroups(sources).map(g=>g.length),[14,14,3]);assert.deepEqual(evidenceGroups(sources).flat(),sources);
});
test("figure and panel kind unions stay reserved for the explicit representation fallback",()=>{
 const kind=z.discriminatedUnion("kind",[z.object({kind:z.literal("a"),text:z.string()}),z.object({kind:z.literal("b"),text:z.string()})]);
 const schema=z.object({content:kind,figures:z.array(kind),scene:z.object({illustration:z.object({panels:z.array(kind)})})});
 const value={content:{kind:"a",text:"Figure"},figures:[{kind:"a",text:"Legacy figure"}],scene:{illustration:{panels:[{kind:"a",text:"Panel"}]}}};
 const paths=targetCatalog(value,schema).map(t=>t.path);for(const path of ["/content","/figures/0","/scene/illustration/panels/0"])assert.ok(!paths.includes(path),`${path} bypassed bounded artifact replacement`);
});
test("infeasible exact operands promote before adjudication and remain in the canonical authority scope",()=>{
 const context={round:0,fingerprint:fingerprint(candidate),binding:"a".repeat(64),obligations:[],catalog:targetCatalog(candidate,native)};
 const finding={id:"operand",category:"scientific-operand",objectId:"retain",invariant:"exact-operands",owner:"content",targets:["/content/node/values/0"],sourceIds:["method"],evidence:"The displayed operand loses its source time index.",acceptance:"Preserve the exact indexed retained-history operand.",requiredValues:[{target:"/content/node/values/0",value:"(1-gₜ)hₜ₋₁"}]};
 const promoted=viableNativeFinding(finding,context);assert.deepEqual(promoted.targets,["/content/node"]);assert.match(promoted.acceptance,/hₜ₋₁/);assert.notEqual(defectScope(promoted as any),defectScope({...promoted,acceptance:finding.acceptance,evidence:finding.evidence} as any));
});
test("no native owner can hide a complete required value by widening bounds or dropping receipt scope",()=>{
 const context={round:0,fingerprint:fingerprint(candidate),binding:"a".repeat(64),obligations:[],catalog:targetCatalog(candidate,native)};
 const exact="h".repeat(100),finding={artifact:null as string|null,owner:"content",targets:["/content/node/values/0"],evidence:"The complete operand must remain visible.",acceptance:"Preserve the complete operand.",requiredValues:[{target:"/content/node/values/0",value:exact}]};
 const promoted=viableNativeFinding(finding,context);assert.equal(promoted.owner,"representation");assert.deepEqual(promoted.targets,[]);assert.equal(promoted.artifact,"/content");assert.ok(promoted.acceptance.includes(exact));assert.ok(promoted.evidence.includes(exact));
});
test("actual component repair schedules the legal native glyph owner before scientific authority and editing",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"component-native-"));
 try {
  const paper=initialState().papers[0],source={id:"method",label:"Method",url:"https://arxiv.org/html/2312.00752v1",excerpt:"The scalar recurrence is h_t=(1-g_t)h_{t-1}+g_t x_t. The exact retained-history operand is (1-gₜ)hₜ₋₁."};
  const sourceId=`method:${fingerprint([source.url,source.excerpt]).slice(0,16)}`,passage=sourcePassages([{...source,id:sourceId}])[0].id;
  paper.sources=[source];paper.recall={version:2,idea:"Selective recurrence.",problem:"Ignore noise.",mechanism:source.excerpt,evidence:"A sourced scalar special case.",limitation:"Not a benchmark.",significance:"Retain or replace history.",sourceIds:["method"]} as any;
  const input={title:"Exact retained history",description:"The gate weights the preceding scalar state before its update.",footnote:"The other gate-limit panel remains an independent requirement.",nodes:[],edges:[],illustration:{takeaway:"Preserve the indexed operand.",panels:[{kind:"schematic",title:"Retain history",caption:"Multiply the preceding scalar history by one minus its current gate.",illustrative:true,sourceIds:["method"],nodes:[glyph,{id:"output",glyph:"vector",label:"Updated state",detail:"Receives retained history.",values:["hₜ"]}],edges:[{from:"retain",to:"output",label:"retain",dashed:false}]}]}};
  const target="/content/illustration/panels/0/nodes/0",leaf=target+"/values/0",invariant="exact-retained-operand",objectId="retain",id=fingerprint([objectId,invariant]).slice(0,32);let edits=0;
  const model:Model=async(prompt,schema,name)=>{
   if(name==="kit-plan")return schema.parse({requirements:["Explain the scalar selective recurrence."],equations:["Source recurrence with exact time indices."],example:"A scalar special case.",diagram:{proof:"Show the exact retained-history operand.",objects:2,representation:"illustration"},figures:[{id:"limits",question:"What are the limiting gate cases?",kind:"illustration"}],sourceIds:[sourceId]});
   if(name==="plan-evidence"||name.endsWith("select-sources"))return schema.parse({sourceIds:[sourceId]});
   if(name.startsWith("plan-feasibility"))return schema.parse({feasible:true,blockers:[]});
   if(name.includes("source-review")){const current=JSON.parse(prompt.split("\nCOMPONENT:\n")[1].split("\nPRIMARY EVIDENCE:\n")[0]).candidate.content;return schema.parse({approved:current.illustration.panels[0].nodes[0].glyph==="module",equationAudits:[],findings:current.illustration.panels[0].nodes[0].glyph==="module"?[]:[{invariant,objectId,owner:"content",targets:[leaf],requiredValues:[{target:leaf,value:"(1-gₜ)hₜ₋₁"}],evidence:"The displayed operand loses its source time index.",acceptance:"Preserve the complete exact indexed operand.",sourceIds:[sourceId]}]});}
   if(name.includes("visual-review"))return schema.parse({approved:true,findings:[],equationAudits:[]});
   if(name.includes("-evidence-")){const wire=z.toJSONSchema(schema) as any;const finding=JSON.parse(prompt.split("\nFINDINGS:\n")[1].split("\nPLAN:\n")[0])[0];assert.deepEqual(finding.targets,[target]);assert.match(finding.acceptance,/hₜ₋₁/);return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,decisions:[{id,disposition:"supported-defect",requirement:"Preserve the exact indexed operand.",rationale:"The exact recurrence names the previous-state time index.",passageIds:[passage]}]});}
   if(name.includes("-verify-defects-")){const wire=z.toJSONSchema(schema) as any;return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,checks:[{id,resolved:true,resolution:"same-representation",evidence:"The scalar node now displays the exact operand."}]});}
   if(name.includes("-edit-")){edits++;const targets=JSON.parse(prompt.split("\nTARGETS:\n")[1].split("\nBASE: ")[0]);assert.deepEqual(targets.map((t:any)=>t.path),[target]);const base=prompt.split("\nBASE: ")[1].split("\nDEFECTS:")[0];return schema.parse({base,preimages:{t0:targets[0].preimage},changes:{t0:{id:glyph.id,glyph:"module",label:"(1-gₜ)hₜ₋₁",detail:glyph.detail}}});}
   if(name.includes("patch-audit"))return schema.parse({resolvedDefectIds:[id],noNewDefects:true,unrelatedUnchanged:true,dependenciesConsistent:true,passageIds:[passage],reason:"Only the scalar glyph owner changed; all other panel content and dependencies are preserved."});
   throw Error(`Unexpected native fixture call ${name}`);
  };
  const result=await generateKit(paper,{target:"diagram",initial:{scene:input},research:abstractResearch([source]),dir,checkpointRoot:path.join(dir,"checkpoints"),runId:"native",implementationDigest:"a".repeat(64),model,render:async()=>["private-native-view"],progress:async()=>{},status:async()=>{},publish:async()=>({revision:"native-approved"})});
  assert.equal(result.outcomes[0].status,"passed");assert.equal(edits,1);assert.equal(result.outcomes[0].rounds,1);assert.equal(result.paper.scene!.illustration!.panels[0].caption,input.illustration.panels[0].caption);
 }finally{await rm(dir,{recursive:true,force:true});}
});
