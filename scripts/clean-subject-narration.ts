import {createHash} from "node:crypto";
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {restoreAuditLedger} from "./refine-subject-prose";
import {reviewSubjectCandidate} from "./review-subject-candidate";
import {assertSubjectPrimarySources,applySubjectNarrationEdits,subjectNarrationFindings} from "../src/lib/subject-editorial";
import {subjectPublicLessonSchema,validateSubjectLesson,type PublishedLesson} from "../src/lib/subjects";
import {subjectPublicationDigest} from "../src/lib/subject-publication";
import {experimentContracts} from "../src/lib/subject-experiments";
import {subjectModel} from "../worker/subject-model";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const excluded=new Set(["geometry-of-noise","diffusionblocks","t5","whisper","mastering-atari-go-chess-and-shogi","mastering-chess-and-shogi-by-self","megatron-lm","nerf-representing-scenes-as-neural-radiance","resnet","soft-actor-critic-off-policy-maximum","trust-region-policy-optimization","you-only-look-once-unified-real","zero-memory-optimizations-toward-training-trillion","decision-transformer-reinforcement-learning-via-sequence"]);
const contextSchema=z.object({scope:z.literal("full-text"),sources:z.array(z.object({id:z.string(),label:z.string(),url:z.string().url(),excerpt:z.string().max(20000)})).min(1)});
const inventory=/\b(?:not (?:a|an|the|measured|full|actual|real|implemented)|does not (?:simulate|implement|execute|measure|represent)|cannot (?:predict|measure|simulate)|makes no (?:runtime|memory))\b[^.!?\n]{0,240}(?:benchmark|kernel|allocator|implementation|head|simulation|latency|memory|algorithm|accuracy|throughput|measurement)/i;

async function main(){
  const args=process.argv.slice(2);
  if(!args.includes("--run"))throw Error("Explicit --run required; this workflow sends original drafts and public arXiv excerpts for review");
  const concurrency=args.includes("--concurrency")?Number(args[args.indexOf("--concurrency")+1]):2;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>2)throw Error("Concurrency must be 1 or 2");
  const auditFile=args.includes("--audit")?path.resolve(args[args.indexOf("--audit")+1]??""):path.resolve(".artifacts/subjects/editorial-audit/classified-pipeline-narration-final99.json");
  if(!auditFile.startsWith(path.resolve(".artifacts/subjects/editorial-audit")+path.sep)||!auditFile.endsWith(".json"))throw Error("Explicit audit must belong to the private editorial audit directory");
  const audit=JSON.parse(await readFile(auditFile,"utf8")) as {findings:{id:string;section:string;owner:string;sentences?:string[]}[]};
  const targets=new Map<string,Set<string>>();
  for(const finding of audit.findings){if(finding.owner!=="available"||excluded.has(finding.id))continue;if(!targets.has(finding.id))targets.set(finding.id,new Set());targets.get(finding.id)!.add(finding.section);}
  const requested=args.includes("--id")?args[args.indexOf("--id")+1]:null;
  if(args.includes("--id")&&(!requested||!targets.has(requested)))throw Error("Identity is outside the assigned editorial set");
  if(requested)for(const id of targets.keys())if(id!==requested)targets.delete(id);
  const catalog=JSON.parse(await readFile("src/content/subjects/catalog.json","utf8"));
  const directory=path.resolve(".artifacts/subjects/narration-cleanups",new Date().toISOString().replace(/[:.]/g,"-"));await mkdir(directory,{recursive:true});
  const statuses:Record<string,string>=Object.fromEntries([...targets.keys()].map(id=>[id,"pending"]));let statusWrites=Promise.resolve();
  const save=()=>{const snapshot=JSON.stringify({updatedAt:new Date().toISOString(),concurrency,statuses},null,2);statusWrites=statusWrites.then(()=>writeFile(path.join(directory,"run.json"),snapshot));return statusWrites;};await save();
  async function clean(id:string,selected:Set<string>){
    statuses[id]="editing";await save();console.log(`CLEAN ${id}`);
    const privateRoot=path.resolve(".artifacts/subjects",id),working=path.join(privateRoot,"narration-cleanup",path.basename(directory));await mkdir(working,{recursive:true});
    try{
      const file=path.resolve("src/content/subjects/lessons",id+".json"),parentBytes=await readFile(file,"utf8"),parent=JSON.parse(parentBytes) as PublishedLesson;
      if(parent.review.contentDigest!==subjectPublicationDigest(subjectPublicLessonSchema.parse(parent),parent))throw Error("Invalid published baseline");
      for(const section of parent.sections){if(section.figureId&&inventory.test(section.markdown))selected.add(section.id);}
      if(id==="flashattention-fast-and-memory-efficient-exact")for(const section of ["s2","s4","s7","s8"])selected.add(section);
      const sectionIds=[...selected].filter(identity=>{const section=parent.sections.find(section=>section.id===identity)!;return subjectNarrationFindings(section.markdown).length||inventory.test(section.markdown)||id==="flashattention-fast-and-memory-efficient-exact";});
      if(!sectionIds.length){statuses[id]="already-clean";await save();return;}
      const rawContext=JSON.parse(await readFile(path.join(privateRoot,"evidence.json"),"utf8")),context=contextSchema.parse(rawContext);
      assertSubjectPrimarySources(catalog.entries.find((entry:{id:string})=>entry.id===id).arxivId,context.sources);
      if(parent.sources.some(source=>!context.sources.some(primary=>primary.id===source.id&&primary.url===source.url&&hash(primary.excerpt)===source.digest)))throw Error("Primary source binding differs from published parent");
      const files=(await readdir(privateRoot)).filter(name=>/^(?:draft|recovery)-\d+(?:-candidate)?\.json$/.test(name)).sort().reverse();
      const ledger=restoreAuditLedger(parent,await Promise.all(files.map(file=>readFile(path.join(privateRoot,file),"utf8").then(JSON.parse).catch(()=>null))),context.sources);
      const schema=z.object({updates:z.array(z.object({sectionId:z.enum(sectionIds as [string,...string[]]),markdown:z.string().min(400).max(10000)})).length(sectionIds.length)});
      const updates=await subjectModel(`Edit exactly these selected sections: ${sectionIds.join(", ")}. Replace source-acquisition narration such as supplied excerpts, missing appendices and inventories of unspecified implementations with the actual scientific interpretation. In figure chapters replace repetitive defensive lists about absent simulation/benchmarks with a natural explanation of the calculation, declared constructed quantities, units, control effect and relationship to the actual method. Preserve correct equations, benchmark/model/data/optimization conditions and substantive paragraphs. Do not turn asymptotic or qualified results into universal guarantees. Do not silently remove a needed method detail: if the provided public primary content cannot support an essential explanation, retain the correct scientific scope and explain only what it supports. No captions or repetitive lists of unimplemented things. Original claim ledger, sources, figures and quiz remain immutable. Use balanced KaTeX $inline$ and $$display$$ expressions; double-escape each LaTeX backslash in JSON and never emit control characters. Return one complete Markdown body for every selected section. Other sections remain unchanged.\nORIGINAL LESSON:\n${JSON.stringify(ledger)}\nPUBLIC PRIMARY EVIDENCE:\n${JSON.stringify(context)}\nIMPLEMENTED FIGURE CONTRACTS:\n${JSON.stringify(experimentContracts)}`,schema,working,"edit-0");
      const candidate=applySubjectNarrationEdits(ledger,sectionIds,updates.updates);validateSubjectLesson(candidate,context.sources);
      if(await readFile(file,"utf8")!==parentBytes)throw Error("Parent changed during candidate preparation");
      const candidateFile=path.join(working,"candidate-proposed.json");await writeFile(candidateFile,JSON.stringify(candidate,null,2));
      await writeFile(path.join(working,"manifest.json"),JSON.stringify({id,sections:sectionIds,parentFileDigest:hash(parentBytes),candidateDigest:hash(JSON.stringify(candidate)),independentReview:null,published:false},null,2));
      statuses[id]="reviewing";await save();
      await reviewSubjectCandidate(["--id",id,"--candidate",candidateFile,"--publish"]);
      statuses[id]="published";console.log(`CLEANED ${id}`);
    }catch(error){statuses[id]="failed";await writeFile(path.join(working,"failure.json"),JSON.stringify({at:new Date().toISOString(),error:(error as Error).message}));console.log(`FAILED ${id}: ${(error as Error).message.slice(0,180)}`);}
    await save();
  }
  const entries=[...targets.entries()];let cursor=0;await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<entries.length){const [id,selected]=entries[cursor++];await clean(id,selected);}}));
  await statusWrites;console.log(JSON.stringify(statuses));if(Object.values(statuses).includes("failed"))process.exitCode=1;
}
if(process.argv[1]?.endsWith("clean-subject-narration.ts"))main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
