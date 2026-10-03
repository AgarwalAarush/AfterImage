import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { repairCandidate, fingerprint, defectScope, canonicalizeDefects, RepairFailure, type RepairDefect, type RepairContext } from "../worker/repair-controller";
import { validateScientificAuthority, reconcileEvidence, bindScientificAuthority, sourcePassages, evidenceDecisionDigest } from "../worker/evidence";
import { abstractResearch } from "../src/lib/research-bundle";
import { generationSchemas } from "../worker/generation-schema";

const source = { id: "method", label: "Method", url: "https://example.test/paper", excerpt: "The two operands have matching shapes." };
const candidate = { value: "incorrect" };
const binding = fingerprint("component, immutable parent revision and plan");
const context: RepairContext = { round: 0, fingerprint: fingerprint(candidate), binding, catalog: [], obligations: [] };
const base: RepairDefect = { id: "operand", category: "scientific-shape", owner: "content", targets: ["/value"], acceptance: "Both operand shapes match.", evidence: "A shape is omitted.", sourceIds: [source.id] };
// Receipt scopes bind the complete canonical obligation, independently of transient proof/status fields.
const scope = defectScope;
const receipt = (d: RepairDefect, ctx = context, requirement = d.acceptance) => ({ version:1 as const, candidate:ctx.fingerprint, binding:ctx.binding!, scope:scope(d), decision:evidenceDecisionDigest({id:d.id,disposition:"supported-defect",requirement,support:[{sourceId:source.id,passage:source.excerpt}]}), sources:fingerprint([source]), sourceIds:[source.id], support:[{sourceId:source.id,passage:source.excerpt}], requirement });

async function capture(defects: RepairDefect[], initial = candidate, schema: z.ZodType<any> = z.object({value:z.string()}), prepare?: (defects: RepairDefect[], ctx: RepairContext) => RepairDefect[]) {
 let captured: RepairDefect[] = [];
 await assert.rejects(repairCandidate(initial,{schema,maxRepairs:1,binding,record:async()=>{},validate:()=>{},review:async(_c,ctx)=>({defects:prepare ? prepare(structuredClone(defects),ctx) : structuredClone(defects),verified:[],complete:false}),edit:async(_c,_t,d)=>{captured=structuredClone(d);throw new RepairFailure("execution","Captured edit obligations");},replan:async()=>{throw Error("Unexpected replan");}}),/Captured edit obligations/);
 return captured;
}

test("duplicate proof and canonical scope do not depend on review order",async()=>{
 const second={...base,targets:["/value"],acceptance:"The vector dimensions also match.",evidence:"The other view omits a shape."};
 const combined={...base,acceptance:[base.acceptance,second.acceptance].sort().join("\n"),evidence:[base.evidence,second.evidence].sort().join("\n")};
 const first={...base,sourceProof:receipt(combined)};
 const forward=await capture([first,second]),reverse=await capture([second,first]);
 assert.ok(forward[0].sourceProof,"A valid proof attached to the first duplicate must survive");
 assert.deepEqual(forward,reverse);
});

const savedReview = new URL("../.artifacts/evaluation-uDdVMo/diagram/review-0.json",import.meta.url);
const savedCandidate = new URL("../.artifacts/evaluation-uDdVMo/diagram/candidate-0.json",import.meta.url);
test("saved QLoRA duplicate findings retain all three proofs before editing",{skip:!existsSync(savedReview)},async()=>{
 const review=JSON.parse(readFileSync(savedReview,"utf8")).review;
 const initial=JSON.parse(readFileSync(savedCandidate,"utf8")).candidate;
 const ids=[...new Set(review.defects.flatMap((d:RepairDefect)=>d.sourceIds))] as string[];
 const research=JSON.parse(readFileSync(new URL("../.artifacts/evaluation-uDdVMo/research.json",import.meta.url),"utf8"));
 const selected=JSON.parse(readFileSync(new URL("../.artifacts/evaluation-uDdVMo/diagram-select-sources.json",import.meta.url),"utf8")).sourceIds;
 const sources=research.catalogue.filter((s:{id:string})=>selected.includes(s.id));
 // Controlled replay reconstructs a current receipt from saved exact support; runtime never accepts the historical unbound proof.
 const rebind=(raw:RepairDefect[],ctx:RepairContext)=>{
   const canonical=canonicalizeDefects(raw,{discardProofs:true});
   return raw.map(d=>d.sourceProof ? {...d,sourceProof:{...d.sourceProof,version:1 as const,candidate:ctx.fingerprint,binding:ctx.binding!,decision:evidenceDecisionDigest({id:d.id,disposition:"supported-defect",requirement:d.sourceProof.requirement,support:d.sourceProof.support}),sources:fingerprint(sources),sourceIds:sources.map((s:{id:string})=>s.id),scope:defectScope(canonical.find(c=>c.id===d.id)!)}} : d);
 };
 const actual=await capture(review.defects,initial,z.object({content:generationSchemas(ids).scene}),rebind);
 assert.equal(actual.length,3);assert.ok(actual.every(d=>d.sourceProof),"All three adjudicated obligations must retain sourceProof");
 const reversed=await capture([...review.defects].reverse(),initial,z.object({content:generationSchemas(ids).scene}),rebind);
 assert.deepEqual(actual,reversed);
 const ctx={...context,fingerprint:fingerprint(initial),binding:fingerprint({candidate:fingerprint(initial),inputs:binding})};
 validateScientificAuthority(actual,sources,ctx);
 assert.throws(()=>validateScientificAuthority(review.defects,sources,ctx),/current source authority/);
});

test("authority rejects a different candidate, input binding or canonical obligation scope",()=>{
 const supported={...base,sourceProof:receipt(base)};
 validateScientificAuthority([supported],[source],context);
 for(const changed of [{...context,fingerprint:fingerprint("different candidate")},{...context,binding:fingerprint("other component") }]) assert.throws(()=>validateScientificAuthority([supported],[source],changed),/current source authority|bound|stale/i);
 for(const changed of [{...supported,acceptance:"Also require a different operation."},{...supported,targets:["/dependency"]},{...supported,artifact:"/scene"},{...supported,dependencies:["/parent/provenance"]}]) assert.throws(()=>validateScientificAuthority([changed],[source],context),/current source authority|bound|scope|stale/i);
});

test("conflicting duplicate proof requirements are rejected instead of last-wins",async()=>{
 const a={...base,sourceProof:receipt(base)},b={...base,sourceProof:receipt(base,context,"An incompatible requirement.")};
 await assert.rejects(capture([a,b]),/Conflicting.*proof|Conflicting.*authority/i);
 await assert.rejects(capture([b,a]),/Conflicting.*proof|Conflicting.*authority/i);
});


test("an issued receipt cannot authorize changed support or a changed decision requirement",async()=>{
 const bundle=abstractResearch([source]);
 const [decision]=await reconcileEvidence(async(_prompt,schema)=>schema.parse({candidate:context.fingerprint,binding:context.binding,decisions:[{id:base.id,disposition:"supported-defect",rationale:"Source establishes matching shapes.",requirement:base.acceptance,passageIds:[sourcePassages([source])[0].id]}]}),[base],candidate,context,bundle,"Synthetic shapes",{});
 const supported=bindScientificAuthority(base,decision,context,[source]);
 for(const changed of [{...decision,requirement:"Add an unrelated operation."},{...decision,support:[{sourceId:source.id,passage:"two operands have matching shapes."}]}]) assert.throws(()=>bindScientificAuthority(base,changed,context,[source]),/decision|receipt|authority/i);
 for(const changed of [{...supported,sourceProof:{...supported.sourceProof!,requirement:"Add an unrelated operation."}},{...supported,sourceProof:{...supported.sourceProof!,support:[{sourceId:source.id,passage:"two operands have matching shapes."}]}}]) assert.throws(()=>validateScientificAuthority([changed],[source],context),/decision|receipt|authority/i);
});
