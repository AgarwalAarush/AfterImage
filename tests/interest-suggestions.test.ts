import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/lib/catalog";
import { addInterest, decideInterestSuggestion, interestSuggestionInput, publishInterestSuggestions, queueInterestDiscovery, requestInterestDiscovery, retireInterest, canDiscoverInterests } from "../src/lib/interest-suggestions";
import type { InterestSuggestionResult } from "../src/lib/interest-suggestions";
import { canonicalFeatures, ensurePreferences, preferenceSummary, recordChoice, recordEngagement } from "../src/lib/preferences";
import { publicState } from "../src/lib/public-state";
import type { AppState, Job } from "../src/lib/types";
const at = "2026-10-03T12:00:00.000Z", now = Date.parse(at);
function fixture() {
  const s = initialState();s.preferences=undefined;s.entries={};s.feedback=[];s.jobs=[];s.recommendations=[];
  const source=s.papers[0];s.papers=[
    {...source,id:"robot-a",title:"Diffusion Policy",abstract:"Diffusion policy learns visuomotor robot control from demonstrations."},
    {...source,id:"robot-b",title:"Learning Robot Policies",abstract:"Robot control from demonstrations supports manipulation using diffusion policy."},
    {...source,id:"bio",title:"Genomics Foundation Models",abstract:"Sequence models learn genomic representations from DNA and gene expression."},
    {...source,id:"robot-c",title:"Robot Manipulation",abstract:"Robot control from demonstrations generalizes to manipulation tasks."},
  ];
  ensurePreferences(s).enabled=true;return s;
}
function choose(s:AppState,id:string,kind:"save"|"prepare"|"reading"="save") {
  recordChoice(s,{id:`choice-${id}`,paperId:id,kind,at});
}
function candidate(label="Robot learning",aliases=["robot control"]) : InterestSuggestionResult {
  return {candidates:[{label,aliases,reason:"These papers share robot control from demonstrations.",evidence:[
    {paperId:"robot-a",quote:"visuomotor robot control from demonstrations"},
    {paperId:"robot-b",quote:"Robot control from demonstrations"},
  ]}]};
}
function claim(s:AppState,id="interest-job") {
  assert.equal(queueInterestDiscovery(s,at,()=>id),true);
  const job=s.jobs.find(j=>j.id===id)!;job.status="running";job.preferenceRevision=ensurePreferences(s).revision;
  job.interestEvidenceFingerprint=interestSuggestionInput(s,now).digest;return job;
}
test("manual interests are arbitrary, duplicate-safe, persistent and do not invent paper activity",()=>{
  const s=fixture(),p=ensurePreferences(s),before=p.events.length;
  const interest=addInterest(s,"  AI for biology  ","manual-bio",at);
  assert.equal(interest.label,"AI for biology");assert.equal(p.events.length,before);
  assert.equal(addInterest(s,"AI for biology","manual-bio",at).id,interest.id);
  assert.equal(addInterest(s,"AI-for biology","manual-repeat",at).id,interest.id);
  assert.throws(()=>addInterest(s,"Robot learning","manual-bio",at),/already used/);
  interest.strength="off";addInterest(s,"AI for biology","manual-on",at);assert.equal(interest.strength,"normal");
  assert.deepEqual(s.jobs,[]);assert.deepEqual(s.entries,{});
});
test("new accepted topic phrases invalidate feature matching without changing metadata identity",()=>{
  const s=fixture(),p=ensurePreferences(s),original=canonicalFeatures(s.papers[0]);
  const interest=addInterest(s,"Robot control","manual-robot",at);
  assert.equal(p.features["robot-a"].digest,original.digest);
  assert.ok(p.features["robot-a"].interests.includes(interest.id));assert.ok(p.features["robot-a"].vocabularyDigest);
  assert.ok(!p.features.bio.interests.includes(interest.id));
  s.papers[0].abstract="Updated canonical metadata.";ensurePreferences(s);assert.notEqual(p.features["robot-a"].digest,original.digest);
});
test("inference requires confirmed positive choices and coalesces unchanged evidence",()=>{
  const s=fixture();assert.equal(queueInterestDiscovery(s,at,()=>"absent"),false);
  choose(s,"robot-a");assert.equal(queueInterestDiscovery(s,at,()=>"one"),false);
  choose(s,"robot-b");const job=claim(s);
  assert.equal(queueInterestDiscovery(s,at,()=>"duplicate"),false);assert.equal(s.jobs.length,1);
  assert.equal(publishInterestSuggestions(s,job,candidate(),at,()=>"follow"),true);
  assert.equal(queueInterestDiscovery(s,new Date(now+10000).toISOString(),()=>"again"),false);
  assert.equal(ensurePreferences(s).interests.some(i=>i.label==="Robot learning"),false);
  assert.equal(preferenceSummary(s).suggestedInterests?.length,1);
});
test("suggestions can be accepted or durably ignored with alias and plural deduplication",()=>{
  const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const job=claim(s);
  publishInterestSuggestions(s,job,candidate(),at,()=>"follow");
  const suggestion=ensurePreferences(s).interestDiscovery!.pending[0];
  decideInterestSuggestion(s,suggestion.id,"ignore","ignore",at);
  assert.equal(preferenceSummary(s).suggestedInterests?.length,0);
  assert.equal(decideInterestSuggestion(s,suggestion.id,"ignore","ignore",at),undefined);
  assert.throws(()=>decideInterestSuggestion(s,suggestion.id,"add","ignore",at),/already used/);
  const input=interestSuggestionInput(s,now);const rerun:Job={...job,id:"rerun",status:"running",preferenceRevision:ensurePreferences(s).revision,interestEvidenceFingerprint:input.digest};
  publishInterestSuggestions(s,rerun,candidate("Robot controls",["Robot learning"]),at,()=>"follow");
  assert.equal(preferenceSummary(s).suggestedInterests?.length,0);
  const interest=addInterest(s,"Robot learning","manual-override",at);
  assert.equal(ensurePreferences(s).interestDiscovery!.ignored.length,0);assert.equal(interest.strength,"normal");
});
test("accept uses supported aliases and keeps all other selected interests unchanged",()=>{
  const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const p=ensurePreferences(s);p.interests[0].strength="stronger";
  const originals=structuredClone(p.interests),job=claim(s);
  publishInterestSuggestions(s,job,candidate("Robot learning",["robot control","invented cosmic phrase"]),at,()=>"follow");
  const suggestion=p.interestDiscovery!.pending[0],interestId=decideInterestSuggestion(s,suggestion.id,"add","accept",at);
  assert.equal(decideInterestSuggestion(s,suggestion.id,"add","accept",at),interestId);
  assert.deepEqual(p.interests.slice(0,originals.length),originals);
  assert.deepEqual(p.interests.find(i=>i.id===interestId)!.aliases,["robot control"]);
  assert.equal(preferenceSummary(s).suggestedInterests?.length,0);
});
test("unsupported identities, fabricated quotes, duplicate sources and disabled topics never publish",()=>{
  for (const change of [
    (r:InterestSuggestionResult)=>{r.candidates[0].evidence[1].paperId="missing";},
    (r:InterestSuggestionResult)=>{r.candidates[0].evidence[0].quote="A fabricated quote about a different method.";},
    (r:InterestSuggestionResult)=>{r.candidates[0].evidence[1]={...r.candidates[0].evidence[0]};},
    (r:InterestSuggestionResult)=>{r.candidates[0].label="World models";},
  ]) {const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const p=ensurePreferences(s);p.interests[0].strength="off";
    const job=claim(s),result=candidate();change(result);publishInterestSuggestions(s,job,result,at,()=>"follow");assert.equal(p.interestDiscovery!.pending.length,0);}
});
test("later rejection withdraws source evidence and stale runs queue only one follow-up",()=>{
  const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const job=claim(s);
  choose(s,"robot-c");assert.equal(publishInterestSuggestions(s,job,candidate(),at,()=>"follow"),false);
  const follow=s.jobs.find(j=>j.id==="follow")!;assert.ok(follow);assert.equal(follow.interestFollowup,true);follow.status="running";
  follow.preferenceRevision=ensurePreferences(s).revision;follow.interestEvidenceFingerprint=interestSuggestionInput(s,now).digest;
  recordChoice(s,{id:"reject",paperId:"robot-a",kind:"feedback",value:"irrelevant",at});
  assert.equal(publishInterestSuggestions(s,follow,candidate(),at,()=>"loop"),false);assert.equal(s.jobs.length,2);
  assert.equal(interestSuggestionInput(s,now).papers.some(p=>p.id==="robot-a"),false);
});
test("passive reading alone stays conservative and opting out removes its evidence without scheduling",()=>{
  const s=fixture(),p=ensurePreferences(s);
  for(const paper of s.papers) recordEngagement(s,`engage-${paper.id}`,paper.id,45,"2026-10-03",at);
  assert.equal(queueInterestDiscovery(s,at,()=>"too-soon"),false);assert.deepEqual(s.jobs,[]);
  const tomorrow="2026-10-04T12:00:00.000Z";
  for(const paper of s.papers) recordEngagement(s,`again-${paper.id}`,paper.id,45,"2026-10-04",tomorrow);
  assert.equal(queueInterestDiscovery(s,tomorrow,()=>"enough"),true);
  p.learningFromReading=false;assert.equal(interestSuggestionInput(s,Date.parse(tomorrow)).papers.length,0);
});
test("private inference details stay out of normal polling and full exports",()=>{
  const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const job=claim(s);publishInterestSuggestions(s,job,candidate(),at,()=>"follow");
  for(const full of [false,true]) {const result=publicState(s,full),summary=result.preferenceSummary!;
    assert.deepEqual(summary.suggestedInterests![0].evidence.map(e=>e.paperId),["robot-a","robot-b"]);
    assert.equal(summary.suggestedInterests![0].reason,candidate().candidates[0].reason);
    const json=JSON.stringify(summary);for(const privateKey of ["metadataDigest","quote","signal","aliases","receipts","fingerprint","decisions"])assert.ok(!json.includes(`\"${privateKey}\"`));
    assert.equal(result.preferences,undefined);assert.equal(result.jobs[0].interestEvidenceFingerprint,undefined);assert.equal(result.jobs[0].interestFollowup,undefined);}
});
test("failed inference does not loop on unchanged evidence and explicit retries are bounded",()=>{
  const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const job=claim(s);job.status="failed";
  assert.equal(queueInterestDiscovery(s,new Date(now+60000).toISOString(),()=>"auto"),false);
  assert.throws(()=>queueInterestDiscovery(s,new Date(now+1000).toISOString(),()=>"fast",{force:true}),/Wait a minute/);
  assert.equal(queueInterestDiscovery(s,new Date(now+60000).toISOString(),()=>"manual",{force:true}),true);
  s.jobs.at(-1)!.status="failed";
  assert.throws(()=>queueInterestDiscovery(s,new Date(now+120000).toISOString(),()=>"flood",{force:true}),/hour/);
});

test("newer topics retain evidence slots even after many older Useful papers",()=>{
  const s=fixture(),base=s.papers[0];
  for(let i=0;i<70;i++){const id=`old-${i}`;s.papers.push({...base,id,title:`Old favored topic ${i}`});recordChoice(s,{id:`useful-${id}`,paperId:id,kind:"feedback",value:"useful",at:"2025-10-03T12:00:00.000Z"});}
  choose(s,"robot-a");choose(s,"robot-b");
  const input=interestSuggestionInput(s,now);assert.equal(input.papers.length,60);
  assert.ok(input.papers.some(p=>p.id==="robot-a"));assert.ok(input.papers.some(p=>p.id==="robot-b"));
  assert.ok(input.papers.some(p=>p.id.startsWith("old-")));
});
test("decades-old explicit choices cannot convert weak passive evidence into an explicit cluster",()=>{
  const s=fixture();for(const paperId of ["robot-a","robot-b"]){recordChoice(s,{id:`ancient-${paperId}`,paperId,kind:"save",at:"2000-01-01T00:00:00.000Z"});recordEngagement(s,`today-${paperId}`,paperId,45,"2026-10-03",at);}
  const input=interestSuggestionInput(s,now);assert.equal(input.papers.length,2);assert.ok(input.papers.every(p=>!p.explicit));
  assert.equal(queueInterestDiscovery(s,at,()=>"weak"),false);
});
test("failed input remains attempted after job history truncation and refresh UUID replays stay idempotent",()=>{
  const s=fixture();choose(s,"robot-a");choose(s,"robot-b");const job=claim(s);job.status="failed";
  s.jobs=[];assert.equal(queueInterestDiscovery(s,new Date(now+3600001).toISOString(),()=>"forgotten"),false);
  assert.equal(requestInterestDiscovery(s,"refresh-id",new Date(now+3600001).toISOString(),()=>"retry"),true);
  s.jobs[0].status="failed";
  assert.equal(requestInterestDiscovery(s,"refresh-id",new Date(now+7200002).toISOString(),()=>"replayed"),true);
  assert.equal(s.jobs.length,1);assert.equal(s.jobs[0].id,"retry");
});

test("removing interests frees capacity without erasing choices, suppresses reinference, and restores identity",()=>{
  const s=fixture(),p=ensurePreferences(s);choose(s,"robot-a");const before=p.events.length;
  const seed=p.interests[0];retireInterest(s,seed.id,"remove-seed",at);assert.equal(p.interests.some(i=>i.id===seed.id),false);
  assert.equal(p.events.length,before);assert.ok(p.interestDiscovery!.ignored.some(i=>i.interestId===seed.id));
  retireInterest(s,seed.id,"remove-seed",at);const restored=addInterest(s,seed.label,"restore-seed",at);assert.equal(restored.id,seed.id);
  for(let i=0;i<20;i++)addInterest(s,`Additional topic ${i}`,`add-${i}`,at);
  assert.equal(p.interests.length,24);assert.throws(()=>addInterest(s,"One more topic","overflow",at),/24/);
  const removed=p.interests.at(-1)!;retireInterest(s,removed.id,"free-space",at);addInterest(s,"One more topic","space-available",at);assert.equal(p.interests.length,24);
});
test("claim preflight skips disabled or withdrawn evidence without calling inference",()=>{
  const s=fixture(),p=ensurePreferences(s);choose(s,"robot-a");choose(s,"robot-b");assert.equal(canDiscoverInterests(s,now),true);
  p.enabled=false;assert.equal(canDiscoverInterests(s,now),false);p.enabled=true;
  recordChoice(s,{id:"known",paperId:"robot-b",kind:"feedback",value:"known",at});assert.equal(canDiscoverInterests(s,now),false);
});
