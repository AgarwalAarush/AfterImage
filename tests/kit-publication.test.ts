import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/lib/catalog";
import { publishKitComponent, markKitComponent, digest, type ComponentPublication } from "../src/lib/kit-publication";
import { paperKit, projectPublishedPaper, mergeSources } from "../src/lib/kit";
import { publicState } from "../src/lib/public-state";
import { assistantContext } from "../src/lib/assistant";
import { paperPreparationModel } from "../src/lib/generation-progress";
import type { Job, Paper } from "../src/lib/types";
const now = "2026-10-02T12:00:00.000Z";
function fixture() {
 const state = initialState(), paper = state.papers[0]; paper.visual = undefined; paper.scene = null; paper.recall = null; paper.study = undefined;
 const job: Job = { id: "run", paperId: paper.id, type: "generate", status: "running", attempts: 1, createdAt: now, leaseToken: "secret-lease", leaseUntil: "2026-10-02T13:00:00.000Z" }; state.jobs = [job];
 return { state, paper, job };
}
const explanation = { version: 2, idea: "A useful explanation.", problem: "The motivating problem.", mechanism: "A complete account of the method.", evidence: "An explicitly bounded result.", limitation: "A limitation remains.", significance: "Why this matters.", equations: [], sourceIds: ["abstract"] };
const quiz = [0,1].map(i => ({ id: `q${i}`, question: "Which statement matches the described method?", options: ["Correct", "Different", "Neither"].map(text => ({ text, explanation: "This option is explained using the paper's method." })), answer: 0, sourceId: "abstract" }));
const figure = { id: "example", kind: "bars", title: "Illustrative allocation", placement: "mechanism", provenance: "illustrative", caption: "An illustrative example comparing two allocations. These values are not reported measurements.", sourceId: "abstract", unit: "slots", series: [{ label: "A", value: 1, note: "" }, { label: "B", value: 2, note: "" }] };
function payload(paper: Paper, id: string, content: unknown, dependencies?: Record<string,string>): ComponentPublication {
 const sources = paper.sources.slice(0,1);
 return { id, completionId: digest([id,content,dependencies]), expectedRevision: paperKit(paper).components.find(c=>c.id===id)?.revision ?? null, dependencies: dependencies ?? (id==="explanation"?{}:{ explanation: paperKit(paper).components.find(c=>c.id==="explanation")!.revision! }), sources, scope: "full-text", content, review: { version:1, contentDigest:digest(content), sourcesDigest:digest(sources), implementationDigest:"a".repeat(64), gates:{source:true,math:true,teaching:true,geometry:true,visual:true,quiz:true} } };
}
function publish(paper:Paper,job:Job,id:string,content:unknown,deps?:Record<string,string>) { return publishKitComponent(paper,job,payload(paper,id,content,deps),"secret-lease",now); }
test("explanation and entire quiz publish while a diagram fails; public views exclude private state",()=>{
 const {state,paper,job}=fixture(); publish(paper,job,"explanation",explanation); markKitComponent(paper,"diagram","failed"); publish(paper,job,"quiz",quiz);
 assert.equal(paper.recall?.evidenceScope,"full-text");
 const projected=projectPublishedPaper(paper); assert.ok(projected.recall); assert.equal(projected.scene,null); assert.deepEqual(projected.study?.quiz,quiz); assert.deepEqual(projected.study?.figures,[]);
 const model=paperPreparationModel(paper,[{...job,status:"complete"}]); assert.equal(model.readable,true); assert.deepEqual(model.retryComponents?.map(c=>c.id),["diagram"]);
 for(const include of [true,false]) { const output=publicState(state,include); assert.equal(output.jobs[0].componentReceipts,undefined); assert.equal(output.jobs[0].leaseToken,undefined); assert.ok(output.papers[0].recall); assert.equal(output.papers[0].sources[0].excerpt.length>0,include); }
 const context=assistantContext(paper,[],{id:"q",paperId:paper.id,question:"why",selection:"",status:"queued",answer:"",createdAt:now,updatedAt:now}); assert.ok(context.notecard); assert.equal(context.openingDiagram,null);
});
test("unavailable dependencies cannot publish; stale dependent content is withheld",()=>{
 const {paper,job}=fixture(); const rev=publish(paper,job,"explanation",explanation).revision;
 assert.throws(()=>publish(paper,job,"quiz",quiz,{explanation:rev,diagram:"missing"}),/dependency/);
 publish(paper,job,"quiz",quiz); publish(paper,job,"explanation",{...explanation,idea:"A revised approved explanation."});
 assert.equal(projectPublishedPaper(paper).study,undefined); assert.deepEqual(paper.study?.quiz,quiz);
});
test("one figure replacement preserves approved prose, other figures, quiz and reading progress",()=>{
 const {state,paper,job}=fixture(); publish(paper,job,"explanation",explanation); publish(paper,job,"quiz",quiz); publish(paper,job,"figure:example",figure); publish(paper,job,"figure:other",{...figure,id:"other"});
 const before=structuredClone({ recall:paper.recall,quiz:paper.study!.quiz,other:paper.study!.figures[1],entries:state.entries });
 job.type="component"; job.componentId="figure:example"; job.componentReceipts=[];
 markKitComponent(paper,"figure:example","running"); assert.equal(projectPublishedPaper(paper).study!.figures[0].title,figure.title);
 markKitComponent(paper,"figure:example","failed"); assert.equal(projectPublishedPaper(paper).study!.figures[0].title,figure.title);
 publish(paper,job,"figure:example",{...figure,title:"Improved example"});
 assert.deepEqual({recall:paper.recall,quiz:paper.study!.quiz,other:paper.study!.figures.find(f=>f.id==="other"),entries:state.entries},before);
 assert.throws(()=>publish(paper,job,"quiz",quiz),/target/);
});
test("completion is idempotent, rejects altered duplicates and validates live leases and reviews before writes",()=>{
 const {paper,job}=fixture(), p=payload(paper,"explanation",explanation);
 const first=publishKitComponent(paper,job,p,"secret-lease",now), snapshot=JSON.stringify(paper);
 job.status="complete"; delete job.leaseToken;
 assert.deepEqual(publishKitComponent(paper,job,p,"secret-lease",now),{...first,duplicate:true}); assert.equal(JSON.stringify(paper),snapshot);
 assert.throws(()=>publishKitComponent(paper,job,{...p,scope:"abstract"},"secret-lease",now),/Conflicting/);
 assert.throws(()=>publishKitComponent(paper,job,{...p,completionId:"different"},"secret-lease",now),/lease/);
 const other=fixture(); assert.throws(()=>publishKitComponent(other.paper,other.job,{...p,review:{...p.review,contentDigest:"b".repeat(64)}},"secret-lease",now),/binding/); assert.equal(other.paper.recall,null);
 assert.throws(()=>publishKitComponent(other.paper,other.job,p,"old-lease",now),/lease/);
 assert.throws(()=>publishKitComponent(other.paper,other.job,p,"secret-lease","2026-10-02T14:00:00Z"),/lease/);
});
test("source registry retains more than fourteen immutable excerpts; legacy adapter does not rewrite content",()=>{
 const paper=initialState().papers[0],before=JSON.stringify(paper); assert.equal(projectPublishedPaper(paper),paper); assert.ok(paperKit(paper).components.length); assert.equal(JSON.stringify(paper),before);
 const sources=Array.from({length:30},(_,i)=>({...paper.sources[0],id:`source-${i}`})); assert.equal(mergeSources([],sources).length,30);
 assert.throws(()=>mergeSources(sources,[{...sources[0],excerpt:"changed"}]),/identity changed/);
});
test("legacy editorial diagrams obey manifest dependency visibility during replacement",()=>{
 const {paper,job}=fixture();paper.recall={...explanation,version:2,provenance:'editorial',evidenceScope:'abstract'};paper.visual='lora';
 const before=paperKit(paper);assert.ok(before.components.some(c=>c.id==='diagram'));
 markKitComponent(paper,'diagram','failed');assert.equal(projectPublishedPaper(paper).visual,'lora');
 publish(paper,job,'explanation',{...explanation,idea:'A replacement explanation.'});
 assert.equal(projectPublishedPaper(paper).visual,undefined);
});
