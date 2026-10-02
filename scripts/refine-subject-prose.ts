import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireCleanSubjectReview } from "../src/lib/subject-review";
import { sourcesFromHtml,SOURCE_EXTRACTION_VERSION } from "../src/lib/source-extraction";
import type { Paper } from "../src/lib/types";
import { experimentContracts } from "../src/lib/subject-experiments";
import { validateSubjectMath } from "../src/lib/subject-math";
import { publishSubjectLesson, subjectPublicationDigest } from "../src/lib/subject-publication";
import { subjectLessonSchema, subjectPublicLessonSchema, validateSubjectLesson, type PublishedLesson, type SubjectLesson } from "../src/lib/subjects";
import { subjectModel } from "../worker/subject-model";
import { publishedSubjectMechanismSchema, subjectMechanismSchema, validateSubjectMechanism } from "../src/lib/subject-mechanism";
import { mechanismDigest, subjectMechanismRendererDigest, validateMechanismMath } from "../src/lib/subject-mechanism-store";

const digest=(text:string)=>createHash("sha256").update(text).digest("hex");
const evidenceSchema=z.object({scope:z.literal("full-text"),sources:z.array(z.object({id:z.string(),label:z.string(),url:z.string(),excerpt:z.string()})).min(1)});
const reviewSchema=z.object({
  science:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)}),
  teaching:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)}),
  experiments:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)}),
  quiz:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)}),
});

/** Recover audit quotations from an unchanged private ledger, never from inference. */
export function restoreAuditLedger(published:PublishedLesson,privateDrafts:unknown[],sources?:{id:string;excerpt:string}[]):SubjectLesson{
  const publicContent=subjectPublicLessonSchema.parse(published);
  const drafts=privateDrafts.map(value=>subjectLessonSchema.safeParse(value)).filter(result=>result.success).map(result=>result.data!);
  const claims=publicContent.claims.map(claim=>{
    for(const draft of drafts){
      const original=draft.claims.find(candidate=>candidate.id===claim.id);
      if(!original)continue;
      const {evidence,...publicClaim}=original;
      if(JSON.stringify(publicClaim)===JSON.stringify(claim)&&(!sources||original.sourceIds.some(id=>sources.find(source=>source.id===id)?.excerpt.includes(evidence))))return {...claim,evidence};
    }
    throw new Error(`No unchanged private evidence ledger for ${claim.id}`);
  });
  return subjectLessonSchema.parse({...publicContent,claims});
}

/** Prose refinements cannot change figures, relationships, equations elsewhere, or answers. */
export function applySectionRefinements(lesson:SubjectLesson,updates:{sectionId:string;markdown:string}[],sectionIds?:string[]):SubjectLesson{
  if(sectionIds?.some(id=>!lesson.sections.some(section=>section.id===id)))throw new Error("Unknown explicitly selected section");
  const allowed=new Set(sectionIds??lesson.sections.filter(section=>section.figureId!==null).map(section=>section.id));
  const seen=new Set<string>(),next=structuredClone(lesson);
  for(const update of updates){
    if(!allowed.has(update.sectionId)||seen.has(update.sectionId))throw new Error("Invalid or duplicate experiment-section refinement");
    seen.add(update.sectionId);
    next.sections.find(section=>section.id===update.sectionId)!.markdown=update.markdown;
  }
  return subjectLessonSchema.parse(next);
}

/** An explicit editorial removal clears exactly its section anchor and leaves other evidence intact. */
export function dropSubjectFigure(lesson:SubjectLesson,figureId:string):SubjectLesson{
  if(!lesson.figures.some(figure=>figure.id===figureId))throw new Error("Unknown explicitly removed figure");
  return subjectLessonSchema.parse({...lesson,figures:lesson.figures.filter(figure=>figure.id!==figureId),sections:lesson.sections.map(section=>section.figureId===figureId?{...section,figureId:null}:section)});
}
export function dropSubjectFigures(lesson:SubjectLesson,figureIds:string[]){
  if(!figureIds.length||new Set(figureIds).size!==figureIds.length)throw new Error("Explicit figure removal requires unique identities");
  return figureIds.reduce((candidate,id)=>dropSubjectFigure(candidate,id),lesson);
}

/** A local author can prepare selected prose and appendix-backed claim corrections before review. */
export function applyAuthoredSubjectRefinement(base:SubjectLesson,input:unknown,sectionIds:string[],appendixIds:string[]=[]){
  const candidate=subjectLessonSchema.parse(input),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  for(const field of ["title","summary","prerequisites","objectives","figures","quiz"] as const){if(!same(base[field],candidate[field]))throw new Error(`Authored refinement changed immutable ${field}`);}
  if(base.sections.length!==candidate.sections.length||base.claims.length!==candidate.claims.length)throw new Error("Authored refinement changed lesson identities");
  for(const [i,section] of base.sections.entries()){
    const next=candidate.sections[i];
    if(!sectionIds.includes(section.id)){if(!same(section,next))throw new Error("Authored refinement changed an unselected section");continue;}
    for(const field of ["id","title","claimIds","figureId"] as const){if(!same(section[field],next[field]))throw new Error("Authored refinement changed section relationships");}
    if(section.sourceIds.filter(id=>!appendixIds.includes(id)).some(id=>!next.sourceIds.includes(id))||next.sourceIds.some(id=>!section.sourceIds.includes(id)&&!appendixIds.includes(id)))throw new Error("Authored refinement changed primary source references");
  }
  for(const [i,claim] of base.claims.entries()){
    const next=candidate.claims[i];if(same(claim,next))continue;
    if(!appendixIds.length||!same([claim.id,claim.kind,claim.statement],[next.id,next.kind,next.statement])||claim.sourceIds.some(id=>!next.sourceIds.includes(id))||next.sourceIds.some(id=>!claim.sourceIds.includes(id)&&!appendixIds.includes(id))||!next.sourceIds.some(id=>appendixIds.includes(id)))throw new Error("Authored refinement changed an unsupported claim");
  }
  return candidate;
}

/** Prose-only changes can retain the source-reviewed scene, but always require a new visual acceptance. */
export function rebindSubjectMechanism(input:unknown,previous:PublishedLesson,next:PublishedLesson,rendererDigest:string){
  if(previous.id!==next.id||JSON.stringify(previous.claims)!==JSON.stringify(next.claims)||JSON.stringify(previous.sources)!==JSON.stringify(next.sources))throw new Error("Mechanism rebind requires unchanged source and claim identities");
  const mechanism=publishedSubjectMechanismSchema.parse(input);
  if(mechanism.lessonId!==previous.id||mechanism.parentContentDigest!==previous.review.contentDigest||mechanism.review.contentDigest!==mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(mechanism))))throw new Error("Mechanism rebind baseline mismatch");
  validateSubjectMechanism(mechanism,next,next.sources);validateMechanismMath(mechanism,next);
  return {...mechanism,parentContentDigest:next.review.contentDigest,review:{...mechanism.review,status:"source-passed" as const,rendererDigest,visualReviewedAt:null}};
}

async function main(){
  const args=process.argv.slice(2),lessonsRoot=path.resolve("src/content/subjects/lessons"),privateRoot=path.resolve(".artifacts/subjects");
  if(!args.includes("--all")&&!args.includes("--id"))throw new Error("Use --all or --id <reviewed lesson identity>");
  const requested=args[args.indexOf("--id")+1];
  if(args.includes("--id")&&!/^[a-z0-9-]+$/.test(requested||""))throw new Error("Invalid lesson identity");
  const sectionIds=args.includes("--sections")?args[args.indexOf("--sections")+1]?.split(","):undefined;
  const dropFigure=args.includes("--drop-figure")?args[args.indexOf("--drop-figure")+1]:undefined;
  const dropFigures=args.includes("--drop-figures")?args[args.indexOf("--drop-figures")+1]?.split(","):dropFigure?[dropFigure]:[];
  const appendixIds=args.includes("--appendix-ids")?args[args.indexOf("--appendix-ids")+1]?.split(","):undefined;
  const candidateFile=args.includes("--candidate-file")?args[args.indexOf("--candidate-file")+1]:undefined;
  if(args.includes("--candidate-file")&&(!candidateFile||!args.includes("--id")||!sectionIds||!path.resolve(candidateFile).startsWith(privateRoot+path.sep)))throw new Error("Authored candidate must be a private Subjects file with explicit lesson and sections");
  if(appendixIds&&(!args.includes("--id")||!sectionIds||new Set(appendixIds).size!==appendixIds.length||appendixIds.some(id=>!/^appendix-\d+(?:-part-\d+)?$/.test(id))))throw new Error("Appendix capture requires one --id and explicit --sections");
  if((sectionIds||dropFigures?.length)&&(!args.includes("--id")||args.includes("--all")))throw new Error("Explicit section selection and figure removal require one --id");
  if(sectionIds&&(!sectionIds.length||sectionIds.some(id=>!/^[a-z0-9-]+$/.test(id))||new Set(sectionIds).size!==sectionIds.length))throw new Error("Invalid explicit section identities");
  if(args.includes("--drop-figure")&&!/^[a-z0-9-]+$/.test(dropFigure||""))throw new Error("Invalid explicit figure identity");
  if(args.includes("--drop-figures")&&(!dropFigures?.length||dropFigures.some(id=>!/^[a-z0-9-]+$/.test(id))||new Set(dropFigures).size!==dropFigures.length||args.includes("--drop-figure")))throw new Error("Invalid explicit figure identities");
  const files=(await readdir(lessonsRoot)).filter(name=>/^[a-z0-9-]+\.json$/.test(name)&&(!args.includes("--id")||name===requested+".json")).sort();
  if(!files.length)throw new Error("No reviewed lesson matches this request");
  const concurrencyFlag=args.includes("--concurrency")?Number(args[args.indexOf("--concurrency")+1]):1;
  if(!Number.isInteger(concurrencyFlag)||concurrencyFlag<1||concurrencyFlag>3)throw new Error("Concurrency must be 1–3");
  const experimentFiles=["src/lib/subject-experiments.ts","src/components/subject-experiment.tsx"];
  const experimentDigests=await Promise.all(experimentFiles.map(file=>readFile(file,"utf8").then(digest)));
  const statuses:Record<string,string>={},runDirectory=path.join(privateRoot,"prose-refinements",new Date().toISOString().replace(/[:.]/g,"-"));
  await mkdir(runDirectory,{recursive:true});
  let statusWrites=Promise.resolve();
  function save(){const snapshot=JSON.stringify({updatedAt:new Date().toISOString(),statuses},null,2);statusWrites=statusWrites.then(()=>writeFile(path.join(runDirectory,"run.json"),snapshot));return statusWrites;}
  async function refine(name:string){
    const id=name.slice(0,-5),file=path.join(lessonsRoot,name),sourceDirectory=path.join(privateRoot,id),directory=path.join(runDirectory,id);
    await mkdir(directory,{recursive:true});
    statuses[id]="reviewing";await save();console.log(`REFINE ${id}`);
    const lock=path.join(sourceDirectory,"prose-refinement.lock");let ownsLock=false;
    try{
      const handle=await open(lock,"wx");await handle.close();ownsLock=true;
      const baselineBytes=await readFile(file,"utf8"),published=JSON.parse(baselineBytes) as PublishedLesson;
      const publicContent=subjectPublicLessonSchema.parse(published);
      if(published.id!==id||published.review.status!=="passed"||published.review.contentDigest!==subjectPublicationDigest(publicContent,published))throw new Error("Published lesson review digest mismatch");
      const context=evidenceSchema.parse(JSON.parse(await readFile(path.join(sourceDirectory,"evidence.json"),"utf8")));
      for(const source of published.sources){
        const excerpt=context.sources.find(candidate=>candidate.id===source.id);
        if(!excerpt||excerpt.url!==source.url||source.digest!==digest(excerpt.excerpt))throw new Error("Private source provenance differs from published review");
      }
      const names=(await readdir(sourceDirectory)).filter(candidate=>/^(?:draft|recovery)-\d+(?:-candidate)?\.json$/.test(candidate)).sort().reverse();
      const privateDrafts=await Promise.all(names.map(candidate=>readFile(path.join(sourceDirectory,candidate),"utf8").then(JSON.parse).catch(()=>null)));
      let lesson=restoreAuditLedger(published,privateDrafts,context.sources);
      validateSubjectLesson(lesson,context.sources);validateSubjectMath(lesson);
      const publicationSources=[...published.sources];
      if(appendixIds){
        const arxivId=new URL(published.sources[0].url).pathname.match(/\/(?:abs|html)\/(\d{4}\.\d{4,5})/)?.[1];
        if(!arxivId)throw new Error("Appendix capture requires a public arXiv primary identity");
        const html=await readFile(path.join(sourceDirectory,"appendix-source.html"),"utf8");
        const captured=sourcesFromHtml({arxivId,sources:[context.sources[0]]} as Paper,html);
        const additions=appendixIds.map(identity=>{
          const source=captured.find(candidate=>candidate.id===identity);
          if(!source||source.url!==`https://arxiv.org/html/${arxivId}#${new URL(source.url).hash.slice(1)}`||context.sources.some(existing=>existing.id===identity))throw new Error("Missing, duplicate or invalid public appendix source");
          return source;
        });
        context.sources.push(...additions);
        const capturedAt=new Date().toISOString();
        publicationSources.push(...additions.map(source=>({id:source.id,label:source.label,url:source.url,digest:digest(source.excerpt),extractionVersion:SOURCE_EXTRACTION_VERSION,capturedAt})));
        lesson.sections=lesson.sections.map(section=>sectionIds!.includes(section.id)?{...section,sourceIds:[...new Set([...section.sourceIds,...appendixIds])]}:section);
        await writeFile(path.join(directory,"supplement-evidence.json"),JSON.stringify(context,null,2));
        await writeFile(path.join(directory,"supplement-capture.json"),JSON.stringify({publicArxivId:arxivId,htmlDigest:digest(html),appendixIds,capturedAt},null,2));
      }
      if(dropFigures?.length)lesson=dropSubjectFigures(lesson,dropFigures);
      if(sectionIds?.some(id=>!lesson.sections.some(section=>section.id===id)))throw new Error("Unknown explicitly selected section");
      if(candidateFile)lesson=applyAuthoredSubjectRefinement(lesson,JSON.parse(await readFile(path.resolve(candidateFile),"utf8")),sectionIds!,appendixIds);
      const sections=lesson.sections.filter(section=>sectionIds?sectionIds.includes(section.id):section.figureId!==null);
      const patchSchema=z.object({updates:z.array(z.object({sectionId:z.enum(sections.map(section=>section.id) as [string,...string[]]),markdown:z.string().min(400).max(10000)})).max(sections.length)});
      const mechanismFile=path.resolve("src/content/subjects/mechanisms",id+".json");
      const mechanismBytes=await readFile(mechanismFile,"utf8").catch(()=>null);
      let mechanismContext=null;
      if(mechanismBytes){const candidate=publishedSubjectMechanismSchema.parse(JSON.parse(mechanismBytes));if(candidate.parentContentDigest===published.review.contentDigest){validateSubjectMechanism(candidate,published,published.sources);mechanismContext=subjectMechanismSchema.parse(candidate);}}
      const common=`\nPRIMARY EVIDENCE:\n${JSON.stringify(context)}\nEXACT EXPERIMENT CONTRACTS:\n${JSON.stringify(experimentContracts)}\nSOURCE-REVIEWED OPTIONAL MECHANISM:\n${JSON.stringify(mechanismContext)}`;
      let findings="";
      for(let attempt=0;attempt<4;attempt++){
        if(!candidateFile||attempt>0){
        const patch=await subjectModel(`${appendixIds?"The newly captured primary appendix supplies the missing algorithm details. Explain those details as the paper method, replacing extraction-limit narration. For TRPO, teach the conjugate-gradient direction, maximum quadratic-model step size, and actual-surrogate/actual-KL backtracking acceptance until objective improvement, without inventing shrink ratios or damping defaults.":""} Edit only these selected sections of this original, reviewed lesson: ${sections.map(section=>section.id).join(", ")}. ${dropFigures?.length?`The editor explicitly removed figures ${dropFigures.join(", ")}; remove all explanations of those obsolete figures and their capability disclaimers. Teach the actual paper mechanism instead.`:"Integrate each pictured computation into the actual teaching: define quantities and assumptions and explain what the control changes."} Remove repetitive defensive lists such as 'not an allocator, not a GPU benchmark, not a full simulation'. Do not replace them with a disclaimer under another name. Do not narrate 'supplied excerpts' or inventory unimplemented details. State actual scientific limits with their consequence at the relevant point. Preserve relevant measured units, benchmark conditions and mathematical assumptions, correct substantive paragraphs and equations. Do not invent a retained figure capability, alter diagram contracts or imply a baseline illustration performs the whole algorithm. Do not convert illustrative slot counts into measured bytes or timings. In FlashAttention, distinguish memory-slot examples from actual SRAM score tiles and online normalization; KV allocation is not its contribution. If a source-reviewed mechanism is supplied, connect its symbolic identities to the actual algorithm naturally. Return complete section Markdown replacements only where necessary. Maintain at least 1100 substantive words across the complete lesson and each section's minimum length. Never truncate or pad prose. All untouched fields remain fixed.\nACTIONABLE REVIEW FINDINGS:\n${findings||"Initial editorial pass: replace repetitive warnings with natural explanation of the calculation and mechanism."}\nLESSON:\n${JSON.stringify(lesson)}${common}`,patchSchema,directory,`edit-${attempt}`);
        lesson=applySectionRefinements(lesson,patch.updates,sectionIds);
        }
        await writeFile(path.join(directory,`candidate-${attempt}.json`),JSON.stringify(lesson,null,2));
        try{
          validateSubjectLesson(lesson,context.sources);validateSubjectMath(lesson);
          const review=await subjectModel(`Independently review the full lesson against the primary excerpts. Check every load-bearing claim, exact evidence passage, equation, calculation, benchmark condition and mechanism explanation. Review the correct quiz answer and every distractor explanation. Check each diagram against its EXACT contract. The edited section must state the pictured computation and assumptions naturally; it must not claim the example executes capabilities absent from the contract. An illustrative prerequisite is acceptable when its relationship to the actual contribution is explained. Require concise mechanism teaching instead of repeated defensive disclaimers; do not demand captions or warning lists. Confirm no necessary units, assumptions or scientific distinctions were lost during the edit. Reject substantive scientific/teaching/quiz/experiment defects with actionable section-specific findings, not stylistic preferences. All four checks pass only with no substantive finding.\nFULL LESSON:\n${JSON.stringify(lesson)}${common}`,reviewSchema,directory,`review-${attempt}`);
          requireCleanSubjectReview(review);
          if(await readFile(file,"utf8")!==baselineBytes)throw new Error("Published lesson changed during editorial review; candidate retained privately");
          const currentExperimentDigests=await Promise.all(experimentFiles.map(file=>readFile(file,"utf8").then(digest)));
          if(currentExperimentDigests.some((value,index)=>value!==experimentDigests[index]))throw new Error("Experiment implementation changed during editorial review; candidate retained privately");
          await writeFile(path.join(directory,"review-binding.json"),JSON.stringify({reviewedAt:new Date().toISOString(),lessonDigest:digest(JSON.stringify(lesson)),baselineFileDigest:digest(baselineBytes),sources:publicationSources,experimentDigests:Object.fromEntries(experimentFiles.map((file,index)=>[file,experimentDigests[index]])),checks:review},null,2));
          if(args.includes("--no-publish")){statuses[id]="reviewed-candidate";await save();console.log(`REVIEWED ${id} (private candidate)`);return;}
          const next=publishSubjectLesson(lesson,{id:published.id,createdAt:published.createdAt,pipelineVersion:published.pipelineVersion,sources:publicationSources});
          let rebound=null;
          if(mechanismBytes){
            if(await readFile(mechanismFile,"utf8")!==mechanismBytes)throw new Error("Mechanism changed during editorial review; candidate retained privately");
            if(!appendixIds)rebound=rebindSubjectMechanism(JSON.parse(mechanismBytes),published,next,await subjectMechanismRendererDigest());
          }
          if(appendixIds){
            await writeFile(path.join(sourceDirectory,"evidence.json.supplement.tmp"),JSON.stringify(context,null,2));
            await rename(path.join(sourceDirectory,"evidence.json.supplement.tmp"),path.join(sourceDirectory,"evidence.json"));
            await writeFile(path.join(sourceDirectory,"recovery-99-candidate.json"),JSON.stringify(lesson,null,2));
          }
          await writeFile(file+".refinement.tmp",JSON.stringify(next,null,2)+"\n");await rename(file+".refinement.tmp",file);
          if(rebound){await writeFile(mechanismFile+".refinement.tmp",JSON.stringify(rebound,null,2)+"\n");await rename(mechanismFile+".refinement.tmp",mechanismFile);await writeFile(path.join(directory,"mechanism-rebind.json"),JSON.stringify({previousParentDigest:published.review.contentDigest,nextParentDigest:next.review.contentDigest,contentDigest:rebound.review.contentDigest,rendererDigest:rebound.review.rendererDigest,visualApprovalReset:true},null,2));}
          statuses[id]="refined";await save();console.log(`REFINED ${id}`);return;
        }catch(error){
          findings=(error as Error).message;await writeFile(path.join(directory,`defects-${attempt}.json`),JSON.stringify({at:new Date().toISOString(),error:findings}));
          if(findings.startsWith("Published lesson changed")||findings.startsWith("Experiment implementation changed")||findings.startsWith("Mechanism changed"))throw error;
          console.log(`REPAIR ${id}: ${findings.slice(0,160)}`);
        }
      }
      throw new Error("Editorial review exhausted; published lesson untouched");
    }catch(error){statuses[id]="failed";await writeFile(path.join(directory,"failure.json"),JSON.stringify({at:new Date().toISOString(),error:(error as Error).message}));await save();console.log(`FAILED ${id}: ${(error as Error).message.slice(0,160)}`);}
    finally{if(ownsLock)await unlink(lock);}
  }
  let cursor=0;await Promise.all(Array.from({length:concurrencyFlag},async()=>{while(cursor<files.length)await refine(files[cursor++]);}));
  await statusWrites;console.log(JSON.stringify(statuses));if(Object.values(statuses).some(status=>status==="failed"))process.exitCode=1;
}
if(process.argv[1]?.endsWith("refine-subject-prose.ts"))main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
