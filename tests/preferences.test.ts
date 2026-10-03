import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/lib/catalog";
import { canonicalFeatures,ensurePreferences,recordChoice,paperSignal,learnedAdjustment,recordEngagement,undoFeedback } from "../src/lib/preferences";
import { publicState } from "../src/lib/public-state";
import { ReadingClock } from "../src/lib/reading-engagement";
import { excludedRecommendations,publishRecommendations } from "../src/lib/recommendations";
import type { Paper,Job } from "../src/lib/types";
const at = "2026-10-03T12:00:00.000Z", now=Date.parse(at);
function fixture() {const s=initialState();s.entries={};s.feedback=[];s.jobs=[];s.recommendations=[];
 s.papers=[{...s.papers[0],id:"net",title:"Agentic NetOps and AIOps",abstract:"Network operations architectures, evaluation and safety."},
 {...s.papers[0],id:"moe",title:"Expert routing in mixture-of-experts",abstract:"Expert choice routing for sparse models."},
 {...s.papers[0],id:"world",title:"World models",abstract:"Learned latent dynamics."}] as Paper[];return s;}
test("implicit strengths use the strongest milestone, decay, and explicit feedback persists", () => {
 const s=fixture(),p=ensurePreferences(s);
 for (const [kind,value] of [["save",1],["prepare",1.5],["reading",2]] as const) {
  recordChoice(s,{id:kind,paperId:"moe",kind,at});assert.equal(paperSignal(p,"moe",now),value);
 }
 recordChoice(s,{id:"retry",paperId:"moe",kind:"prepare",at});assert.equal(p.events.filter(e=>e.paperId==="moe"&&e.kind==="prepare").length,1);
 assert.equal(paperSignal(p,"moe",now+90*86400000),1);
 recordChoice(s,{id:"like",paperId:"moe",kind:"feedback",value:"useful",at});assert.equal(paperSignal(p,"moe",now+900*86400000),4);
 recordChoice(s,{id:"dislike",paperId:"moe",kind:"feedback",value:"irrelevant",at:new Date(now+1).toISOString()});assert.equal(paperSignal(p,"moe",now),-.5);
});
test("older feedback remains durable, latest choice reverses and Undo reveals prior rating", () => {
 const s=fixture();s.feedback=[{paperId:"moe",value:"useful",at}];const p=ensurePreferences(s);
 s.feedback=[];ensurePreferences(s);assert.equal(paperSignal(p,"moe",now),4);
 recordChoice(s,{id:"reject",paperId:"moe",kind:"feedback",value:"irrelevant",at:new Date(now+1).toISOString()});
 assert.ok(excludedRecommendations(s,now).has("moe"));assert.ok(undoFeedback(s,"reject",at));assert.equal(paperSignal(p,"moe",now),4);
 assert.ok(!excludedRecommendations(s,now).has("moe"));assert.equal(undoFeedback(s,"reject",at),false);
});
test("canonical mechanism penalties are mild and do not cross from NetOps to MoE or world models", () => {
 const s=fixture(),p=ensurePreferences(s);p.enabled=true;
 recordChoice(s,{id:"reject",paperId:"net",kind:"feedback",value:"irrelevant",at});
 assert.equal(learnedAdjustment(p,canonicalFeatures(s.papers[1]),now),0);
 assert.equal(learnedAdjustment(p,canonicalFeatures(s.papers[2]),now),0);
 assert.equal(learnedAdjustment(p,canonicalFeatures(s.papers[0]),now),-.005);
 s.papers[0].abstract="Mixture-of-experts expert routing.";const before=p.features.net.digest;ensurePreferences(s);assert.notEqual(p.features.net.digest,before);
 assert.ok(learnedAdjustment(p,canonicalFeatures(s.papers[1]),now) >= -.05);
});
test("known and advanced request exclusion/prerequisites without dislike; archived retains confirmed history", () => {
 for (const value of ["known","advanced"] as const) {const s=fixture(),p=ensurePreferences(s);p.enabled=true;
 recordChoice(s,{id:value,paperId:"moe",kind:"feedback",value,at});assert.equal(paperSignal(p,"moe",now),0);
 assert.equal(learnedAdjustment(p,canonicalFeatures(s.papers[1]),now),0);assert.equal(excludedRecommendations(s,now).has("moe"),true);}
 const s=fixture();recordChoice(s,{id:"read",paperId:"moe",kind:"reading",at});s.entries.moe={paperId:"moe",status:"archived",savedAt:at,updatedAt:at};
 assert.equal(paperSignal(ensurePreferences(s),"moe",now),2);
});
test("engagement is once daily, idempotent, bounded, private and never creates jobs or entries", () => {
 const s=fixture(),p=ensurePreferences(s);p.enabled=true;
 assert.equal(recordEngagement(s,"early","world",44,"2026-10-03",at),false);
 assert.ok(recordEngagement(s,"once","world",45,"2026-10-03",at));assert.equal(recordEngagement(s,"twice","world",99,"2026-10-03",at),false);
 assert.equal(paperSignal(p,"world",now),.25);
 assert.ok(recordEngagement(s,"day2","world",45,"2026-10-04","2026-10-04T12:00:00.000Z"));
 assert.ok(paperSignal(p,"world",now+86400000) <= .5);assert.deepEqual(s.jobs,[]);assert.deepEqual(s.entries,{});
 for(const full of [false,true]) {const exported=JSON.stringify(publicState(s,full));assert.ok(!exported.includes('"preferences"'));assert.ok(!exported.includes('"events"'));assert.ok(!exported.includes('"features"'));}
 p.learningFromReading=false;assert.equal(paperSignal(p,"world",now),0);assert.equal(recordEngagement(s,"off","world",45,"2026-10-05","2026-10-05T12:00:00.000Z"),false);
});
test("clock excludes background time, accumulates navigation/reload and submits only once", () => {
 const progress={day:"2026-10-03",seconds:0,submitted:false,eventId:"id"};const c=new ReadingClock(progress,0,true);
 assert.equal(c.sample(20000,false),false);c.sample(100000,true);assert.equal(progress.seconds,20);
 assert.equal(c.sample(124000,false),false);const reloaded=new ReadingClock({...progress},0,true);
 assert.equal(reloaded.sample(1000,false),true);reloaded.progress.submitted=true;assert.equal(reloaded.sample(2000,true),false);
});
test("stale profile publication preserves cards and coalesces one follow-up", () => {
 const s=fixture(),p=ensurePreferences(s);s.direction.goal="world models";
 const pick={paperId:"world",role:"Next",reason:"Learned dynamics.",focus:"Dynamics",depth:"Technical"};s.recommendations=[pick];
 const job:Job={id:"j",type:"recommend",status:"running",createdAt:at,attempts:1,preferenceRevision:p.revision};s.jobs=[job];p.revision++;
 assert.equal(publishRecommendations(s,[{...pick,paperId:"moe"}],job,at,()=>"follow"),false);
 assert.deepEqual(s.recommendations,[pick]);assert.equal(s.jobs.filter(j=>j.status==="queued").length,1);
});

test("disabled canonical interests remove retained cards and queue one bounded refill",async()=>{
 const {advanceRecommendations}=await import("../src/lib/recommendations");const s=fixture(),p=ensurePreferences(s);
 s.direction.goal="Explore world models and MoE";
 s.recommendations=[{paperId:"world",role:"World models",reason:"Learned dynamics.",focus:"Dynamics",depth:"Technical"}];
 p.interests.find(i=>i.id==="world-models")!.strength="off";
 advanceRecommendations(s,at,()=>"refill");assert.equal(s.recommendations.length,0);assert.equal(s.jobs.length,1);
 advanceRecommendations(s,at,()=>"another");assert.equal(s.jobs.length,1);
});
test("seed choices include the stated favorites and leave uncertainty unrated",()=>{
 const p=ensurePreferences(fixture());assert.equal(paperSignal(p,"2510.26692",now),4);assert.equal(paperSignal(p,"2412.19437",now),4);
 assert.equal(p.events.some(e=>e.paperId==="2511.06494"),false);
});
test("late Undo keeps newer explicit choices and passive learning respects its cap",()=>{
 const s=fixture(),p=ensurePreferences(s);p.enabled=true;
 recordChoice(s,{id:"old",paperId:"world",kind:"feedback",value:"irrelevant",at});
 recordChoice(s,{id:"new",paperId:"world",kind:"feedback",value:"useful",at:new Date(now+1).toISOString()});
 assert.equal(undoFeedback(s,"old",at),false);assert.equal(paperSignal(p,"world",now),4);
 for(let day=0;day<4;day++) {const time=new Date(now+day*86400000).toISOString();recordEngagement(s,`day-${day}`,"net",45,time.slice(0,10),time);}
 assert.equal(paperSignal(p,"net",now+3*86400000),.5);
});

test("Too advanced frees a suggestion slot for prerequisites without a mechanism penalty",async()=>{
 const {advanceRecommendations}=await import("../src/lib/recommendations");const s=fixture(),p=ensurePreferences(s);p.enabled=true;s.direction.goal="Study MoE";
 s.recommendations=[{paperId:"moe",role:"Routing",reason:"Expert choice routing.",focus:"Routing",depth:"Technical"}];
 recordChoice(s,{id:"advanced-request",paperId:"moe",kind:"feedback",value:"advanced",at});
 advanceRecommendations(s,at,()=>"prerequisite-refill");assert.equal(s.recommendations.length,0);assert.equal(s.jobs.length,1);
 assert.equal(learnedAdjustment(p,canonicalFeatures(s.papers[1]),now),0);
 recordChoice(s,{id:"ready-now",paperId:"moe",kind:"feedback",value:"useful",at:new Date(now+1).toISOString()});
 assert.equal(excludedRecommendations(s,now).has("moe"),false);
});
