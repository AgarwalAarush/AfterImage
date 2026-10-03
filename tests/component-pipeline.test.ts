import { z } from "zod";
import { sourcePassages } from "../worker/evidence";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateKit } from "../worker/component-pipeline";
import { fingerprint, RepairFailure } from "../worker/repair-controller";
import { publishKitComponent, markKitComponent } from "../src/lib/kit-publication";
import { initialState } from "../src/lib/catalog";
import { abstractResearch } from "../src/lib/research-bundle";
import { projectPublishedPaper } from "../src/lib/kit";
import type { Job } from "../src/lib/types";
import type { Model } from "../worker/repair-model";

for (const overlong of [false, true]) test(`pipeline publishes explanation and quiz with independent diagram rejection (text repair: ${overlong})`,async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"kit-pipeline-"));
 try {
 const paper=initialState().papers[0];paper.recall=null;paper.scene=null;paper.visual=undefined;
 const source={...paper.sources[0],excerpt:"The paper describes sparse routing. The method selects a route for each token."};paper.sources=[source];
 const sourceId=`${source.id}:${fingerprint([source.url,source.excerpt]).slice(0,16)}`;
 const oldSource={...source,id:"old-context",excerpt:"An earlier, unselected context excerpt."};
 const oldSourceId=`${oldSource.id}:${fingerprint([oldSource.url,oldSource.excerpt]).slice(0,16)}`;
 const explanation={version:2,idea:"Tokens choose routes.",problem:"Dense routing is costly.",mechanism:"Select a route for each token.",evidence:"Sparse routing is described.",limitation:"Evidence is limited to the abstract.",significance:"This controls computation.",equations:[],sourceIds:[sourceId]};
 const quiz=[0,1].map(i=>({id:`q${i}`,question:"How does the method select a route?",options:["Per token","Per epoch","Never"].map(text=>({text,explanation:"This answer follows the stated routing rule for tokens."})),answer:0,sourceId}));
 const job:Job={id:"run",type:"generate",paperId:paper.id,status:"running",attempts:1,createdAt:new Date().toISOString(),leaseToken:"test",leaseUntil:new Date(Date.now()+3600000).toISOString()};
 const longMechanism="Select a route for each token. ".repeat(130);
 let shortened=false;
 const model:Model=async(_,schema,name)=>{
  if(name==="kit-plan")return schema.parse({requirements:["Explain how a token chooses a route."],equations:[],example:"No invented numerical results.",diagram:{proof:"Trace the token routing choice.",objects:3,representation:"flow"},figures:[{id:"trace",question:"How does a token reach its destination?",kind:"bars"}],sourceIds:[oldSourceId]});
  if(name==="plan-evidence"||name.endsWith("select-sources"))return schema.parse({sourceIds:[sourceId]});
  if(name.startsWith("plan-feasibility-")){assert.ok(!_.includes(oldSourceId),"Selected plan evidence must replace stale context citations");return schema.parse({feasible:true,blockers:[]});}
  if(name==="diagram-draft"||name==="figure-trace-draft")throw new RepairFailure("representation","Fixture rejects this visual independently");
  if(name==="explanation-draft")return (overlong ? {content:{...explanation,mechanism:longMechanism}} : schema.parse({content:explanation})) as any;
  if(name==="explanation-edit-0") { shortened=true; return schema.parse({base:fingerprint({content:{...explanation,mechanism:longMechanism}}),preimages:{t0:fingerprint(longMechanism)},changes:{t0:explanation.mechanism}}); }
  if(name==="explanation-patch-audit-0")return schema.parse({resolvedDefectIds:[fingerprint(["/content/mechanism","native-text-length"]).slice(0,32)],noNewDefects:true,unrelatedUnchanged:true,dependenciesConsistent:true,passageIds:[sourcePassages([{...source,id:sourceId}])[0].id],reason:"The supported routing claim is preserved completely."});
  if(name.startsWith("explanation-verify-defects-")) { const wire=z.toJSONSchema(schema) as any; return schema.parse({candidate:wire.properties.candidate.const,binding:wire.properties.binding.const,checks:[{id:fingerprint(["/content/mechanism","native-text-length"]).slice(0,32),resolved:true,resolution:"same-representation",evidence:"The complete supported routing sentence fits its native maximum."}]}); }
  if(name.startsWith("explanation-source-review-")&&overlong&&!shortened)return schema.parse({approved:false,equationAudits:[],findings:[{invariant:"native-text-length",objectId:"/content/mechanism",owner:"content",targets:["/content/mechanism"],evidence:"Too long for the field.",acceptance:"Shorten this complete claim.",sourceIds:[sourceId]}]});
  if(name==="quiz-draft")return schema.parse({content:quiz});
  if(name.includes("source-review"))return schema.parse({approved:true,findings:[],equationAudits:[]});
  throw Error(`Unexpected model call ${name}`);
 };
 const result=await generateKit(paper,{dir,checkpointRoot:path.join(dir,"checkpoints"),runId:job.id,implementationDigest:"a".repeat(64),research:{...abstractResearch([source]),sources:[source,oldSource],catalogue:[source,oldSource]},model,render:async()=>[],progress:async()=>{},status:async(id,state)=>{markKitComponent(paper,id,state);},publish:async p=>publishKitComponent(paper,job,p,"test",new Date().toISOString())});
 assert.deepEqual(result.outcomes.map(o=>[o.id,o.status]),[["explanation","passed"],["diagram","failed"],["figure:trace","failed"],["quiz","passed"]]);
 const visible=projectPublishedPaper(paper);assert.deepEqual(visible.study?.quiz,quiz);assert.ok(visible.recall);assert.equal(visible.scene,null);
 const report=JSON.parse(await readFile(path.join(dir,"kit-quality-report.json"),"utf8"));assert.deepEqual(report.budgets,{opening:overlong?3:4,supplement:2});assert.ok(report.calls>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
