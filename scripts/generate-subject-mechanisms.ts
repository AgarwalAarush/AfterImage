import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireCleanSubjectReview } from "../src/lib/subject-review";
import { subjectMechanismSchema, publishedSubjectMechanismSchema, validateSubjectMechanism, type SubjectMechanism } from "../src/lib/subject-mechanism";
import { mechanismDigest, subjectMechanismRendererDigest, validateMechanismMath } from "../src/lib/subject-mechanism-store";
import { subjectPublicLessonSchema, validateSubjectLesson, type PublishedLesson } from "../src/lib/subjects";
import { subjectPublicationDigest } from "../src/lib/subject-publication";
import { restoreAuditLedger } from "./refine-subject-prose";
import { subjectModel } from "../worker/subject-model";

const contextSchema=z.object({scope:z.literal("full-text"),sources:z.array(z.object({id:z.string(),label:z.string(),url:z.string(),excerpt:z.string()})).min(1)});
const reviewSchema=z.object({science:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)}),teaching:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)}),states:z.object({passed:z.boolean(),findings:z.array(z.string()).max(12)})});
const concisePrompt="\nWrite the takeaway as ONE complete sentence under180 characters, preferably plain text: state the scientific invariant without repeating the full equations. Use introduction under500 characters, entity meanings under110, object details under35, and beat explanations under750. These preferred targets leave generous headroom below the schema maximum. Never fill a bound and cut the final words or math delimiters. Put full mathematical detail in the relevant beat narration.";
async function repairMechanismLabels(mechanism:SubjectMechanism,findings:string,directory:string,name:string){
  const paths=["takeaway","introduction",...mechanism.objects.flatMap((_,index)=>[`objects.${index}.label`,`objects.${index}.detail`]),...mechanism.entities.flatMap((_,index)=>[`entities.${index}.label`,`entities.${index}.meaning`]),...mechanism.relationships.map((_,index)=>`relationships.${index}.label`),...mechanism.beats.flatMap((_,index)=>[`beats.${index}.title`,`beats.${index}.explanation`])];
  const patchSchema=z.object({updates:z.array(z.object({path:z.enum(paths as [string,...string[]]),value:z.string().min(1).max(1200)})).min(1).max(32)});
  const patch=await subjectModel(`Repair only the named diagram labels/details or incomplete prose. Preserve every scientific identity, state snapshot, relationship and correct explanatory paragraph unchanged. Return complete concise English labels or noun phrases. Object labels are at most26 characters, object detail phrases at most50 (prefer under35), entity aliases at most8 with no spaces or cut-off formulas, relationship labels at most30, beat titles at most70. Entity meanings must be complete sentences under150 characters; takeaway a complete sentence under300; introduction under650; changed beat explanations under1000. Condense meaning rather than cutting a phrase. No dangling articles, prepositions, punctuation, incomplete parentheses or multilingual filler. Use aliases such as Qcur/Qold/SOT/TRANS and rely on the existing narration for full definitions. Repair every corrupted object detail, not just the examples quoted in findings. Do not change source-specific conditions or numeric claims.\nFINDINGS:\n${findings}\nSEMANTIC SCENE:\n${JSON.stringify(mechanism)}`,patchSchema,directory,name);
  const next=structuredClone(mechanism),seen=new Set<string>();
  for(const update of patch.updates){if(seen.has(update.path))throw new Error("Repeated mechanism label patch");seen.add(update.path);const parts=update.path.split(".");let owner:unknown=next;for(const part of parts.slice(0,-1))owner=(owner as Record<string,unknown>)[part];(owner as Record<string,unknown>)[parts.at(-1)!]=update.value;}
  return subjectMechanismSchema.parse(next);
}
export function applyAuthoredMechanismLabels(mechanism:SubjectMechanism,patch:unknown){
  const paths=["title","takeaway","introduction",...mechanism.objects.flatMap((_,index)=>[`objects.${index}.label`,`objects.${index}.detail`]),...mechanism.entities.flatMap((_,index)=>[`entities.${index}.label`,`entities.${index}.meaning`]),...mechanism.beats.flatMap((_,index)=>[`beats.${index}.title`,`beats.${index}.explanation`])];
  const updates=z.object({updates:z.array(z.object({path:z.enum(paths as [string,...string[]]),value:z.string().min(1).max(700)})).min(1).max(32)}).parse(patch);
  const next=structuredClone(mechanism),seen=new Set<string>();
  for(const update of updates.updates){if(seen.has(update.path))throw new Error("Duplicate authored mechanism prose patch");seen.add(update.path);const parts=update.path.split(".");let owner:unknown=next;for(const part of parts.slice(0,-1))owner=(owner as Record<string,unknown>)[part];(owner as Record<string,unknown>)[parts.at(-1)!]=update.value;}
  return subjectMechanismSchema.parse(next);
}
const draftPrompt=`Create one source-grounded, paper-specific mechanism walkthrough for this original lesson. Choose the actual contribution that readers need to see, not a generic prerequisite. Recover the source's identities, dependencies, information available at each operation, and final invariant. Use only the supplied primary excerpts and their exact source IDs. For DQN teach uniform experience replay, reuse and the source's actual Bellman target; do not import target-network schedules or prioritized replay from later papers. For Whisper teach acoustic encoder representations and decoder task/language/timestamp conditioning with an autoregressive output prefix, rather than noise histograms or scaling curves.
Provide 5–8 stable semantic objects with source and ledger references, 4–10 relationships, and 3–6 complete explanatory beats. Objects use only module/vector/tokens/bank vocabulary. At least two objects must carry meaningful symbolic data; a row of operation boxes is insufficient. Entities are named symbolic examples (s, a, r, transition identities, task tokens, language tokens, prefix tokens), never invented measured numbers, probabilities, rewards, performance, or exact model capacities. Label no more than five illustrative entities inside an object. A bank is a displayed example collection, not a numerical capacity measurement. Define every entity's meaning. Keep small SVG labels plain Unicode, no raw LaTeX; use proper dollar math only in introduction, beat explanations and takeaway. Double-escape JSON backslashes.
Each beat explicitly lists every stable object's status and current entity IDs: pending means unavailable and carries no data; active means the current operation/input/output; retained means persistent available information. Show actual state changes such as a replay item arriving, a prior stored transition being selected while the pool survives, or a decoder prefix gaining one token. At least one data-bearing object's entity set must change. Stable entities retain their identity through copy/selection; do not replace a buffer with a new buffer for every operation. Every relationship has a stable ID and an honest operation label. A beat lists only the currently relevant relationships; its entityIds lists unchanged identities present at BOTH endpoints. A transforming computation may carry an empty list and be explained in prose. Never draw an active relationship through a pending endpoint. Do not falsely serialize computations that the paper treats as independent; parallel inputs can be active in the same beat. Shapes and rows are composed by the host; no coordinates, SVG, CSS, HTML or executable assets.
The introduction briefly teaches the example's chosen symbolic setup. Each beat explains what is available, what changes, and why that operation matters in the actual paper. Avoid repetitive captions/disclaimers, stage badges, artificial performance implications or claims of a numerical simulation. Pick the matching existing lesson sectionId so the walkthrough sits in its mechanism discussion. The takeaway states the invariant that the visible changes establish. SourceIds/claimIds must all match the supplied evidence and existing ledger, but their presence alone is not scientific proof. Do not invent facts to fit the object count. Use compact meaningful identities and labels; maintain ordered prefixes when token order matters. NEVER cut off a label, detail, or formula to fit a bound. Every object.detail is a complete concise English noun phrase, preferably under 35 characters (such as 'Uniformly sampled stored transition'), not a sentence squeezed into 50 characters. Avoid dangling articles/prepositions and unrelated multilingual filler. Use complete aliases such as SOT, EN, TRANS, NO-TS, Qold, Qcur, or y, and define the full source-supported token or quantity in entity.meaning and the narration. Entity labels contain no spaces, dangling punctuation, or unbalanced parentheses. Long Whisper control tokens belong in the explanation, with a concise complete alias in the figure.`;

async function main(){
  const args=process.argv.slice(2),lessonsRoot=path.resolve("src/content/subjects/lessons"),destination=path.resolve("src/content/subjects/mechanisms"),privateRoot=path.resolve(".artifacts/subjects/mechanisms");
  await mkdir(destination,{recursive:true});await mkdir(privateRoot,{recursive:true});
  if(args.includes("--approve-visual")){
    const id=args[args.indexOf("--approve-visual")+1],reviewFile=args[args.indexOf("--review-file")+1];
    if(!/^[a-z0-9-]+$/.test(id||"")||!args.includes("--review-file"))throw new Error("Use --approve-visual <identity> --review-file <fingerprint-bound review.json>");
    const file=path.join(destination,id+".json"),mechanism=publishedSubjectMechanismSchema.parse(JSON.parse(await readFile(file,"utf8"))),lesson=JSON.parse(await readFile(path.join(lessonsRoot,id+".json"),"utf8")) as PublishedLesson;
    const report=z.object({contentDigest:z.string(),parentContentDigest:z.string(),rendererDigest:z.string(),passed:z.literal(true),findings:z.array(z.string()).length(0),checkedViews:z.array(z.string().min(5)).min(4),reviewedAt:z.string()}).parse(JSON.parse(await readFile(path.resolve(reviewFile),"utf8")));
    if(report.contentDigest!==mechanism.review.contentDigest||report.parentContentDigest!==mechanism.parentContentDigest||report.parentContentDigest!==lesson.review.contentDigest||report.rendererDigest!==mechanism.review.rendererDigest||report.rendererDigest!==await subjectMechanismRendererDigest())throw new Error("Visual review is stale");
    validateSubjectMechanism(mechanism,lesson,lesson.sources);validateMechanismMath(mechanism,lesson);
    await writeFile(file+".tmp",JSON.stringify({...mechanism,review:{...mechanism.review,status:"passed",visualReviewedAt:report.reviewedAt}},null,2)+"\n");await rename(file+".tmp",file);console.log(`VISUAL PASSED ${id}`);return;
  }
  if(!args.includes("--all")&&!args.includes("--id"))throw new Error("Use --all or --id <identity[,identity]>");
  const ids=args.includes("--id")?args[args.indexOf("--id")+1].split(","):null;
  if(ids?.some(id=>!/^[a-z0-9-]+$/.test(id)))throw new Error("Invalid lesson identity");
  const files=(await readdir(lessonsRoot)).filter(file=>/^[a-z0-9-]+\.json$/.test(file)&&(!ids||ids.includes(file.slice(0,-5)))).sort();
  if(!files.length)throw new Error("No reviewed lessons selected");
  const authoredCandidateFile=args.includes("--candidate-file")?args[args.indexOf("--candidate-file")+1]:undefined;
  if(args.includes("--candidate-file")&&(!authoredCandidateFile||files.length!==1||!path.resolve(authoredCandidateFile).startsWith(path.resolve(".artifacts/subjects")+path.sep)))throw new Error("Authored mechanism must be one private Subjects candidate for a single lesson");
  const concurrency=args.includes("--concurrency")?Number(args[args.indexOf("--concurrency")+1]):1;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw new Error("Concurrency must be 1–3");
  const statuses:Record<string,string>={};let statusWrites=Promise.resolve();
  function save(){const snapshot=JSON.stringify({updatedAt:new Date().toISOString(),statuses},null,2);statusWrites=statusWrites.then(()=>writeFile(path.join(privateRoot,"run.json"),snapshot));return statusWrites;}
  async function generate(file:string){
    const id=file.slice(0,-5),lessonFile=path.join(lessonsRoot,file),evidenceDirectory=path.resolve(".artifacts/subjects",id),directory=path.join(privateRoot,id);await mkdir(directory,{recursive:true});
    statuses[id]="running";await save();console.log(`MECHANISM ${id}`);
    try{
      const rendererDigest=await subjectMechanismRendererDigest();
      const baseline=await readFile(lessonFile,"utf8"),published=JSON.parse(baseline) as PublishedLesson,content=subjectPublicLessonSchema.parse(published);
      if(published.review.status!=="passed"||published.id!==id||published.review.contentDigest!==subjectPublicationDigest(content,published))throw new Error("Parent lesson is not a current reviewed publication");
      try{const existing=publishedSubjectMechanismSchema.parse(JSON.parse(await readFile(path.join(destination,file),"utf8")));if(!authoredCandidateFile&&existing.parentContentDigest===published.review.contentDigest&&existing.review.rendererDigest===rendererDigest&&existing.review.contentDigest===mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(existing)))){statuses[id]=existing.review.status;await save();console.log(`SKIP MECHANISM ${id}`);return;}}catch{}
      const context=contextSchema.parse(JSON.parse(await readFile(path.join(evidenceDirectory,"evidence.json"),"utf8")));
      for(const source of published.sources){const evidence=context.sources.find(item=>item.id===source.id);if(!evidence||evidence.url!==source.url||source.digest!==mechanismDigest(evidence.excerpt))throw new Error("Primary evidence differs from parent source binding");}
      const draftFiles=(await readdir(evidenceDirectory)).filter(name=>/^(?:draft|recovery)-\d+(?:-candidate)?\.json$/.test(name));
      const draft=restoreAuditLedger(published,await Promise.all(draftFiles.map(file=>readFile(path.join(evidenceDirectory,file),"utf8").then(JSON.parse).catch(()=>null))),context.sources);validateSubjectLesson(draft,context.sources);
      const common=`\nPRIMARY EVIDENCE:\n${JSON.stringify(context)}\nREVIEWED LESSON AND PRIVATE SOURCE LEDGER:\n${JSON.stringify(draft)}`;
      let mechanism:SubjectMechanism|undefined,findings="",previous="",initialLabelsRepaired=false;
      if(!authoredCandidateFile&&args.includes("--resume-drafts")){
        const saved=(await readdir(directory)).filter(name=>/^draft-\d+\.json$/.test(name)).sort((a,b)=>Number(b.match(/\d+/)![0])-Number(a.match(/\d+/)![0]));
        for(const name of saved){
          try{
            const candidate=await readFile(path.join(directory,name),"utf8"),parsed=JSON.parse(candidate);
            if(parsed.version===1&&Array.isArray(parsed.objects)&&Array.isArray(parsed.beats)&&Array.isArray(parsed.entities)){previous=candidate;break;}
          }catch{}
        }
        if(previous){
          await writeFile(path.join(directory,"resumed-candidate.json"),previous);
          findings="Recheck every state, source claim and label. Replace cut-off formulas/control-token spellings with complete concise symbolic aliases; retain their full meaning in narration.";
          const defects=(await readdir(directory)).filter(name=>/^defects-\d+\.json$/.test(name)).sort((a,b)=>Number(b.match(/\d+/)![0])-Number(a.match(/\d+/)![0]));
          if(defects[0])findings+="\n"+JSON.parse(await readFile(path.join(directory,defects[0]),"utf8")).error;
        }else{
          previous=await readFile(path.join(directory,"resumed-candidate.json"),"utf8").catch(error=>{if((error as NodeJS.ErrnoException).code==="ENOENT")return "";throw error;});
          if(previous)findings="Resume the preserved complete semantic candidate, repair source/state defects, and keep every label and invariant complete.";
        }
      }
      if(previous&&args.includes("--repair-labels")){
        const relaxed=subjectMechanismSchema.extend({objects:z.array(subjectMechanismSchema.shape.objects.element.extend({detail:z.string().min(1).max(80)})).min(5).max(8)}).parse(JSON.parse(previous));
        mechanism=await repairMechanismLabels(relaxed,findings+"\nRewrite every object.detail as a complete short noun phrase. Repair any cut-off takeaway or entity meaning while preserving the stated science.",directory,"labels-initial");
        previous=JSON.stringify(mechanism);initialLabelsRepaired=true;
      }
      const authoredPatchFile=args.includes("--patch-file")?path.resolve(args[args.indexOf("--patch-file")+1]):args.includes("--use-authored-labels")?path.join(directory,"authored-labels.json"):null;
      const authoredPatch=authoredPatchFile?await readFile(authoredPatchFile,"utf8").catch(error=>{if(args.includes("--use-authored-labels")&&(error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}):null;
      if(previous&&authoredPatch){
        if(args.includes("--patch-file")&&files.length!==1)throw new Error("An authored prose patch must target one named lesson");
        const relaxed=subjectMechanismSchema.extend({objects:z.array(subjectMechanismSchema.shape.objects.element.extend({detail:z.string().min(1).max(100)})).min(5).max(8)}).parse(JSON.parse(previous));
        mechanism=applyAuthoredMechanismLabels(relaxed,JSON.parse(authoredPatch));
        previous=JSON.stringify(mechanism);initialLabelsRepaired=true;
      }
      if(authoredCandidateFile){
        mechanism=subjectMechanismSchema.parse(JSON.parse(await readFile(path.resolve(authoredCandidateFile),"utf8")));
        validateSubjectMechanism(mechanism,published,context.sources);validateMechanismMath(mechanism,published);
        previous=JSON.stringify(mechanism);initialLabelsRepaired=true;
        await writeFile(path.join(directory,"authored-candidate.json"),previous);
      }
      for(let attempt=0;attempt<5;attempt++){
        try{
          const labelOnly=mechanism&&/truncated|corrupted|cut.off|symbols do not fit|Unclosed math delimiter/.test(findings)&&! /Bellman|terminal|source|available|identity|prefix|unsupported|pending/.test(findings);
          mechanism=attempt===0&&initialLabelsRepaired?mechanism!:labelOnly?await repairMechanismLabels(mechanism!,findings+concisePrompt,directory,`labels-${attempt}`):await subjectModel(draftPrompt+concisePrompt+common+(previous?`\nTARGETED REPAIR: Preserve correct identities and relationships while correcting these actionable defects; return the complete repaired semantic scene.\n${findings}\nPREVIOUS SCENE:\n${previous}`:""),subjectMechanismSchema,directory,`draft-${attempt}`);
          if(authoredPatch)mechanism=applyAuthoredMechanismLabels(mechanism,JSON.parse(authoredPatch));
          previous=JSON.stringify(mechanism);
          await writeFile(path.join(directory,`draft-${attempt}.json`),JSON.stringify(mechanism,null,2));
          validateSubjectMechanism(mechanism,published,context.sources);validateMechanismMath(mechanism,published);
          const review=await subjectModel(`Independently audit every scientific object, relationship, entity meaning, beat and invariant against the supplied PRIMARY EVIDENCE. Check the paper-specific contribution rather than trusting ledger references. Reject a diagram that only names generic modules without demonstrating meaningful data changes. Check exact source version: DQN 2013 must not import later fixed-period target-network schedules or prioritized replay; Whisper must distinguish input task/language/timestamp control from learned emitted text and actual source-supported token format. Check that snapshots preserve identities, pool membership, prefix order and availability; an output cannot precede its dependencies. Pending is unavailable, not an empty computed result. Parallel inputs may coexist in a guidance beat, and pacing is explanatory rather than measured latency. Check all equations in narration, all numeric claims and all limits. Short symbolic collections are permitted as clearly explained examples; they cannot imply measured capacity or actual token content. Relationships with entityIds must transfer unchanged identities actually present at both endpoints. Reject unsupported capabilities, invented sampled outputs, a generic prerequisite substituted for the contribution, or repetitive warnings. All checks pass only with no substantive findings.\nSCENE:\n${JSON.stringify(mechanism)}${common}`,reviewSchema,directory,`review-${attempt}`);
          requireCleanSubjectReview(review);
          if(await readFile(lessonFile,"utf8")!==baseline||await subjectMechanismRendererDigest()!==rendererDigest)throw new Error("Parent or renderer changed during source review");
          const sidecar=publishedSubjectMechanismSchema.parse({...mechanism,lessonId:id,parentContentDigest:published.review.contentDigest,review:{status:"source-passed",reviewedAt:new Date().toISOString(),contentDigest:mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(mechanism))),rendererDigest,visualReviewedAt:null}});
          await writeFile(path.join(destination,file)+".tmp",JSON.stringify(sidecar,null,2)+"\n");await rename(path.join(destination,file)+".tmp",path.join(destination,file));statuses[id]="source-passed";await save();console.log(`SOURCE PASSED MECHANISM ${id} (awaiting visual review)`);return;
        }catch(error){findings=(error as Error).message;if(!previous)try{previous=await readFile(path.join(directory,`draft-${attempt}.json`),"utf8");}catch{}await writeFile(path.join(directory,`defects-${attempt}.json`),JSON.stringify({at:new Date().toISOString(),error:findings}));if(findings==="Parent or renderer changed during source review")throw error;console.log(`REPAIR MECHANISM ${id}: ${findings.slice(0,180)}`);}
      }
      throw new Error("Mechanism review exhausted");
    }catch(error){statuses[id]="failed";await writeFile(path.join(directory,"failure.json"),JSON.stringify({at:new Date().toISOString(),error:(error as Error).message}));await save();console.log(`FAILED MECHANISM ${id}: ${(error as Error).message.slice(0,180)}`);}
  }
  let cursor=0;await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<files.length)await generate(files[cursor++]);}));await statusWrites;console.log(JSON.stringify(statuses));if(Object.values(statuses).includes("failed"))process.exitCode=1;
}
if(process.argv[1]?.endsWith("generate-subject-mechanisms.ts"))main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
