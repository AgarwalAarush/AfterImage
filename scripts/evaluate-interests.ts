import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { initialState } from "../src/lib/catalog";
import { ensurePreferences,normalizeInterestText,recordChoice } from "../src/lib/preferences";
import { interestSuggestionInput,interestSuggestionResultSchema,sufficientInterestEvidence,type InterestSuggestionResult } from "../src/lib/interest-suggestions";
import { discoverInterests } from "../worker/interest-discovery";
import { discoveryModel } from "../worker/discovery-model";
import type { AppState,Paper } from "../src/lib/types";

/** Constructed public-only fixtures. This runner never reads owner state, .env files, cookies or storage. */
const fixtures = [
  {id:"synthetic-neuro-1",group:"neuroscience",title:"Hippocampal replay during sleep",abstract:"Hippocampal replay consolidates spatial memories during sleep. Repeated sequences of neuronal activity represent previously experienced locations and support memory consolidation."},
  {id:"synthetic-neuro-2",group:"neuroscience",title:"Replay and memory consolidation",abstract:"Hippocampal replay supports long-term memory consolidation. Reactivation of neuronal sequences after learning coordinates the stabilization of spatial memories."},
  {id:"synthetic-battery-1",group:"battery chemistry",title:"Sodium-ion battery electrolytes",abstract:"Sodium-ion battery electrolytes influence ion transport and cycle stability. Electrolyte salts and solvents regulate the electrode interface during repeated charging."},
  {id:"synthetic-battery-2",group:"battery chemistry",title:"Electrolyte design for sodium-ion cells",abstract:"Sodium-ion battery electrolytes determine interfacial chemistry and cycling stability. Solvent coordination affects sodium transport and the formation of the electrode interphase."},
  {id:"synthetic-robot-1",group:"robotics",title:"Tactile robotic manipulation",abstract:"Tactile sensing improves robotic manipulation of deformable objects. Contact feedback allows a gripper to adapt force while an object changes shape."},
  {id:"synthetic-robot-2",group:"robotics",title:"Touch-guided robotic grasping",abstract:"Tactile sensing supports robotic manipulation under visual occlusion. Contact observations guide grasp adjustments when cameras cannot observe the contact surface."},
] as const;
const names = ["mixed-unseen-fields","neuroscience-only","ignored-and-off","sparse-unrelated","changing-tastes","subtopic-under-parent"] as const;
type TrialName = typeof names[number];
const artifactRoot = path.resolve(".artifacts/interest-discovery-evaluation");
const base = initialState().papers[0];
function fixture(name: TrialName) {
  const s=initialState(),at=new Date().toISOString();
  s.papers=fixtures.map(({id,title,abstract}) => ({...base,id,arxivId:id,title,abstract,authors:"Synthetic public evaluation fixture",year:2026,
    topics:[],recall:null,scene:null,study:undefined,sources:[],generationStatus:"idle"} satisfies Paper));
  s.entries={};s.feedback=[];s.jobs=[];s.recommendations=[];s.preferences=undefined;
  s.direction={goal:"",questions:"",topics:[]};
  const profile=ensurePreferences(s);profile.enabled=true;profile.interests=[];
  const ids = name==="neuroscience-only" ? [0,1] : name==="sparse-unrelated" ? [0,2] : name==="changing-tastes" ? [0,1,4,5] : name==="subtopic-under-parent" ? [4,5] : [0,1,2,3,4,5];
  s.papers=ids.map(index=>s.papers[index]);
  for(const paper of s.papers)recordChoice(s,{id:`fixture-save-${paper.id}`,paperId:paper.id,kind:"save",at});
  if(name==="ignored-and-off") {
    profile.interests=[{id:"synthetic-off-neuro",label:"Hippocampal replay",strength:"off",aliases:["Replay and memory consolidation"]}];
    profile.interestDiscovery={version:1,pending:[],ignored:[{key:"sodium ion battery electrolytes",label:"Sodium-ion battery electrolytes",aliases:["Electrolyte design for sodium-ion cells"],at}],decisions:{},receipts:[]};
  }
  if(name==="changing-tastes")recordChoice(s,{id:"fixture-rejected-earlier",paperId:"synthetic-neuro-2",kind:"feedback",value:"irrelevant",at});
  if(name==="subtopic-under-parent")profile.interests=[{id:"synthetic-parent",label:"Robotics",strength:"normal",aliases:[]}];
  return s;
}
function assertResult(name: TrialName, s:AppState, input:ReturnType<typeof interestSuggestionInput>, result:InterestSuggestionResult) {
  const candidates=interestSuggestionResultSchema.parse(result).candidates;
  assert.ok(candidates.length<=5,"Exceeded bounded suggestion count");
  if(name==="sparse-unrelated")assert.equal(candidates.length,0,"Unrelated singleton topics must not create a catch-all interest");
  else assert.ok(candidates.length>0,"No suggestions survived for a strongly recurring supported theme");
  const canonical=new Map(input.papers.map(paper=>[paper.id,paper]));
  const seen=new Set<string>();
  const banned=new Set([...input.interests,...input.ignored].flatMap(topic=>[topic.label,...topic.aliases]).map(normalizeInterestText));
  for(const candidate of candidates) {
    const identities=new Set([candidate.label,...candidate.aliases].map(normalizeInterestText));
    for(const identity of identities) {
      assert.ok(!seen.has(identity),"Duplicate interest label or alias");
      assert.ok(!banned.has(identity),"Accepted/Off/ignored identity returned");
      seen.add(identity);
    }
    const ids=candidate.evidence.map(e=>e.paperId);
    // Drafts may repeat passages; the publishable result must normalize to one card per source.
    assert.equal(new Set(ids).size,ids.length,"Normalized result repeated paper evidence");
    const sources=ids.map(id=>canonical.get(id));
    assert.ok(sources.every(Boolean),"Excluded or unsupported paper ID entered a suggestion");
    assert.ok(sufficientInterestEvidence(sources as typeof input.papers),"Insufficient positive evidence");
    for(const e of candidate.evidence) {
      const paper=canonical.get(e.paperId)!;
      assert.ok(`${paper.title}\n${paper.abstract}`.includes(e.quote),"Unsupported quote survived grounding");
    }
    const groups=new Set(ids.map(id=>fixtures.find(p=>p.id===id)?.group));
    assert.equal(groups.size,1,"Suggestion combines unrelated fields into a generic catch-all");
    if(name==="neuroscience-only")assert.deepEqual([...groups],["neuroscience"]);
    if(["ignored-and-off","changing-tastes","subtopic-under-parent"].includes(name))assert.deepEqual([...groups],["robotics"],"Excluded earlier themes returned instead of the supported emerging theme");
  }
  if(name==="changing-tastes")assert.ok(!input.papers.some(p=>p.id==="synthetic-neuro-2"),"Rejected paper was sent as positive evidence");
  assert.deepEqual(s.entries,{},"Interest discovery created a Library entry");
  assert.deepEqual(s.jobs,[],"Interest discovery queued generation or other work");
  assert.deepEqual(s.recommendations,[],"Interest discovery implicitly generated recommendations");
}
async function trial(name:TrialName) {
  const s=fixture(name),input=interestSuggestionInput(s),before=JSON.stringify({entries:s.entries,jobs:s.jobs,recommendations:s.recommendations});
  const dir=path.join(artifactRoot,name);await mkdir(dir,{recursive:true,mode:0o700});
  await writeFile(path.join(dir,"input.json"),JSON.stringify({fixture:"constructed public synthetic metadata; not real paper identities",...input},null,2),{mode:0o600});
  let calls=0;
  const model:typeof discoveryModel=async(prompt,schema,folder,label)=>{
    assert.ok(++calls<=2,"Exceeded two model calls in one trial");
    return discoveryModel("PUBLIC SYNTHETIC EVALUATION: All paper identities, titles and abstracts below are constructed research fixtures. Evaluate only these supplied relationships; do not browse or infer real papers.\n"+prompt,schema,folder,label);
  };
  const result=await discoverInterests(input,dir,model);
  await writeFile(path.join(dir,"result.json"),JSON.stringify({calls,...result},null,2),{mode:0o600});
  assertResult(name,s,input,result.interestSuggestions);
  assert.equal(JSON.stringify({entries:s.entries,jobs:s.jobs,recommendations:s.recommendations}),before,"Implicit state mutation");
  const summary={trial:name,passed:true,calls,labels:result.interestSuggestions.candidates.map(candidate=>candidate.label)};
  console.log(JSON.stringify(summary));return summary;
}
async function main() {
  if(!process.argv.includes("--run"))throw new Error("Use --run for six bounded public synthetic interest trials (up to two model calls per trial).");
  const requested=process.argv.find(arg=>arg.startsWith("--case="))?.slice(7);
  if(requested&&!names.includes(requested as TrialName))throw new Error("Unknown trial name");
  const selected=names.filter(name=>!requested||requested===name),results:{trial:string;passed:boolean;calls?:number;labels?:string[];error?:string}[]=[];
  // At most two concurrent trials, each with at most two structured model calls.
  async function lane(start:number) {
    for(let index=start;index<selected.length;index+=2) {
      const name=selected[index];
      try {results.push(await trial(name));}
      catch(error) {const message=error instanceof Error?error.message:String(error);results.push({trial:name,passed:false,error:message});console.error(`${name}: ${message}`);}
    }
  }
  await Promise.all([lane(0),lane(1)]);
  results.sort((a,b)=>names.indexOf(a.trial as TrialName)-names.indexOf(b.trial as TrialName));
  await mkdir(artifactRoot,{recursive:true,mode:0o700});
  await writeFile(path.join(artifactRoot,requested?`trial-${requested}.json`:"trials.json"),JSON.stringify(results,null,2),{mode:0o600});
  if(results.some(result=>!result.passed)||results.length!==selected.length)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
