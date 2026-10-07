import test, {before,after} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {initialState} from "../src/lib/catalog";
import {ensurePreferences,recordChoice} from "../src/lib/preferences";
import {interestSuggestionInput,publishInterestSuggestions} from "../src/lib/interest-suggestions";
import type {Job} from "../src/lib/types";
let directory:string;
const original={NODE_ENV:process.env.NODE_ENV,AFTERIMAGE_STORAGE:process.env.AFTERIMAGE_STORAGE,AFTERIMAGE_SQLITE_PATH:process.env.AFTERIMAGE_SQLITE_PATH};
let stateRoute:typeof import("../src/app/api/state/route"),store:typeof import("../src/lib/store");
const at=new Date().toISOString();
before(async()=>{
 directory=await mkdtemp(path.join(os.tmpdir(),"afterimage-interest-api-"));Object.assign(process.env,{NODE_ENV:"development",AFTERIMAGE_STORAGE:"sqlite",AFTERIMAGE_SQLITE_PATH:path.join(directory,"fixture.sqlite")});
 [stateRoute,store]=await Promise.all([import("../src/app/api/state/route"),import("../src/lib/store")]);
});
after(async()=>{for(const [key,value]of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(directory,{recursive:true,force:true});});
async function reset(){const s=initialState();s.preferences=undefined;s.entries={};s.feedback=[];s.jobs=[];s.recommendations=[];s.direction.goal="Explore useful research.";
 s.papers=[{...s.papers[0],id:"robot-a",title:"Diffusion Policy",abstract:"Diffusion policy learns robot control from demonstrations."},
 {...s.papers[0],id:"robot-b",title:"Learning Robot Policies",abstract:"Robot control from demonstrations supports manipulation."}];
 await store.mutate(current=>Object.assign(current,s));return s;}
async function post(body:unknown,status=200){const response=await stateRoute.POST(new Request("http://localhost/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
test("manual-interest API is additive, idempotent and preserves existing strengths",async()=>{
 await reset();const eventId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const first=await post({action:"interest-add",label:"Computational neuroscience",eventId});
 const interest=first.state.preferenceSummary.interests.find((i:{label:string})=>i.label==="Computational neuroscience");assert.ok(interest);
 const second=await post({action:"interest-add",label:"Computational neuroscience",eventId});assert.equal(second.state.preferenceSummary.interests.length,5);
 const state=(await store.snapshot()).data;assert.deepEqual(state.entries,{});assert.ok(!state.jobs.some(j=>["generate","study"].includes(j.type)));
 assert.equal(state.preferences!.events.some(e=>e.paperId===interest.id),false);
 await post({action:"interest-add",label:"Different topic",eventId},400);
});
test("interest-add validation and larger arbitrary-topic updates keep schema2 compatibility",async()=>{
 await reset();await post({action:"interest-add",label:"x"},400);
 for(let i=0;i<9;i++)await post({action:"interest-add",label:`Research topic ${i}`});
 const state=(await store.snapshot()).data,interests=state.preferences!.interests.map(i=>({id:i.id,strength:"less"}));
 const response=await post({action:"interests",learningFromReading:false,interests});
 assert.equal(response.state.schemaVersion,2);assert.equal(response.state.preferenceSummary.interests.length,13);
 assert.ok(response.state.preferenceSummary.interests.every((i:{strength:string})=>i.strength==="less"));
});
async function withSuggestion(){await reset();await store.mutate(s=>{ensurePreferences(s).enabled=true;for(const paper of s.papers)recordChoice(s,{id:`save-${paper.id}`,paperId:paper.id,kind:"save",at});
 const input=interestSuggestionInput(s),job:Job={id:"inference",type:"interests",status:"running",createdAt:at,attempts:1,preferenceRevision:s.preferences!.revision,interestEvidenceFingerprint:input.digest};s.jobs=[job];
 publishInterestSuggestions(s,job,{candidates:[{label:"Robot learning",aliases:["robot control"],reason:"Both papers study learning robot control from demonstrations.",evidence:[{paperId:"robot-a",quote:"robot control from demonstrations"},{paperId:"robot-b",quote:"Robot control from demonstrations"}]}]},at,()=>"follow");});return (await store.snapshot()).data.preferences!.interestDiscovery!.pending[0];}
test("suggested-interest Add accepts once without changing library or generating",async()=>{
 const suggestion=await withSuggestion(),eventId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",body={action:"interest-suggestion",suggestionId:suggestion.id,decision:"add",eventId};
 const first=await post(body);assert.equal(first.state.preferenceSummary.suggestedInterests.length,0);assert.ok(first.state.preferenceSummary.interests.some((i:{label:string})=>i.label==="Robot learning"));
 const second=await post(body);assert.equal(second.state.preferenceSummary.interests.length,5);
 const state=(await store.snapshot()).data;assert.deepEqual(state.entries,{});assert.ok(!state.jobs.some(j=>["generate","study"].includes(j.type)));
});
test("suggested-interest Ignore survives polling and replay without becoming a paper dislike",async()=>{
 const suggestion=await withSuggestion(),eventId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",body={action:"interest-suggestion",suggestionId:suggestion.id,decision:"ignore",eventId};
 await post(body);await post(body);const state=(await store.snapshot()).data;
 assert.equal(state.preferences!.interestDiscovery!.ignored.length,1);assert.deepEqual(state.feedback,[]);assert.equal(state.preferences!.interests.length,4);
 const response=await stateRoute.GET(new Request("http://localhost/api/state?full=1")),publicResult=await response.json();
 assert.equal(publicResult.preferences,undefined);assert.equal(publicResult.preferenceSummary.suggestedInterests.length,0);
 assert.ok(!JSON.stringify(publicResult).includes('"interestDiscovery"'));
});
test("engagement action stays acknowledgement-only while dynamic discovery is enabled",async()=>{
 await reset();await store.mutate(s=>{ensurePreferences(s).enabled=true;});
 for(const paperId of ["robot-a","robot-b"])assert.deepEqual(await post({action:"engagement",paperId,eventId:paperId==="robot-a"?"dddddddd-dddd-4ddd-8ddd-dddddddddddd":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",seconds:45,day:at.slice(0,10)}),{ok:true,recorded:true});
 const state=(await store.snapshot()).data;assert.deepEqual(state.jobs,[]);assert.deepEqual(state.entries,{});
});

test("refresh-interest-suggestions replays one event without another model job",async()=>{
 await reset();await store.mutate(s=>{ensurePreferences(s).enabled=true;for(const paper of s.papers)recordChoice(s,{id:`chosen-${paper.id}`,paperId:paper.id,kind:"save",at});});
 const eventId="ffffffff-ffff-4fff-8fff-ffffffffffff",body={action:"refresh-interest-suggestions",eventId};
 await post(body);await store.mutate(s=>{s.jobs.find(j=>j.type==="interests")!.status="failed";});
 await post(body);const state=(await store.snapshot()).data;assert.equal(state.jobs.filter(j=>j.type==="interests").length,1);
});

test("interest-remove is idempotent and retains recorded paper preferences",async()=>{
 await reset();const initial=(await store.snapshot()).data,id=ensurePreferences(initial).interests[0].id;
 const body={action:"interest-remove",interestId:id,eventId:"11111111-1111-4111-8111-111111111111"};
 await post(body);await post(body);const state=(await store.snapshot()).data;
 assert.equal(state.preferences!.interests.length,3);assert.ok(state.preferences!.events.some(e=>e.id.startsWith("owner-stated:")));
 assert.ok(state.preferences!.interestDiscovery!.ignored.some(i=>i.interestId===id));
});

test("replayed interest decisions cannot enqueue another recommendation or inference job",async()=>{
 await reset();const body={action:"interest-add",label:"Neural coding",eventId:"22222222-2222-4222-8222-222222222222"};
 await post(body);const before=(await store.snapshot()).data.jobs.length;
 await store.mutate(s=>{for(const job of s.jobs)job.status="complete";});
 await post(body);assert.equal((await store.snapshot()).data.jobs.length,before);
});
