import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import {readFileSync} from "node:fs";
import path from "node:path";
import {z} from "zod";
import {generateKit} from "../worker/component-pipeline";
import {abstractResearch} from "../src/lib/research-bundle";
import {costProbeSchemaFor,costProbeSources,assessCostProbe,costProbeBinding} from "../scripts/evaluate-triroute-cost";
import type {Model} from "../worker/repair-model";

const saved=JSON.parse(readFileSync(".artifacts/evaluation-iFSUIM/result.json","utf8")).paper;
const historical=JSON.parse(readFileSync(".artifacts/library-evaluations/2026-10-02T21-13-12.111Z/null-cost-acceptance.json","utf8"));
test("saved probe wrapper formatting is removed from exact candidate evidence selection without granting scientific acceptance",()=>{
 const sources=costProbeSources(saved),verdict=historical.verdict;
 const result=assessCostProbe(saved,sources,verdict);
 assert.equal(result.exactCandidatePassage,true,"Quote wrapper must not make an exact candidate receipt unavailable");assert.equal(result.passed,false,"The true attribution failure must remain rejected");
});
test("probe citations are constrained by the schema to actual supplied evidence",()=>{
 const sources=saved.sources.filter((s:any)=>/gates\[|null is free|expected_cost|active experts/.test(s.excerpt)),omitted=historical.verdict.sourceIds.find((id:string)=>!sources.some((s:any)=>s.id===id));assert.ok(omitted);
 const spans=candidateSpanSelection(saved.recall);const {candidatePassage,...received}=historical.verdict;assert.equal(costProbeSchemaFor(sources,saved.recall).safeParse({...received,version:2,binding:costProbeBinding(sources,saved.recall),candidate:fingerprint(saved.recall),sources:fingerprint(sources),candidateSpanIds:[spans.spans[0].id],sourceIds:[omitted]}).success,false,"Candidate metadata cannot authorize omitted probe evidence");
});
test("saved mixed TriRoute cost equation cannot pass the component gate on a whole-equation Boolean audit",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"relation-saved-"));try{
 const paper=structuredClone(saved);paper.kit=undefined;for(const key of ["provenance","evidenceScope","generatedAt"])delete paper.recall[key];
 const sources=paper.sources.filter((s:any)=>s.id.includes(":")),model:Model=async(prompt,schema,name)=>{
  if(name==="kit-plan")return schema.parse({requirements:["Explain the separate resource cost constraints."],equations:["Source and implementation cost conventions."],example:"A sourced routing example.",diagram:{proof:"Show the three independent choices.",objects:3,representation:"flow"},figures:[{id:"cost",question:"How do the resource constraints change cost?",kind:"bars"}],sourceIds:sources.map((s:any)=>s.id)});
  if(name==="plan-evidence"||name.endsWith("select-sources"))return schema.parse({sourceIds:sources.map((s:any)=>s.id)});
  if(name.startsWith("plan-feasibility"))return schema.parse({feasible:true,blockers:[]});
  if(name.includes("source-review")){const data=JSON.parse(prompt.split("\nCOMPONENT:\n")[1].split("\nPRIMARY EVIDENCE:\n")[0]);return schema.parse({approved:true,findings:[],equationAudits:data.equations.map((e:any)=>({index:e.index,fingerprint:e.fingerprint,passed:true,passageIds:[sourcePassages(sources)[0].id]}))});}
  if(name.includes("relation-review")){
   const wire=z.toJSONSchema(schema) as any,scopes=JSON.parse(prompt.split("\nRELATION SCOPES:\n")[1].split("\nCANDIDATE ATTRIBUTION SPANS:\n")[0]);
   return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,sources:wire.properties.sources.const,scopes:wire.properties.scopes.const,relations:scopes.map((scope:any)=>{const failure=scope.index===2&&scope.text.includes("setminus");return{relationId:scope.id,origin:failure?"implementation":"author",attributionSpanIds:[],attributionApplicable:!failure,passageIds:[sourcePassages(sources).find(p=>p.passage.includes("gates[..., 1:]"))!.id],passed:!failure,failureKind:failure?"attribution":"none",reason:failure?historical.verdict.reason:"Independent source review verifies the literal relation."};})});
  }
  if(name.includes("-evidence-")){const wire=z.toJSONSchema(schema) as any,findings=JSON.parse(prompt.split("\nFINDINGS:\n")[1].split("\nPLAN:\n")[0]);return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,decisions:findings.map((finding:any)=>({id:finding.id,disposition:"supported-defect",requirement:finding.acceptance,rationale:"The precise source/implementation distinction requires its own FFN-term attribution.",passageIds:[sourcePassages(sources).find(p=>p.passage.includes("gates[..., 1:]"))!.id]}))});}
  if(name.includes("verify-defects")){const wire=z.toJSONSchema(schema) as any,obligations=JSON.parse(prompt.split("\nOBLIGATIONS:\n")[1].split("\nCURRENT RESULT:\n")[0]);return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,checks:obligations.map((finding:any)=>({id:finding.id,resolved:false,resolution:"same-representation",evidence:"The saved attribution remains unchanged and wrong."}))});}
  if(name.includes("-edit-"))throw new RepairFailure("content","The saved rejected candidate is deliberately retained for this regression.");
  throw Error(`Unexpected saved fixture call ${name}`);
 };
 const result=await generateKit(paper,{target:"explanation",initial:{recall:paper.recall},research:{...abstractResearch(sources),sources,catalogue:sources,scope:"full-text"},dir,checkpointRoot:path.join(dir,"checkpoints"),runId:"relation",implementationDigest:"a".repeat(64),model,render:async()=>[],progress:async()=>{},status:async()=>{},publish:async()=>({revision:"saved-approved"})});
 assert.equal(result.outcomes[0].status,"failed","A composite equation cannot borrow source and implementation attribution under one passed flag");assert.equal(result.outcomes[0].owner,"content");const failure=JSON.parse(readFileSync(path.join(dir,"explanation","failure.json"),"utf8"));assert.ok(failure.ledger.some((d:any)=>d.invariant==="relation-provenance"&&d.evidence.includes("gates[...,1:]")));
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {candidateTextSpans,candidateSpanSelection,locateHistoricalCandidateQuote} from "../worker/exact-spans";
import {equationRelationScopes,relationReviewContract,validateRelationReceipts} from "../worker/equation-provenance";
import {fingerprint,RepairFailure} from "../worker/repair-controller";
import {sourcePassages} from "../worker/evidence";
const source={id:"received",label:"Received source",url:saved.sources[1].url,excerpt:"Author a=x. Derived b=2a. The implementation executes c=b."};
const candidate={content:{equations:[{latex:"a=x",explanation:"The source author defines a as x.",sourceId:source.id},{latex:"b=2a",explanation:"This derived relation doubles the source author value a.",sourceId:source.id},{latex:"c=b",explanation:"The reference implementation assigns c the value of b.",sourceId:source.id}]}},binding="b".repeat(64);
function validReview(value=candidate,inputs=binding,sources=[source]) {
 const contract=relationReviewContract(value,value.content.equations,"/content/equations",inputs,sources);
 const raw={candidate:fingerprint(value),binding:inputs,sources:fingerprint(sources),scopes:fingerprint(contract.scopes),relations:contract.scopes.map(s=>({relationId:s.id,origin:["author","derived","implementation"][s.index],attributionSpanIds:[contract.spans.find(t=>t.path===`/content/equations/${s.index}/explanation`)!.id],attributionApplicable:true,passageIds:[sourcePassages(sources)[0].id],passed:true,failureKind:"none",reason:"Independent source and applicability review verifies this exact relation."}))};
 return {contract,raw};
}
test("scientific span registry excludes identity and citation metadata while preserving exact UTF-8 field bytes",()=>{
 const value={id:"identity",sourceId:"citation",sourceIds:["citation-array"],mechanism:"αₜ = βₜ. Exact spacing stays.",version:2};
 const selection=candidateSpanSelection(value);assert.ok(selection.spans.every(s=>s.path==="/mechanism"));
 const span=selection.spans[0];assert.equal(Buffer.from(value.mechanism).subarray(span.startByte,span.endByte).toString(),span.text);assert.equal(selection.resolve([span.id])[0].text,"αₜ = βₜ.");
 assert.throws(()=>candidateSpanSelection({...value,mechanism:"αₜ  = βₜ. Exact spacing stays."},selection.spans).resolve([span.id]),/Stale or altered/);
 const long={mechanism:"a".repeat(1799)+"😀"+"b".repeat(10)};const chunks=candidateSpanSelection(long);assert.equal(chunks.resolve(chunks.spans.map(s=>s.id)).map(s=>s.text).join(""),long.mechanism);
});
test("historical quote matching performs no whitespace normalization and grants no new scientific receipt",()=>{
 assert.ok(locateHistoricalCandidateQuote(saved.recall,historical.verdict.candidatePassage));assert.equal(locateHistoricalCandidateQuote({text:"x = y"},"x  = y"),undefined);assert.equal(locateHistoricalCandidateQuote({sourceId:"metadata"},"metadata"),undefined);
 assert.equal(assessCostProbe(saved,costProbeSources(saved),{...historical.verdict,attributionCorrect:true}).passed,false);
});
test("exact probe selection fixes wrappers and rejects supplied-context citation drift while numbers alone remain insufficient",()=>{
 const sources=costProbeSources(saved),selection=candidateSpanSelection(saved.recall),span=selection.spans.find(s=>s.text.includes("selected null expert 0 contributes zero cost"))!;
 const verdict={version:2,binding:costProbeBinding(sources,saved.recall),candidate:fingerprint(saved.recall),sources:fingerprint(sources),candidateSpanIds:[span.id],explanationSupportsCalculation:true,sourceIds:[sources[0].id],nullOnly:0,realOnly:120,mixed:72,denominatorIncludesSelectedNull:true,attributionCorrect:false,reason:historical.verdict.reason};
 const result=assessCostProbe(saved,sources,verdict);assert.equal(result.exactCandidatePassage,true);assert.equal(result.passed,false);assert.ok(result.candidateSpans[0].path.includes("/equations/2/explanation"));
 assert.throws(()=>assessCostProbe(saved,sources,{...verdict,sourceIds:["unsupplied"]}));assert.throws(()=>assessCostProbe(saved,sources,{...verdict,candidate:"c".repeat(64)}));assert.throws(()=>assessCostProbe(saved,[...sources].reverse(),verdict));
});
test("saved TriRoute composite cost relation binds attention and null-excluding expert terms separately",()=>{
 const value={content:{equations:saved.recall.equations}},scopes=equationRelationScopes(value,value.content.equations,"/content/equations"),ffn=scopes.find(s=>s.index===2&&s.text.includes("setminus"))!,attention=scopes.find(s=>s.index===2&&s.text.includes("2d_h"))!;
 assert.ok(ffn&&attention);assert.notEqual(ffn.id,attention.id);assert.equal(ffn.parent,attention.parent);assert.ok(ffn.text.includes("\\kappa^e"));assert.ok(scopes.length>5);
});
test("full private provenance coverage binds each origin to its exact candidate and source scope",()=>{
 const {contract,raw}=validReview(),{receipts}=contract.validate(raw);assert.deepEqual(receipts.map(r=>r.origin),["author","derived","implementation"]);assert.equal(validateRelationReceipts(receipts,candidate,candidate.content.equations,"/content/equations",binding,[source]).receipts.length,3);
});
test("relation provenance rejects omission, duplication and cross-equation attribution",()=>{
 const {contract,raw}=validReview();assert.throws(()=>contract.validate({...raw,relations:raw.relations.slice(1)}));assert.throws(()=>contract.validate({...raw,relations:[raw.relations[0],raw.relations[0],raw.relations[2]]}),/duplicate/);
 const borrowed=structuredClone(raw);borrowed.relations[2].attributionSpanIds=borrowed.relations[0].attributionSpanIds;assert.throws(()=>contract.validate(borrowed),/borrowed/);
});
test("another term's implementation sentence cannot certify an independently rejected attribution judgment",()=>{
 const value={content:{equations:[saved.recall.equations[2]]}},sources=costProbeSources(saved),contract=relationReviewContract(value,value.content.equations,"/content/equations",binding,sources),span=contract.spans.find(s=>s.text.includes("head-width convention"))!;
 const raw={candidate:fingerprint(value),binding,sources:fingerprint(sources),scopes:fingerprint(contract.scopes),relations:contract.scopes.map(s=>({relationId:s.id,origin:"author",attributionSpanIds:[],attributionApplicable:true,passageIds:[sourcePassages(sources)[0].id],passed:true,failureKind:"none",reason:"Literal author relation."}))};
 const ffn=raw.relations.find(r=>contract.scopes.find(s=>s.id===r.relationId)!.text.includes("setminus"))!;ffn.origin="implementation";ffn.attributionSpanIds=[span.id] as never[];ffn.attributionApplicable=false;assert.throws(()=>contract.validate(raw),/applicable candidate attribution/);
 ffn.passed=false;(ffn as any).failureKind="attribution";assert.equal(contract.validate(raw).receipts.find(r=>r.relationId===ffn.relationId)!.passed,false,"A structurally exact receipt does not overturn independent source rejection");
});
test("implementation and derived passes require their own explicit candidate disclosure",()=>{
 const {contract,raw}=validReview();const missing=structuredClone(raw);missing.relations[2].attributionSpanIds=[];assert.throws(()=>contract.validate(missing),/explicit candidate attribution/);missing.relations[2]=raw.relations[2];missing.relations[1].attributionSpanIds=[];assert.throws(()=>contract.validate(missing),/explicit candidate disclosure/);
});
for(const change of ["candidate","input","source","equation","relation"] as const)test(`private relation receipts reject stale ${change} bindings`,()=>{
 const {contract,raw}=validReview(),receipts=contract.validate(raw).receipts;let value=structuredClone(candidate),sources=[structuredClone(source)],inputs=binding;
 if(change==="candidate")value.content.equations[0].explanation+=" Changed.";if(change==="input")inputs="c".repeat(64);if(change==="source")sources[0].excerpt+=" Changed.";if(change==="equation")value.content.equations[0].latex="a=y";if(change==="relation")receipts[0].scope.text="another relation";
 assert.throws(()=>validateRelationReceipts(receipts,value,value.content.equations,"/content/equations",inputs,sources));
});
test("altered support bytes and unreceived passage IDs cannot authorize relation provenance",()=>{
 const {contract,raw}=validReview(),receipts=contract.validate(raw).receipts;receipts[0].support[0].passage="invented evidence";assert.throws(()=>validateRelationReceipts(receipts,candidate,candidate.content.equations,"/content/equations",binding,[source]),/Altered/);assert.throws(()=>contract.validate({...raw,relations:raw.relations.map(r=>({...r,passageIds:["unreceived"]}))}));
});

for(const complete of [true,false])test(`full component pipeline requires independent scoped receipts and legacy whole-equation audits (complete: ${complete})`,async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"relation-positive-"));try{
  const paper=structuredClone(saved);paper.kit=undefined;paper.study=undefined;paper.scene=null;paper.sources=[source];
  const sourceId=`${source.id}:${fingerprint([source.url,source.excerpt]).slice(0,16)}`,received={...source,id:sourceId};
  paper.recall={version:2,idea:"Three related computations.",problem:"Distinguish equations from implementation.",mechanism:"The source defines a, a derived relation doubles it, and the implementation assigns c.",evidence:"Each relation has its own source support.",limitation:"No experimental claim.",significance:"Preserve explicit origins.",sourceIds:[sourceId],equations:candidate.content.equations.map(e=>({...e,title:"A precisely attributed relation",sourceId}))};
  let publications=0,relationReviews=0;
  const model:Model=async(prompt,schema,name)=>{
   if(name==="kit-plan")return schema.parse({requirements:["Explain author, derived and implementation relations."],equations:["Distinguish each relation and its source."],example:"No reported measurements.",diagram:{proof:"Show the three related quantities.",objects:3,representation:"flow"},figures:[{id:"relations",question:"Which origin supports each relation?",kind:"bars"}],sourceIds:[sourceId]});
   if(name==="plan-evidence"||name.endsWith("select-sources"))return schema.parse({sourceIds:[sourceId]});
   if(name.startsWith("plan-feasibility"))return schema.parse({feasible:true,blockers:[]});
   if(name.includes("source-review")){const data=JSON.parse(prompt.split("\nCOMPONENT:\n")[1].split("\nPRIMARY EVIDENCE:\n")[0]);return schema.parse({approved:true,findings:[],equationAudits:complete?data.equations.map((e:any)=>({index:e.index,fingerprint:e.fingerprint,passed:true,passageIds:[sourcePassages([received])[0].id]})):[]});}
   if(name.includes("relation-review")){
    relationReviews++;const wire=z.toJSONSchema(schema) as any,scopes=JSON.parse(prompt.split("\nRELATION SCOPES:\n")[1].split("\nCANDIDATE ATTRIBUTION SPANS:\n")[0]),spans=JSON.parse(prompt.split("\nCANDIDATE ATTRIBUTION SPANS:\n")[1].split("\nCOMPONENT:\n")[0]);
    return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,sources:wire.properties.sources.const,scopes:wire.properties.scopes.const,relations:scopes.map((scope:any)=>({relationId:scope.id,origin:["author","derived","implementation"][scope.index],attributionSpanIds:[spans.find((s:any)=>s.path===`/content/equations/${scope.index}/explanation`)!.id],attributionApplicable:true,passageIds:[sourcePassages([received])[0].id],passed:true,failureKind:"none",reason:"Independent source review verifies this exact origin and its own applicable disclosure."}))});
   }
   throw Error(`Unexpected positive fixture call ${name}`);
  };
  let result;try{result=await generateKit(paper,{target:"explanation",initial:{recall:paper.recall},research:{...abstractResearch([source]),sources:[source],catalogue:[source]},dir,checkpointRoot:path.join(dir,"checkpoints"),runId:"positive",implementationDigest:"a".repeat(64),model,render:async()=>[],progress:async()=>{},status:async()=>{},publish:async publication=>{publications++;assert.equal(publication.review.gates.source,true);assert.ok(!JSON.stringify(publication.content).includes("relationAudits"));return{revision:"positive-approved"};}});}catch(error){if(complete)throw error;result=(error as any).result;assert.ok(result?.failure,"Incomplete whole-equation review must retain a terminal rejection");}
  assert.equal(result.outcomes[0].status,complete?"passed":"failed");assert.equal(publications,complete?1:0);assert.equal(relationReviews,complete?1:0);
  if(complete){const review=JSON.parse(readFileSync(path.join(dir,"explanation","reviews-0.json"),"utf8"));assert.deepEqual(review.technical.relationAudits.map((r:any)=>r.origin),["author","derived","implementation"]);assert.equal(review.technical.equationAudits.length,3);}
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {relationProvenanceFailures} from "../worker/equation-provenance";
import {targetCatalog,applyPatch} from "../worker/repair-controller";
import {generationSchemas} from "../worker/generation-schema";
test("scientific relation rejection has legal latex and dependent explanation targets while attribution-only repair stays narrow",()=>{
 const wrong=structuredClone(candidate);wrong.content.equations[0].latex="a=y";
 const {contract,raw}=validReview(wrong);raw.relations[0].passed=false;raw.relations[0].failureKind="source-fidelity";raw.relations[0].reason="The supplied author relation defines a=x; the candidate incorrectly says a=y.";
 const failures=relationProvenanceFailures(contract.validate(raw).receipts);assert.deepEqual(failures[0].targets,["/content/equations/0/latex","/content/equations/0/explanation"]);assert.ok(failures[0].evidence.includes("a=y"));assert.match(failures[0].acceptance,/unaffected mathematical term/);
 const native=z.object({content:z.object({equations:z.array(generationSchemas([source.id]).recall.shape.equations.element)})}),targets=targetCatalog(wrong,native).filter(t=>failures[0].targets.includes(t.path));assert.equal(targets.length,2);
 const changes=Object.fromEntries(targets.map((target,i)=>[`t${i}`,target.path.endsWith("/latex")?"a=x":"The source author defines a as x."])),preimages=Object.fromEntries(targets.map((target,i)=>[`t${i}`,target.fingerprint]));
 const repaired=applyPatch(wrong,native,targets,{base:fingerprint(wrong),preimages,changes});assert.equal(repaired.content.equations[0].latex,"a=x");assert.deepEqual(repaired.content.equations.slice(1),wrong.content.equations.slice(1));
 const attribution=validReview();attribution.raw.relations[2].passed=false;attribution.raw.relations[2].failureKind="attribution";attribution.raw.relations[2].attributionApplicable=false;assert.deepEqual(relationProvenanceFailures(attribution.contract.validate(attribution.raw).receipts)[0].targets,["/content/equations/2/explanation"]);
 assert.throws(()=>contract.validate({...raw,relations:raw.relations.map(r=>({...r,failureKind:"none"}))}),/verdict and rejection scope/);
});
