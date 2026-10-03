import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { generateKit } from "../worker/component-pipeline";
import { fingerprint, type LedgerEntry } from "../worker/repair-controller";
import { KitCheckpoints } from "../worker/kit-checkpoint";
import type { Model } from "../worker/repair-model";

const artifact = new URL("../.artifacts/evaluation-AI2Lwo/",import.meta.url);
const saved = existsSync(new URL("result.json",artifact));
const read = async (name: string, root = artifact) => JSON.parse(await readFile(new URL(name,root),"utf8"));

for(const variant of ["unsupported-review-demand","insufficient-evidence","unresolved-source-conflict","new-defect","unrelated-change","broken-dependency"] as const) test(`saved MegaBlocks worklist preserves supported progress (${variant})`,{skip:!saved},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"component-worklist-"));
 try {
  const paper=(await read("result.json")).paper,plan=await read("plan.json"),research=await read("research.json");
  const initial=(await read("explanation/candidate-0.json")).candidate;
  const old=(await read("explanation/review-2.json",new URL("../.artifacts/evaluation-uWp1wQ/",import.meta.url))).ledger as LedgerEntry[];
  const ledger=old.filter(d=>d.status!=="resolved");
  const selected=(await read("explanation-select-sources.json")).sourceIds;
  const sources=research.catalogue; // The saved resumed candidate retains all previously cited immutable excerpts.
  const implementationDigest="a".repeat(64),checkpointRoot=path.join(dir,"checkpoints");
  const store=new KitCheckpoints(checkpointRoot,paper.id);
  const planBinding=fingerprint(["library-components-v1",implementationDigest,research.catalogue,paper.id]);
  await store.write({version:1,componentId:"plan",binding:planBinding,candidate:plan});
  await store.write({version:1,componentId:"explanation",binding:fingerprint([planBinding,"explanation",{}]),candidate:initial,sources,repair:{candidate:initial,ledger,round:0,replanned:false,seen:[]}});
  const activation="b84049898dd88ab6f6e2ce85896ca265",citation="a939ade7168494c35453a4378d170477";
  const decisions=new Map([
   [activation,(await read("explanation-evidence-0-1274c102.json")).decisions[0]],
   [citation,(await read("explanation-evidence-0-aac97af6.json")).decisions[0]],
  ]);
  const rejection=["new-defect","unrelated-change","broken-dependency"].includes(variant);
  if(!rejection) decisions.get(activation).disposition=variant;
  const technical=await read("explanation-source-review-0-1dff5289.json");
  let edits=0,published=0;
  const model:Model=async(prompt,schema,name)=>{
   if(name==="explanation-select-sources")return schema.parse({sourceIds:selected});
   if(name.includes("source-review"))return schema.parse(technical);
   if(name.includes("relation-review")){
    const wire=z.toJSONSchema(schema) as any;
    const scopes=JSON.parse(prompt.split("\nRELATION SCOPES:\n")[1].split("\nCANDIDATE ATTRIBUTION SPANS:\n")[0]);
    const spans=JSON.parse(prompt.split("\nCANDIDATE ATTRIBUTION SPANS:\n")[1].split("\nCOMPONENT:\n")[0]);
    const evidence=JSON.parse(prompt.split("\nPRIMARY EVIDENCE:\n")[1]);
    // This fixture isolates the saved worklist/dispute decisions; other exact relation reviews pass independently.
    return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,sources:wire.properties.sources.const,scopes:wire.properties.scopes.const,
     relations:scopes.map((scope:any)=>({relationId:scope.id,origin:"author",attributionSpanIds:[spans.find((span:any)=>span.path===`/content/equations/${scope.index}/explanation`)!.id],attributionApplicable:true,passageIds:[evidence.passages[0].id],passed:true,failureKind:"none",reason:"The isolated fixture's independent relation check passes; the saved activation dispute remains a separate ledger obligation."}))});
   }
   if(name.includes("verify-defects")){
    const wire=z.toJSONSchema(schema) as any,candidate=wire.properties.candidate.const,binding=wire.properties.binding.const;
    const obligations=JSON.parse(prompt.split("\nOBLIGATIONS:\n")[1].split("\nCURRENT RESULT:\n")[0]) as LedgerEntry[];
    const current=JSON.parse(prompt.split("\nCURRENT RESULT:\n")[1].split("\nSOURCE DATA:\n")[0]);
    const corrected=current.content.walkthrough.steps[1].operation!==initial.content.walkthrough.steps[1].operation;
    return schema.parse({candidate,binding,checks:obligations.map(d=>{
      const adjudicated=d.adjudication?.candidate===candidate&&d.adjudication?.binding===binding;
      return{id:d.id,resolved:d.id===citation?corrected:adjudicated,resolution:d.id===activation&&adjudicated?"adjudication":"same-representation",evidence:"Checked the exact saved obligation against current candidate and source evidence."};
    })});
   }
   if(name.includes("-evidence-")){
    const wire=z.toJSONSchema(schema) as any;
    const findings=JSON.parse(prompt.split("\nFINDINGS:\n")[1].split("\nPLAN:\n")[0]);
    return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,decisions:findings.map((d:{id:string})=>decisions.get(d.id))});
   }
   if(name.includes("-edit-")){
    edits++;assert.equal(published,0);
    const targets=JSON.parse(prompt.split("\nTARGETS:\n")[1].split("\nBASE: ")[0]);
    assert.ok(targets.every((t:{path:string})=>!t.path.includes("equations")),"The unsupported activation demand must not authorize an edit");
    return schema.parse({base:fingerprint(initial),preimages:Object.fromEntries(targets.map((t:{key:string;preimage:string})=>[t.key,t.preimage])),changes:Object.fromEntries(targets.map((t:{key:string;path:string;value:unknown})=>[t.key,t.path.endsWith("/operation")?"Group each expert's assigned tokens before block rounding; no shared capacity is applied.":t.path.endsWith("/output")?"Retain E1=[t1,t2,t3], E2=[t4,t5], E3=[t6] before per-expert padding.":t.value]))});
   }
   if(name.includes("patch-audit"))return schema.parse({resolvedDefectIds:[citation],noNewDefects:variant!=="new-defect",unrelatedUnchanged:variant!=="unrelated-change",dependenciesConsistent:variant!=="broken-dependency",passageIds:decisions.get(citation).passageIds,reason:"The saved supported citation obligation is corrected without changing the disputed equation or unrelated fields."});
   throw Error(`Unexpected deterministic model call ${name}`);
  };
  const result=await generateKit(paper,{dir,checkpointRoot,runId:"worklist-regression",target:"explanation",implementationDigest,research,model,render:async()=>{throw Error("Explanation does not render images");},progress:async()=>{},status:async()=>{},publish:async()=>{published++;assert.equal(edits,1);return{revision:"b".repeat(64)};}});
  assert.ok(edits>0,"A supported unresolved ledger obligation must remain editable when no new finding is reported");
  if(variant==="unsupported-review-demand") {
   assert.equal(edits,1);assert.equal(published,1);assert.deepEqual(result.outcomes.map(o=>[o.id,o.status]),[["explanation","passed"]]);
   assert.deepEqual(result.paper.recall?.equations,initial.content.equations);
  } else {
   assert.equal(published,0,"An unresolved dispute or rejected patch cannot publish the explanation");
   assert.equal(result.outcomes[0].status,"failed");
   const checkpoint=await store.read("explanation",fingerprint([planBinding,"explanation",{}]));
   const retained=checkpoint!.candidate as typeof initial;
   if(rejection) assert.deepEqual(retained,initial,"A new defect, unrelated edit or broken dependency must retain the previous candidate");
   else {
    assert.equal(edits,1);assert.notEqual(retained.content.walkthrough.steps[1].operation,initial.content.walkthrough.steps[1].operation);
    assert.deepEqual(retained.content.equations,initial.content.equations,"Useful private citation progress cannot alter the disputed mathematics");
   }
  }

 } finally {await rm(dir,{recursive:true,force:true});}
});
