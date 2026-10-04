import test, {before, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {initialState} from "../src/lib/catalog";
import {ensurePreferences, recordChoice} from "../src/lib/preferences";
import {queueInterestDiscovery} from "../src/lib/interest-suggestions";
import {publicState} from "../src/lib/public-state";
import {paperPreparationModel} from "../src/lib/generation-progress";
import type {AppState, Job} from "../src/lib/types";
let dir: string;
let store: typeof import("../src/lib/store");
let route: typeof import("../src/app/api/worker/route");
const previous = {NODE_ENV:process.env.NODE_ENV,AFTERIMAGE_STORAGE:process.env.AFTERIMAGE_STORAGE,AFTERIMAGE_SQLITE_PATH:process.env.AFTERIMAGE_SQLITE_PATH,AFTERIMAGE_WORKER_TOKEN:process.env.AFTERIMAGE_WORKER_TOKEN};
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "afterimage-interest-worker-"));
  Object.assign(process.env, {NODE_ENV:"development",AFTERIMAGE_STORAGE:"sqlite",AFTERIMAGE_SQLITE_PATH:path.join(dir,"fixture.sqlite"),AFTERIMAGE_WORKER_TOKEN:"interest-test-worker"});
  [store,route] = await Promise.all([import("../src/lib/store"),import("../src/app/api/worker/route")]);
});
after(async () => {
  for (const [key,value] of Object.entries(previous)) {if (value === undefined) delete process.env[key];else process.env[key]=value;}
  await rm(dir,{recursive:true,force:true});
});
function fixture() {
  const s=initialState(),at=new Date().toISOString();
  s.entries={};s.feedback=[];s.jobs=[];s.recommendations=[];s.preferences=undefined;s.direction.goal="";
  s.papers=[{...s.papers[0],id:"2006.11239",title:"Denoising Diffusion Probabilistic Models",abstract:"Denoising diffusion models generate images by reversing a gradual noise process.",recall:null,scene:null},
    {...s.papers[0],id:"2010.02502",title:"Denoising Diffusion Implicit Models",abstract:"Denoising diffusion models can use non-Markovian generative processes.",recall:null,scene:null}];
  ensurePreferences(s).enabled=true;
  for(const paper of s.papers)recordChoice(s,{id:`saved-${paper.id}`,paperId:paper.id,kind:"save",at});
  s.workerSeenAt = new Date(Date.now()-70000).toISOString();
  return s;
}
async function reset(s=fixture()) {await store.mutate(current => {for(const key of Object.keys(current))delete (current as any)[key];Object.assign(current,s);});return s;}
async function worker(body:Record<string,unknown>) {
  const response=await route.POST(new Request("http://localhost/api/worker",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer interest-test-worker"},body:JSON.stringify(body)}));
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
const claim=()=>worker({action:"claim",capabilities:["dynamic-interests-v1"]});
const candidate={label:"Diffusion models",aliases:["denoising diffusion"],reason:"Both canonical papers develop denoising diffusion generative processes.",evidence:[{paperId:"2006.11239",quote:"Denoising diffusion models generate images"},{paperId:"2010.02502",quote:"Denoising diffusion models can use non-Markovian generative processes"}]};
test("compatible idle worker discovers interests independently of Next reads vacancies and sends only bounded evidence",async()=>{
  const s=await reset();assert.equal(s.jobs.length,0);
  const result=await claim();assert.equal(result.job.type,"interests");assert.equal(result.interestInput.papers.length,2);
  assert.equal(result.papers,undefined);assert.equal(result.entries,undefined);assert.equal(result.preferences,undefined);
  assert.equal(result.job.interestEvidenceFingerprint,result.interestInput.digest);
  await worker({action:"complete",jobId:result.job.id,leaseToken:result.job.leaseToken,interestSuggestions:{candidates:[candidate]}});
  const saved=(await store.snapshot()).data;
  assert.equal(saved.jobs[0].status,"complete");assert.deepEqual(saved.entries,{});assert.deepEqual(saved.recommendations,[]);
  assert.equal(saved.jobs.some(j=>j.type==="generate"||j.type==="study"),false);
  for(const full of [false,true]) {const view=publicState(saved,full);assert.equal(view.preferenceSummary?.suggestedInterests?.length,1);
    const text=JSON.stringify(view);for(const key of ['"interestEvidenceFingerprint"','"interestFollowup"','"metadataDigest"','"processedFingerprint"','"searchCycle"'])assert.ok(!text.includes(key),key);}
  await store.mutate(current=>{current.workerSeenAt=new Date(Date.now()-70000).toISOString();});
  assert.equal((await claim()).job,null);assert.equal((await store.snapshot()).data.jobs.length,1);
});
test("an older worker never claims the additive interests job",async()=>{
  const s=fixture();queueInterestDiscovery(s,new Date().toISOString(),()=>"topic-job");await reset(s);
  assert.equal((await worker({action:"claim"})).job,null);
  assert.equal((await store.snapshot()).data.jobs[0].status,"queued");
  assert.equal((await claim()).job.id,"topic-job");
});
test("changed evidence cannot publish a stale suggested interest",async()=>{
  await reset();const result=await claim();
  await store.mutate(s=>recordChoice(s,{id:"now-known",paperId:"2006.11239",kind:"feedback",value:"known",at:new Date().toISOString()}));
  const response=await worker({action:"complete",jobId:result.job.id,leaseToken:result.job.leaseToken,interestSuggestions:{candidates:[candidate]}});
  assert.equal(response.staleInterests,true);
  const state=(await store.snapshot()).data;assert.equal(publicState(state).preferenceSummary?.suggestedInterests?.length,0);
  assert.equal(state.jobs.filter(j=>j.status==="queued").length,0);
});
test("preparation positions include short interest jobs in actual worker priority",()=>{
  const s=fixture(),at=new Date().toISOString();
  const jobs:Job[]=[{id:"g",type:"generate",paperId:s.papers[0].id,status:"queued",createdAt:at,attempts:0},
    {id:"i",type:"interests",status:"queued",createdAt:at,attempts:0},
    {id:"r",type:"recommend",status:"queued",createdAt:at,attempts:0}];
  assert.equal(paperPreparationModel(s.papers[0],jobs).queuePosition,3);
});

test("disabling learning cancels a queued interest check before any model input is claimed",async()=>{
  const s=fixture();queueInterestDiscovery(s,new Date().toISOString(),()=>"disabled-job");
  ensurePreferences(s).enabled=false;await reset(s);
  assert.equal((await claim()).job,null);
  const state=(await store.snapshot()).data;assert.equal(state.jobs[0].status,"complete");assert.equal(state.jobs[0].attempts,0);
});

test("Off removes an existing semantic recommendation without a literal label match",async()=>{
  const {addInterest}=await import("../src/lib/interest-suggestions");
  const {advanceRecommendations}=await import("../src/lib/recommendations");
  const s=fixture(),at=new Date().toISOString();
  s.papers[0].title="A neural sequence model of gene expression";
  s.papers[0].abstract="A neural network predicts gene expression from DNA sequence.";
  const interest=addInterest(s,"AI for biology","biology-topic",at);
  s.recommendations=[{paperId:s.papers[0].id,role:"Genomics",reason:"Neural sequence models of gene expression.",focus:"DNA sequence prediction",depth:"Technical"}];
  s.recommendationInterestAssignments={[s.papers[0].id]:interest.id};
  assert.equal(publicState(s).recommendations.length,1);
  interest.strength="off";advanceRecommendations(s,at,()=>"refill");
  assert.equal(s.recommendations.length,0);
  assert.equal(JSON.stringify(publicState(s,true)).includes("recommendationInterestAssignments"),false);
});

test("claim retains the actual rebound evidence digest after failure and job history eviction",async()=>{
  const s=fixture(),at=new Date().toISOString();queueInterestDiscovery(s,at,()=>"queued-earlier");
  const originalDigest=s.jobs[0].interestEvidenceFingerprint;
  s.papers.push({...s.papers[0],id:"third-paper",title:"Diffusion Models for New Domains",abstract:"Denoising diffusion models extend generative processes to a new image domain."});
  recordChoice(s,{id:"new-positive-before-claim",paperId:"third-paper",kind:"save",at});
  await reset(s);const result=await claim();
  assert.notEqual(result.job.interestEvidenceFingerprint,originalDigest);
  const actualDigest=result.job.interestEvidenceFingerprint;
  assert.equal((await store.snapshot()).data.preferences!.interestDiscovery!.attemptedFingerprints!.filter(value=>value===actualDigest).length,1);
  await worker({action:"fail",jobId:result.job.id,leaseToken:result.job.leaseToken,error:"Synthetic inference failure"});
  await store.mutate(current=>{current.jobs=[];current.workerSeenAt=new Date(Date.now()-70000).toISOString();});
  assert.equal((await claim()).job,null);
  const state=(await store.snapshot()).data;assert.deepEqual(state.jobs,[]);
  assert.equal(state.preferences!.interestDiscovery!.attemptedFingerprints!.filter(value=>value===actualDigest).length,1);
});
