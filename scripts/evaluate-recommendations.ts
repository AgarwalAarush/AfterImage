import { readFileSync } from "node:fs";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { initialState } from "../src/lib/catalog";
import { ensurePreferences,recordChoice } from "../src/lib/preferences";
import { recommend } from "../worker/recommendations";
import { discoveryModel } from "../worker/discovery-model";
import { importPaper } from "../src/lib/papers";
import { publishRecommendations,excludedRecommendations,recommendationReceiptSchema } from "../src/lib/recommendations";
import type { Paper,Recommendation } from "../src/lib/types";
/** Public-only evaluations. Never read owner state, environment files, API cookies or storage. */
const cases = ["mixed","unseeded-mixed","unseeded-world","unseeded-linear","refill-moe-pair","refill-mixed",
 "reject-netops","reject-routing","already-known","prerequisite","changing-tastes","revision-change"];
const fixture = JSON.parse(readFileSync("tests/fixtures/recommendation-public.json","utf8"));
const base = initialState().papers[0];
const papers: Paper[] = fixture.map((p: Partial<Paper>) => ({...base,...p,arxivId:p.id!,topics:[],recall:null,scene:null,sources:[],generationStatus:"idle"}));
const pick = (paperId: string): Recommendation => ({paperId,role:"Retained",reason:"Previously selected in this synthetic fixture.",focus:"Method",depth:"Technical"});
async function trial(name: string,index: number) {
 const s=initialState();s.papers=structuredClone(papers);s.entries={};s.feedback=[];s.jobs=[];s.recommendations=[];
 s.direction={goal:"Explore mixture-of-experts routing, linear attention and world models as independent research interests.",questions:"Mechanisms and systems tradeoffs",topics:[],updatedAt:"public-fixture"};
 const p=ensurePreferences(s);p.enabled=true;
 const at=new Date().toISOString();
 if (name.includes("world")) {p.interests.forEach(i=>i.strength=i.id==="world-models"?"stronger":"off");s.direction.goal="Study world models, learned dynamics and planning.";}
 if (name.includes("linear")) {p.interests.forEach(i=>i.strength=i.id==="linear-attention"?"stronger":"off");s.direction.goal="Study linear attention and recurrent sequence architectures.";}
 if(name==="refill-moe-pair")s.recommendations=[pick("2510.26692"),pick("2412.19437")];
 if(name==="refill-mixed")s.recommendations=[pick("2510.26692"),pick("2301.04104")];
 if(name==="reject-netops") {const net=await importPaper("2605.12729");s.papers.push(net);recordChoice(s,{id:"synthetic-netops-rejection",paperId:net.id,kind:"feedback",value:"irrelevant",at});}
 if(name==="reject-routing")recordChoice(s,{id:"synthetic-routing-rejection",paperId:"2511.06494",kind:"feedback",value:"irrelevant",at});
 if(name==="already-known")recordChoice(s,{id:"synthetic-known",paperId:"2301.04104",kind:"feedback",value:"known",at});
 if(name==="prerequisite")recordChoice(s,{id:"synthetic-advanced",paperId:"2412.19437",kind:"feedback",value:"advanced",at});
 if(name==="changing-tastes")p.interests.forEach(i=>i.strength=i.id==="world-models"?"stronger":"off");
 const unseeded=name.startsWith("unseeded");if(unseeded)s.papers=[];
 const job={id:`public-${index}`,type:"recommend" as const,status:"running" as const,createdAt:at,attempts:1,
   preferenceRevision:p.revision,...(name.startsWith("refill")?{recommendationMode:"refill" as const}:{})};s.jobs=[job];
 const dir=path.resolve(".artifacts/recommendation-learning",name);await mkdir(dir,{recursive:true});
 const model: typeof discoveryModel = async (prompt,schema,folder,label) => {
   const result=await discoveryModel(prompt,schema,folder,label);
   if(unseeded&&label==="scout") (result as {arxivIds:string[]}).arxivIds=[];
   return result;
 };
 const before=JSON.stringify({entries:s.entries,jobs:s.jobs});
 const resolve=async(id:string)=>{
   const paper=await importPaper(id);
   await writeFile(path.join(dir,`canonical-${id.replaceAll("/","_")}.json`),JSON.stringify({id:paper.id,title:paper.title,abstract:paper.abstract,year:paper.year}));
   return paper;
 };
 const result=await recommend({...s,job},dir,model,{resolve});
 await writeFile(path.join(dir,"result.json"),JSON.stringify(result,null,2));
 recommendationReceiptSchema.parse(result.receipt);
 const ids=result.result.recommendations.map(r=>r.paperId),excluded=excludedRecommendations(s);
 if(ids.length>3-s.recommendations.length)throw new Error("Refill exceeded actual vacancies");
 if(new Set(ids).size!==ids.length||ids.some(id=>excluded.has(id)))throw new Error("Duplicate/exclusion violation");
 if(JSON.stringify({entries:s.entries,jobs:s.jobs})!==before)throw new Error("Implicit generation or Library mutation");
 if(!ids.length)throw new Error("No eligible recommendations for supported public interests");
 if(result.receipt.grounding.filter(v=>ids.includes(v.paperId)).some(v=>v.attempt===2&&!v.identity))throw new Error("Identity mismatch survived review");
 if(unseeded&&!result.report.discoveredCount)throw new Error("Unseeded retrieval produced no candidates");
 if(name==="revision-change") {p.revision++;publishRecommendations(s,result.result.recommendations,job,at,()=>"follow-up");
   if(s.recommendations.length||s.jobs.filter(j=>j.status==="queued").length!==1)throw new Error("Stale profile publication");}
 await writeFile(path.join(dir,"result.json"),JSON.stringify(result,null,2));
 console.log(JSON.stringify({trial:name,passed:true,picks:ids,discovered:result.report.discoveredCount,assessed:result.receipt.ranking.length,grounding:result.receipt.grounding.length}));
}
async function main(){
 if(!process.argv.includes("--run"))throw new Error("Use --run for 12 bounded public-only model trials");
 const requested=process.argv.find(a=>a.startsWith("--case="))?.slice(7);
 const results:{trial:string;passed:boolean;error?:string}[]=[];
 async function lane(start:number){
  for(let i=start;i<cases.length;i+=2){const name=cases[i];if(requested&&requested!==name)continue;
   try{await trial(name,i);results.push({trial:name,passed:true});}
   catch(e){results.push({trial:name,passed:false,error:(e as Error).message});console.error(`${name}: ${(e as Error).message}`);}
  }
 }
 await Promise.all([lane(0),lane(1)]);
 results.sort((a,b)=>cases.indexOf(a.trial)-cases.indexOf(b.trial));
 await mkdir(".artifacts/recommendation-learning",{recursive:true});
 await writeFile(`.artifacts/recommendation-learning/${requested ? `trial-${requested}` : "trials"}.json`,JSON.stringify(results,null,2));
 if(results.some(r=>!r.passed)||(!requested&&results.length!==12))process.exitCode=1;
}
main().catch(e=>{console.error((e as Error).message);process.exitCode=1;});
