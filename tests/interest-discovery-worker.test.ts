import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initialState } from "../src/lib/catalog";
import { canonicalFeatures, ensurePreferences } from "../src/lib/preferences";
import { discoverInterests } from "../worker/interest-discovery";
import { groundSelections, planInterestSearches, type DiscoveryModel } from "../worker/recommendations";
import { rankRecommendations } from "../worker/recommendation-ranking";

const source = (id: string, title: string, abstract: string) => ({id,title,abstract,metadataDigest:canonicalFeatures({title,abstract}).digest,signal:1,explicit:true});
const sources = [
  source("2601.00001", "Hippocampal replay during sleep", "Hippocampal replay consolidates spatial memories during sleep."),
  source("2601.00002", "Replay and memory consolidation", "Hippocampal replay supports long-term memory consolidation."),
  source("2601.00003", "Sodium-ion battery electrolytes", "Sodium-ion battery electrolytes influence ion transport and cycle stability."),
  source("2601.00004", "Electrolyte design for sodium-ion cells", "Sodium-ion battery electrolytes determine interfacial chemistry and cycling stability."),
  source("2601.00005", "Tactile robotic manipulation", "Tactile sensing improves robotic manipulation of deformable objects."),
  source("2601.00006", "Touch-guided robotic grasping", "Tactile sensing supports robotic manipulation under visual occlusion."),
];
const topic = (label: string, pair: number[]) => ({label,aliases:[] as string[],reason:`A shared research theme in ${label.toLowerCase()}.`, evidence:pair.map(i=>({paperId:sources[i].id,quote:sources[i].abstract}))});
const topics = [topic("Hippocampal replay",[0,1]),topic("Sodium-ion battery electrolytes",[2,3]),topic("Tactile robotic manipulation",[4,5])];
const input = () => ({digest:"1".repeat(64),papers:structuredClone(sources),interests:[] as {id:string;label:string;strength:"normal"|"off";aliases:string[]}[],ignored:[] as {label:string;aliases:string[]}[]});
const review = (candidates: typeof topics) => ({reviews:candidates.map(candidate=>({label:candidate.label,topicSupported:true,aliasesSupported:true,distinctFromExisting:true,reasonSupported:true,
  evidence:candidate.evidence.map(e=>({...e,metadataDigest:sources.find(p=>p.id===e.paperId)!.metadataDigest,supported:true})),issues:[]}))});
async function inDir(run: (dir:string)=>Promise<void>) {
  const dir=await mkdtemp(path.join(os.tmpdir(),"afterimage-interest-worker-"));
  try {await run(dir);} finally {await rm(dir,{recursive:true,force:true});}
}

test("novel neuroscience, chemistry and robotics topics emerge without a fixed vocabulary",async()=>inDir(async dir=>{
  const data=input(),before=structuredClone(data),calls:string[]=[];
  const model:DiscoveryModel=async(_prompt,schema,_dir,name)=>{calls.push(name);return schema.parse(name==="interest-draft"?{candidates:topics}:review(topics));};
  const result=await discoverInterests(data,dir,model);
  assert.deepEqual(result.interestSuggestions.candidates.map(c=>c.label),topics.map(t=>t.label));
  assert.deepEqual(data,before);assert.deepEqual(calls,["interest-draft","interest-review"]);
  assert.deepEqual(Object.keys(result),["interestSuggestions"]);
}));

test("invalid topic or reading claims fail while unsupported optional aliases are removed",async()=>inDir(async dir=>{
  const invented=topic("Quantum entanglement",[0,1]);
  const unsupportedAlias={...topics[1],aliases:["Lithium-ion electrolyte chemistry"]};
  const candidates=[invented,unsupportedAlias,topics[2]];
  const model:DiscoveryModel=async(_prompt,schema,_dir,name)=> {
    if(name==="interest-draft")return schema.parse({candidates});
    const result=review(candidates);
    result.reviews[0].topicSupported=false;result.reviews[1].aliasesSupported=false;result.reviews[2].reasonSupported=false;
    return schema.parse(result);
  };
  const result=await discoverInterests(input(),dir,model);
  assert.deepEqual(result.interestSuggestions.candidates,[topics[1]]);
  assert.equal("droppedAliases" in result.interestSuggestions,false);
  const receipt=JSON.parse(await readFile(path.join(dir,"interest-discovery-receipt.json"),"utf8"));
  assert.deepEqual(receipt.droppedAliases,[{label:topics[1].label,aliases:unsupportedAlias.aliases}]);
}));

test("accepted, Off, ignored aliases, duplicate topics and fabricated source evidence are suppressed",async()=>inDir(async dir=>{
  const data=input();data.interests=[{id:"off",label:"Hippocampal replay",strength:"off",aliases:[]}];
  data.ignored=[{label:"Battery chemistry",aliases:["Sodium-ion battery electrolytes"]}];
  let passedToReview:unknown;const fake={...topics[2],label:"Visual grasping",evidence:[topics[2].evidence[0],{paperId:sources[5].id,quote:"This text was never in either source."}]};
  const model:DiscoveryModel=async(prompt,schema,_dir,name)=>{
    if(name==="interest-draft")return schema.parse({candidates:[...topics,topics[2],fake]});
    passedToReview=JSON.parse(prompt.split("DATA:\n")[1]).candidates;return schema.parse(review([topics[2]]));
  };
  assert.deepEqual((await discoverInterests(data,dir,model)).interestSuggestions.candidates,[topics[2]]);
  assert.deepEqual(passedToReview,[topics[2]]);
}));

test("a single paper, negative signals and weak passive evidence never produce interests",async()=>inDir(async dir=>{
  const one=input();one.papers=one.papers.slice(0,1);
  await discoverInterests(one,dir,async()=>{throw Error("A single paper must not invoke the model");});
  const data=input();data.papers[0].signal=-.5;data.papers[2].signal=.25;data.papers[3].signal=.25;data.papers[2].explicit=false;data.papers[3].explicit=false;
  const single={...topics[2],evidence:[topics[2].evidence[0],topics[2].evidence[0]]};let calls=0;
  const model:DiscoveryModel=async(_prompt,schema)=>{calls++;return schema.parse({candidates:[topics[0],topics[1],single]});};
  assert.deepEqual((await discoverInterests(data,dir,model)).interestSuggestions.candidates,[]);assert.equal(calls,1);
}));

test("review identity mismatch or missing evidence fails without an unbounded retry",async()=>inDir(async dir=>{
  let calls=0;
  const model:DiscoveryModel=async(_prompt,schema,_dir,name)=>{
    calls++;if(name==="interest-draft")return schema.parse({candidates:topics.slice(0,2)});
    const result=review(topics.slice(0,2));result.reviews[0].evidence[0].metadataDigest="0".repeat(64);result.reviews[1].evidence[1].supported=false;
    return schema.parse(result);
  };
  assert.deepEqual((await discoverInterests(input(),dir,model)).interestSuggestions.candidates,[]);assert.equal(calls,2);
}));

test("six query lanes rotate fairly across many independent interests and age ranges",()=>{
  const profile=ensurePreferences(initialState());profile.interests=Array.from({length:10},(_,i)=>({id:`custom-${i}`,label:`Research field ${i}`,strength:"normal" as const}));
  profile.interests[3].strength="off";
  const seen=new Set<string>();
  for(let cycle=0;cycle<3;cycle++) {
    const searches=planInterestSearches(profile,[],cycle);assert.equal(searches.length,6);
    for(const q of searches)seen.add(`${q.query}:${q.lane}`);
  }
  assert.equal(seen.size,18);assert.ok(![...seen].some(key=>key.startsWith("Research field 3:")));
  for(const interest of profile.interests.filter(i=>i.strength!=="off"))for(const lane of ["relevance","recent"])assert.ok(seen.has(`${interest.label}:${lane}`));
});

test("broad manual interests support nonliteral matches only with canonical evidence and semantic review",async()=>{
  const state=initialState(),profile=ensurePreferences(state);
  profile.interests=[{id:"ai-biology",label:"AI for biology",strength:"normal"}];
  const paper={...state.papers[0],id:"genomics",title:"A neural sequence model of gene expression",abstract:"A neural network predicts gene expression from DNA sequence."};
  const rec={paperId:paper.id,relevance:.9,nextStep:.9,thread:"main" as const,interestId:"ai-biology",role:"Gene regulation",reason:paper.abstract,focus:"Neural sequence models",depth:"Technical"};
  assert.equal(rankRecommendations([rec],{},new Set(),{profile,papers:[paper]}).length,0);
  const grounded={...rec,interestEvidence:[paper.abstract]};
  const picks=rankRecommendations([grounded],{},new Set(),{profile,papers:[paper]});assert.equal(picks.length,1);
  const model:DiscoveryModel=async(_prompt,schema)=>schema.parse({reviews:[{paperId:paper.id,canonicalTitle:paper.title,metadataDigest:canonicalFeatures(paper).digest,
    identity:true,reason:true,focus:true,interest:true,reasonEvidence:[paper.abstract],focusEvidence:[paper.title],interestEvidence:[paper.abstract],issues:[]}]});
  assert.equal((await groundSelections(picks,[paper],model,"unused",new Map([[paper.id,{id:"ai-biology",label:"AI for biology"}]]))).picks.length,1);
  profile.interests[0].strength="off";assert.equal(rankRecommendations([grounded],{},new Set(),{profile,papers:[paper]}).length,0);
});

test("disabled semantic interests cannot return through a broader active label",async()=>{
  const paper={...initialState().papers[0],id:"genomics",title:"A neural sequence model of gene expression",abstract:"A neural network predicts gene expression from DNA sequence."};
  const rec={paperId:paper.id,role:"Gene regulation",reason:paper.abstract,focus:"Neural sequence models",depth:"Technical"};
  let reviews=0;
  const model:DiscoveryModel=async(prompt,schema,_dir,name)=>{
    if(name.startsWith("ground-repair"))return schema.parse({recommendations:[rec]});
    assert.match(prompt,/disabledInterests/);reviews++;
    return schema.parse({reviews:[{paperId:paper.id,canonicalTitle:paper.title,metadataDigest:canonicalFeatures(paper).digest,
      identity:true,reason:true,focus:true,interest:true,respectsDisabledInterests:false,reasonEvidence:[paper.abstract],focusEvidence:[paper.title],interestEvidence:[paper.abstract],issues:["Primarily concerns the disabled genomics interest."]}]});
  };
  const result=await groundSelections([rec],[paper],model,"unused",new Map([[paper.id,{id:"ai",label:"Artificial intelligence"}]]),[{id:"genomics",label:"Computational genomics"}]);
  assert.equal(result.picks.length,0);assert.equal(reviews,2);assert.ok(result.verdicts.every(v=>!v.respectsDisabledInterests));
});

test("saved evidence remains eligible after implicit signal decay",async()=>inDir(async dir=>{
  const data=input();data.papers[0].signal=.72;data.papers[1].signal=.51;
  const model:DiscoveryModel=async(_prompt,schema,_dir,name)=>schema.parse(name==="interest-draft"?{candidates:[topics[0]]}:review([topics[0]]));
  assert.deepEqual((await discoverInterests(data,dir,model)).interestSuggestions.candidates,[topics[0]]);
}));

test("multiple excerpts per source normalize to two distinct canonical evidence cards",async()=>inDir(async dir=>{
  const candidate={...topics[0],evidence:[
    {paperId:sources[0].id,quote:"This unsupported excerpt must be skipped."},
    {paperId:sources[0].id,quote:sources[0].abstract},
    {paperId:sources[0].id,quote:sources[0].title},
    {paperId:sources[1].id,quote:sources[1].abstract},
    {paperId:sources[1].id,quote:sources[1].title},
  ]};
  let passedToReview:unknown,calls=0;
  const model:DiscoveryModel=async(prompt,schema,_dir,name)=>{
    calls++;
    if(name==="interest-draft")return schema.parse({candidates:[candidate]});
    passedToReview=JSON.parse(prompt.split("DATA:\n")[1]).candidates;
    return schema.parse(review([topics[0]]));
  };
  const result=await discoverInterests(input(),dir,model);
  assert.deepEqual(result.interestSuggestions.candidates,[topics[0]]);
  assert.deepEqual(passedToReview,[topics[0]]);assert.equal(calls,2);
  assert.equal(result.interestSuggestions.candidates[0].evidence.length,2);
}));
