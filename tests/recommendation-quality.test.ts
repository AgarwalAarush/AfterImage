import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initialState } from "../src/lib/catalog";
import { ensurePreferences,canonicalFeatures } from "../src/lib/preferences";
import { rankRecommendations } from "../worker/recommendation-ranking";
import { groundSelections,planInterestSearches,type DiscoveryModel } from "../worker/recommendations";
import { verifiedPopularity } from "../worker/discovery";
const rec=(paperId:string,relevance=.9,interestId="world-models")=>({paperId,relevance,interestId,nextStep:.9,thread:"adjacent" as const,
 role:"World models",reason:"Learned latent dynamics.",focus:"Latent dynamics",depth:"Technical"});
test("world-model fit has no MoE requirement and relevance gating precedes learning",()=>{
 const s=initialState();s.entries={};s.jobs=[];s.feedback=[];
 const world={...s.papers[0],id:"world",title:"World models",abstract:"Learned latent dynamics."};s.papers=[world];
 const p=ensurePreferences(s);p.enabled=true;
 assert.equal(rankRecommendations([rec("world")],{},new Set(),{profile:p,papers:s.papers})[0]?.paperId,"world");
 assert.equal(rankRecommendations([rec("world",.59)],{},new Set(),{profile:p,papers:s.papers}).length,0);
 p.interests.find(i=>i.id==="world-models")!.strength="off";
 assert.equal(rankRecommendations([rec("world"),rec("world",.99,"research-direction")],{},new Set(),{profile:p,papers:s.papers}).length,0);
});
test("one-slot refill directly chooses a complementary paper using retained cards",()=>{
 const s=initialState(), paper=(id:string,title:string,abstract:string)=>({...s.papers[0],id,title,abstract});
 const papers=[paper("a","Expert Choice","Expert choice routing."),paper("b","Expert Choice","Expert choice routing."),
 paper("more","Expert Choice","Expert choice routing."),paper("world","World models","Learned latent dynamics.")];
 const picks=rankRecommendations([rec("more",.91,"sparse-compute"),rec("world",.9)],{},new Set(),
 {vacancies:1,retained:[rec("a"),rec("b")],papers});
 assert.deepEqual(picks.map(r=>r.paperId),["world"]);
});
test("independent interest searches include established and recent world models, without a fixed slot",()=>{
 const p=ensurePreferences(initialState());const queries=planInterestSearches(p,[{query:"linear attention",lane:"recent"}]);
 assert.ok(queries.some(q=>q.query==="world models"&&q.lane==="relevance"));assert.ok(queries.some(q=>q.query.includes("world models")&&q.lane==="recent"));
 p.interests.find(i=>i.id==="world-models")!.strength="off";
 assert.ok(!planInterestSearches(p,[{query:"world models",lane:"recent"}]).some(q=>q.query.includes("world models")));
});
test("selected identity mismatch is repaired once, independently reviewed again, then omitted",async()=>{
 const p={...initialState().papers[0],id:"net",title:"Agentic NetOps and AIOps",abstract:"Network operations architecture and safety."};
 const dir=await mkdtemp(path.join(os.tmpdir(),"afterimage-grounding-"));let reviews=0,repairs=0;
 const model:DiscoveryModel=async(_prompt,schema,_dir,name)=>{
  if(name.startsWith("ground-repair")){repairs++;return schema.parse({recommendations:[{...rec("net"),reason:"Hi-MoE combines experts."}]});}
  reviews++;return schema.parse({reviews:[{paperId:"net",canonicalTitle:"Hi-MoE",metadataDigest:canonicalFeatures(p).digest,
   identity:false,reason:false,focus:false,reasonEvidence:[],focusEvidence:[],issues:["Incorrect paper identity"]}]});
 };
 try {const result=await groundSelections([rec("net")],[p],model,dir);assert.equal(result.picks.length,0);assert.equal(reviews,2);assert.equal(repairs,1);}finally{await rm(dir,{recursive:true,force:true});}
});
test("review booleans cannot certify fabricated evidence; a valid bounded repair can pass",async()=>{
 const p={...initialState().papers[0],id:"world",title:"World models",abstract:"Learned latent dynamics."};let reviews=0;
 const model:DiscoveryModel=async(_prompt,schema,_dir,name)=>{
  if(name.startsWith("ground-repair"))return schema.parse({recommendations:[rec("world")]});reviews++;
  return schema.parse({reviews:[{paperId:p.id,canonicalTitle:p.title,metadataDigest:canonicalFeatures(p).digest,identity:true,reason:true,focus:true,
   reasonEvidence:[reviews===1?"Invented evidence":"Learned latent dynamics."],focusEvidence:["Learned latent dynamics."],issues:[]}]});
 };
 const result=await groundSelections([rec("world")],[p],model,"unused");assert.equal(result.picks.length,1);assert.equal(result.verdicts.length,2);
});
test("canonical DOI lookup works without paid title search and verifies title plus identity",async()=>{
 const work={id:"https://openalex.org/W1",title:"World Models",doi:"https://doi.org/10.48550/arxiv.1803.10122",cited_by_count:123};
 let calls=0;const request=(async(url: URL)=>{calls++;assert.ok(url.pathname.includes("10.48550/arxiv."));return Response.json(work);}) as typeof fetch;
 assert.equal((await verifiedPopularity({id:"1803.10122",title:"World Models"},request))?.citedByCount,123);assert.equal(calls,1);
 const fallback=(async()=>Response.json({results:[work]})) as typeof fetch;
 assert.equal(await verifiedPopularity({id:"1803.10122",title:"Hi-MoE"},fallback),undefined);
 assert.equal(await verifiedPopularity({id:"1803.10123",title:"World Models"},fallback),undefined);
});
test("missing DOI alias gets one bounded search; rate limits never trigger an extra request",async()=>{
 const work={title:"World Models",locations:[{landing_page_url:"https://arxiv.org/abs/1803.10122"}],cited_by_count:123};let calls=0;
 const fallback=(async()=>++calls===1?new Response(null,{status:404}):Response.json({results:[work]})) as typeof fetch;
 assert.equal((await verifiedPopularity({id:"1803.10122",title:"World Models"},fallback))?.citedByCount,123);assert.equal(calls,2);
 calls=0;const limited=(async()=>{calls++;return new Response(null,{status:429});}) as typeof fetch;
 assert.equal(await verifiedPopularity({id:"1803.10122",title:"World Models"},limited),undefined);assert.equal(calls,1);
});

test("full retained follow-ups do not call discovery providers or a model",async()=>{
 const {recommend}=await import("../worker/recommendations");const s=initialState();s.entries={};s.feedback=[];s.jobs=[];
 const p=ensurePreferences(s);s.recommendations=s.papers.slice(0,3).map(p=>rec(p.id));
 const dir=await mkdtemp(path.join(os.tmpdir(),"afterimage-full-refill-"));
 const model:DiscoveryModel=async()=>{throw Error("Unnecessary model call");};
 try {const result=await recommend({...s,job:{id:"r",type:"recommend",status:"running",createdAt:new Date().toISOString(),attempts:1,
 recommendationMode:"refill",preferenceRevision:p.revision}},dir,model);assert.deepEqual(result.result.recommendations,[]);assert.deepEqual(result.newPaperIds,[]);}
 finally {await rm(dir,{recursive:true,force:true});}
});
test("short canonical queries avoid the unseeded linear-attention retrieval failure",()=>{
 const p=ensurePreferences(initialState());p.interests.forEach(i=>i.strength=i.id==="linear-attention"?"normal":"off");
 const queries=planInterestSearches(p,[]);assert.deepEqual(queries,[{query:"linear attention",lane:"relevance"},{query:"gated delta",lane:"recent"}]);
 p.interests.forEach(i=>i.strength=i.id==="world-models"?"normal":"stronger");
 assert.ok(planInterestSearches(p,[]).some(q=>q.query==="world models"&&q.lane==="recent"));
});
