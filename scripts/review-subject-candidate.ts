import {createHash} from "node:crypto";
import {mkdir,readFile,rename,writeFile,open,unlink} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {subjectLessonSchema,subjectPublicLessonSchema,validateSubjectLesson,type PublishedLesson} from "../src/lib/subjects";
import {validateSubjectMath} from "../src/lib/subject-math";
import {hasSubstantiveSourceBody} from "../src/lib/source-extraction";
import {subjectPublicationDigest,publishSubjectLesson} from "../src/lib/subject-publication";
import {subjectPatchSchema,applySubjectPatch} from "../src/lib/subject-repair";
import {experimentContracts} from "../src/lib/subject-experiments";
import {requireCleanSubjectReview} from "../src/lib/subject-review";
import {subjectModel} from "../worker/subject-model";
import {selectSubjectEvidence} from "../worker/subject-evidence";
import {assertSubjectPrimarySources} from "../src/lib/subject-editorial";
import {rebindSubjectMechanism} from "./refine-subject-prose";
import {subjectMechanismSchema,publishedSubjectMechanismSchema,validateSubjectMechanism} from "../src/lib/subject-mechanism";
import {subjectMechanismRendererDigest,validateMechanismMath} from "../src/lib/subject-mechanism-store";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const checkSchema=z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)});
const reviewSchema=z.object({science:checkSchema,teaching:checkSchema,experiments:checkSchema,quiz:checkSchema});
const contextSchema=z.object({scope:z.literal("full-text"),extractionVersion:z.string().optional(),capturedAt:z.string().optional(),sources:z.array(z.object({id:z.string(),label:z.string(),url:z.string().url(),excerpt:z.string().min(1).max(20000)})).min(1)});

export async function reviewSubjectCandidate(args:string[]){
  const id=args[args.indexOf("--id")+1];
  if(!args.includes("--id")||!/^[a-z0-9-]+$/.test(id||""))throw Error("Use one allowlisted --id");
  const catalog=JSON.parse(await readFile("src/content/subjects/catalog.json","utf8"));
  const entry=catalog.entries.find((item:{id:string})=>item.id===id);if(!entry)throw Error("Unknown catalog identity");
  const privateRoot=path.resolve(".artifacts/subjects",id),requested=args[args.indexOf("--candidate")+1];
  if(!args.includes("--candidate"))throw Error("Explicit private --candidate is required");
  const candidateFile=path.resolve(requested);
  if(!candidateFile.startsWith(privateRoot+path.sep)||!candidateFile.endsWith(".json"))throw Error("Candidate must belong to this lesson's private audit directory");
  const file=path.resolve("src/content/subjects/lessons",id+".json"),baselineBytes=await readFile(file,"utf8").catch(()=>null);
  const baseline=baselineBytes?JSON.parse(baselineBytes) as PublishedLesson:null;
  if(baseline&&baseline.review.contentDigest!==subjectPublicationDigest(subjectPublicLessonSchema.parse(baseline),baseline))throw Error("Published baseline binding is invalid");
  const mechanismFile=path.resolve("src/content/subjects/mechanisms",id+".json"),mechanismBytes=await readFile(mechanismFile,"utf8").catch(()=>null);
  let mechanismContext=null;
  if(baseline&&mechanismBytes){
    const mechanism=publishedSubjectMechanismSchema.parse(JSON.parse(mechanismBytes));
    if(mechanism.parentContentDigest===baseline.review.contentDigest){validateSubjectMechanism(mechanism,baseline,baseline.sources);validateMechanismMath(mechanism,baseline);mechanismContext=subjectMechanismSchema.parse(mechanism);}
  }
  const mechanismRendererDigest=mechanismContext?await subjectMechanismRendererDigest():null;
  const rootContextFile=path.join(privateRoot,"evidence.json"),rootContextBytes=await readFile(rootContextFile,"utf8");
  const contextFile=args.includes("--evidence")?path.resolve(args[args.indexOf("--evidence")+1]):rootContextFile;
  if(!contextFile.startsWith(privateRoot+path.sep)||!contextFile.endsWith(".json"))throw Error("Evidence must belong to this lesson's private audit directory");
  const contextBytes=await readFile(contextFile,"utf8"),context=contextSchema.parse(JSON.parse(contextBytes));
  if(!hasSubstantiveSourceBody(context.sources))throw Error("Substantive primary body required");
  assertSubjectPrimarySources(entry.arxivId,context.sources);
  if(baseline&&baseline.sources.some(source=>!context.sources.some(primary=>primary.id===source.id&&primary.url===source.url&&hash(primary.excerpt)===source.digest)))throw Error("Published source binding differs from cached primary context");
  let lesson=subjectLessonSchema.parse(JSON.parse(await readFile(candidateFile,"utf8")));
  const directory=path.join(privateRoot,"candidate-review",new Date().toISOString().replace(/[:.]/g,"-"));await mkdir(directory,{recursive:true});
  const lock=path.join(privateRoot,"candidate-review.lock"),handle=await open(lock,"wx");await handle.close();
  const implementationFiles=["src/lib/subject-experiments.ts","src/components/subject-experiment.tsx"];
  const implementationDigests=await Promise.all(implementationFiles.map(async file=>hash(await readFile(file,"utf8"))));
  const sourceIds=context.sources.map(source=>source.id) as [string,...string[]];
  const common=`\nPUBLIC PRIMARY EVIDENCE:\n${JSON.stringify(context)}\nEXACT AUTHORED EXPERIMENT CONTRACTS:\n${JSON.stringify(experimentContracts)}\nSOURCE-REVIEWED OPTIONAL MECHANISM:\n${JSON.stringify(mechanismContext)}`;
  let findings="",signature=hash(JSON.stringify(lesson.claims.map(({evidence,...claim})=>claim)));
  try{
    for(let attempt=0;attempt<5;attempt++){
      try{
        if(attempt){
          const patch=await subjectModel(`Repair only these substantive defects in the original educational candidate. Preserve correct text, stable claim identities, figure contracts and quiz answers unless a specific scientific finding requires correction. Return complete affected fields with their exact bounds. Sections use zero-based array paths: use the supplied immutable ID-to-index mapping instead of interpreting a section's name as its array index. Do not copy one chapter's correct body over a different chapter. Do not generate quotations; host passage selection handles changed claims. If a compound ledger statement has no adequate bounded local anchor, narrow it to the relevant supported scientific proposition while preserving separately supported prose; do not add unrelated clauses. Use balanced KaTeX expressions, double-escape each LaTeX backslash in JSON, and never emit control characters. Explain scientific assumptions and result conditions naturally. Do not narrate excerpt acquisition, omitted appendices, unavailable implementation inventories or pipeline limitations.\nSECTION IDENTITIES:\n${JSON.stringify(lesson.sections.map((section,index)=>({id:section.id,index,title:section.title})))}\nFINDINGS:\n${findings}\nCANDIDATE:\n${JSON.stringify(lesson)}${common}`,subjectPatchSchema(lesson,sourceIds,{allowEvidenceUpdates:false,allowClaimLinks:true}),directory,`repair-${attempt}`);
          lesson=applySubjectPatch(lesson,patch,sourceIds);
          const next=hash(JSON.stringify(lesson.claims.map(({evidence,...claim})=>claim)));
          if(next!==signature||/evidence|passage|attribution/i.test(findings)){lesson=await selectSubjectEvidence(lesson,context.sources,directory,`evidence-${attempt}`,findings);signature=next;}
        }
        validateSubjectLesson(lesson,context.sources);validateSubjectMath(lesson);
        await writeFile(path.join(directory,`candidate-${attempt}.json`),JSON.stringify(lesson,null,2));
        const review=await subjectModel(`Independently audit this complete original educational lesson against its public primary paper. Check every load-bearing ledger statement, exact private evidence attribution, equation, tiny calculation, result's dataset/model/optimization conditions and experimental comparison. Check all sections, every quiz answer and distractor, and each numerical figure against its exact implemented contract. Preserve meaningful scientific qualifiers; a bound or asymptotic approximation must not become an unsupported finite-case guarantee. Confirm the method is actually explained. Require natural scientific teaching instead of inventories of unimplemented details or claims about missing supplied excerpts. Do not demand reproduction of every implementation default or turn a source-acquisition limitation into a paper limitation. All four checks pass only with zero substantive findings. Reject unsupported science, mathematics, mechanism/control promises or quiz conclusions, with precise actionable field identities; stylistic preferences are not scientific errors.\nFULL CANDIDATE:\n${JSON.stringify(lesson)}${common}`,reviewSchema,directory,`review-${attempt}`);
        requireCleanSubjectReview(review);
        if(await readFile(file,"utf8").catch(()=>null)!==baselineBytes||await readFile(contextFile,"utf8")!==contextBytes||await readFile(rootContextFile,"utf8")!==rootContextBytes)throw Error("Parent or primary context changed during review");
        if(await readFile(mechanismFile,"utf8").catch(()=>null)!==mechanismBytes)throw Error("Mechanism changed during review");
        if(mechanismRendererDigest&&await subjectMechanismRendererDigest()!==mechanismRendererDigest)throw Error("Mechanism renderer changed during review");
        const current=await Promise.all(implementationFiles.map(async file=>hash(await readFile(file,"utf8"))));if(current.some((value,index)=>value!==implementationDigests[index]))throw Error("Experiment implementation changed during review");
        const sources=context.sources.map(source=>baseline?.sources.find(previous=>previous.id===source.id)??({id:source.id,label:source.label,url:source.url,digest:hash(source.excerpt),extractionVersion:context.extractionVersion,capturedAt:context.capturedAt}));
        const publication=publishSubjectLesson(lesson,{id,createdAt:baseline?.createdAt??new Date().toISOString(),pipelineVersion:baseline?.pipelineVersion??"subjects-lessons-v1",sources});
        const canRebind=baseline&&mechanismContext&&JSON.stringify(baseline.claims)===JSON.stringify(publication.claims)&&JSON.stringify(baseline.sources)===JSON.stringify(publication.sources);
        const rebound=canRebind?rebindSubjectMechanism(JSON.parse(mechanismBytes!),baseline,publication,mechanismRendererDigest!):null;
        await writeFile(path.join(directory,"review-binding.json"),JSON.stringify({reviewedAt:new Date().toISOString(),candidateDigest:hash(JSON.stringify(lesson)),parentFileDigest:baselineBytes?hash(baselineBytes):null,primaryContextDigest:hash(contextBytes),implementationDigests,checks:review,publicationDigest:publication.review.contentDigest},null,2));
        if(args.includes("--publish")){
          if(contextFile!==rootContextFile){await writeFile(path.join(directory,"previous-root-evidence.json"),rootContextBytes);await writeFile(rootContextFile+".candidate.tmp",contextBytes);await rename(rootContextFile+".candidate.tmp",rootContextFile);}
          await writeFile(path.join(privateRoot,"recovery-99-candidate.json"),JSON.stringify(lesson,null,2));
          await writeFile(file+".candidate.tmp",JSON.stringify(publication,null,2)+"\n");await rename(file+".candidate.tmp",file);
          if(rebound){
            await writeFile(mechanismFile+".candidate.tmp",JSON.stringify(rebound,null,2)+"\n");await rename(mechanismFile+".candidate.tmp",mechanismFile);
            await writeFile(path.join(directory,"mechanism-rebind.json"),JSON.stringify({previousParentDigest:baseline!.review.contentDigest,nextParentDigest:publication.review.contentDigest,contentDigest:rebound.review.contentDigest,rendererDigest:rebound.review.rendererDigest,visualApprovalReset:true},null,2));
          }
          console.log(`PUBLISHED ${id}: ${publication.review.contentDigest}`);
        }else console.log(`REVIEWED ${id}: private candidate`);
        return;
      }catch(error){findings=(error as Error).message;await writeFile(path.join(directory,`defects-${attempt}.json`),JSON.stringify({at:new Date().toISOString(),error:findings}));if(/changed during review|Subject model step failed|Subject model returned/.test(findings))throw error;console.log(`REPAIR ${id} ${attempt+1}: ${findings.slice(0,180)}`);}
    }
    throw Error("Independent review exhausted four repairs; existing publication retained");
  }finally{await unlink(lock);}
}
if(process.argv[1]?.endsWith("review-subject-candidate.ts"))reviewSubjectCandidate(process.argv.slice(2)).catch(error=>{console.error((error as Error).message);process.exitCode=1;});
