import { mkdir, readFile, writeFile, rename, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { validateSubjectMath } from "../src/lib/subject-math";
import { subjectEntrySchema, subjectLessonSchema, subjectPublicLessonSchema, validateSubjectLesson, type SubjectEntry, type PublishedLesson } from "../src/lib/subjects";
import { publishSubjectLesson,subjectPublicationDigest } from "../src/lib/subject-publication";
import { normalizeSubjectFigureReferences, subjectPatchSchema, applySubjectPatch } from "../src/lib/subject-repair";
import { SOURCE_EXTRACTION_VERSION,hasSubstantiveSourceBody } from "../src/lib/source-extraction";
import { experimentContracts } from "../src/lib/subject-experiments";
import { importPaper } from "../src/lib/papers";
import { researchSources } from "../worker/sources";
import { subjectModel } from "../worker/subject-model";
import { selectSubjectEvidence } from "../worker/subject-evidence";

const pipelineVersion = "subjects-lessons-v1";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
async function main() {
const root = path.resolve("src/content/subjects/lessons"), privateRoot = path.resolve(".artifacts/subjects");
const args = process.argv.slice(2);
const resumeDefects = args.includes("--resume-defects");
const refreshEvidence = args.includes("--refresh-evidence");
const evidenceRecovery = args.includes("--select-evidence");
const statusName = args.includes("--status-file") ? args[args.indexOf("--status-file") + 1] : "run.json";
if (!/^[a-z0-9-]+\.json$/.test(statusName || "")) throw new Error("Status filename must be a simple private JSON basename");
const catalog = JSON.parse(await readFile("src/content/subjects/catalog.json", "utf8"));
const entries = z.array(subjectEntrySchema).parse(catalog.entries);
const requested = args[args.indexOf("--id") + 1];
const excluded=new Set(args.includes("--exclude")?args[args.indexOf("--exclude")+1].split(","):[]);
if (!args.includes("--all") && !args.includes("--id")) throw new Error("Use --all or --id <catalog-id>. Generation is an explicit action.");
const selected = (args.includes("--all") ? entries : entries.filter(entry => entry.id === requested)).filter(entry=>!excluded.has(entry.id));
if (!selected.length) throw new Error("Unknown catalog identity");
const concurrencyArg = args.includes("--concurrency") ? Number(args[args.indexOf("--concurrency") + 1]) : 1;
const concurrency = Math.min(3, Math.max(1, Number.isInteger(concurrencyArg) ? concurrencyArg : 1));
await mkdir(root, {recursive: true}); await mkdir(privateRoot, {recursive: true});
let statuses: Record<string, "pending" | "running" | "failed" | "passed"> = {};
try { statuses = JSON.parse(await readFile(path.join(privateRoot,statusName),"utf8")).statuses; } catch {}
for (const entry of entries) statuses[entry.id] ||= "pending";
let writes = Promise.resolve();
function saveStatus() {
  const snapshot = JSON.stringify({pipelineVersion,updatedAt:new Date().toISOString(),statuses},null,2);
  writes = writes.then(async () => {await writeFile(path.join(privateRoot,statusName+".tmp"),snapshot);await rename(path.join(privateRoot,statusName+".tmp"),path.join(privateRoot,statusName));});
  return writes;
}
const reviewSchema = z.object({
  science: z.object({passed:z.boolean(), findings:z.array(z.string()).max(12)}),
  teaching: z.object({passed:z.boolean(), findings:z.array(z.string()).max(12)}),
  experiments: z.object({passed:z.boolean(), findings:z.array(z.string()).max(12)}),
  quiz: z.object({passed:z.boolean(), findings:z.array(z.string()).max(12)}),
});
const draftPrompt = `Write a completely original AfterImage teaching lesson about the supplied primary paper. No third-party explainer text is supplied or authorized as draft material. Use only PRIMARY EVIDENCE for paper-specific facts; general illustrative arithmetic must be marked illustrative. Aim for 1200–1800 words across 6–9 substantive sections, not a summary padded with repetition. Teach prerequisites briefly, reconstruct the paper-specific mechanism step by step, define every mathematical symbol, include at least one correctly calculated small worked example, connect reported evidence to its actual conditions, address a real misconception, and state specific limitations. Use readable Markdown with $inline$ and $$display$$ KaTeX math. Verify balanced braces and double-escape every LaTeX backslash in JSON strings; never emit control characters. Keep titles as plain text. No raw HTML or external assets. Do not invent official-code inspection, benchmark data, quotations, empirical curves, default parameters, or citations. State relevant scientific limits naturally where they affect a conclusion. Do not narrate supplied-excerpt coverage, provenance, or inventories of unimplemented features in reader-facing prose. The short summary must explain the particular contribution rather than saying 'learn how this works'. Use a distinctive lesson title; do not mimic another explainer's editorial structure.
Build 8–18 source-supported ledger claims. Write original claim statements with precise supporting source IDs. Do not generate quoted evidence strings: a separate selector binds exact primary passage IDs before scientific review. Use a narrow claim when a compound claim spans disconnected passages. Each section cites supporting sourceIds AND relevant claimIds. Conditions identify settings/assumptions, not generic 'according to the paper'. Include a source-supported equation claim where mathematics matters.
Select 2–3 DIFFERENT allowlisted experiments from EXPERIMENT CONTRACTS. These are fixed, original authored illustrative simulations, not arbitrary generated renderers. Place each figure in exactly one section via figureId. A figure must teach an actual relevant prerequisite or mechanism distinction, with an explicit limitation; never describe unimplemented capabilities or pretend it is a full simulation of the paper. Its question asks the reader to predict or compare something the control really changes. The caption and limitation must agree with the EXACT contract. For example, optimizer is ordinary gradient descent, memory is slot allocation, routing is token-choice, state is a scalar impulse response, patches is masking, search is breadth-first reveal, noise is a norm histogram, low-rank is a diagonal singular decomposition, not a trained LoRA update. Use another experiment if those assumptions would misteach the selected contribution. Include figure semantics in the section text so the reader knows why the toy is useful and where it stops. Every figure is illustrative:true and uses ledger/source references.
Write exactly three multiple-choice questions. Each has three distinct options and an explanation for every option; exactly one answer is defensibly correct under explicitly stated assumptions. Prefer a transfer/prediction question, mechanism distinction, and limitation interpretation. Do not make a quiz depend on guessed experimental settings.`;

const labelsSchema=z.object({
  prerequisites:z.array(z.string().min(3).max(75)).min(1).max(6),
  objectives:z.array(z.string().min(10).max(120)).min(3).max(5),
});
async function compactLabels(lesson:z.infer<typeof subjectLessonSchema>,directory:string,name:string){
  const labels=await subjectModel("Rewrite ONLY this lesson's background labels and learning objectives. Use short, complete plain-text noun phrases for background (under 65 characters) and complete short sentences for objectives (under 105 characters). No math delimiters or LaTeX in these small labels; the lesson body owns equations and definitions. Condense meaning instead of cutting a clause. Keep the actual topic and scope of the supplied lesson.\nLESSON:\n"+JSON.stringify(lesson),labelsSchema,directory,name);
  lesson.prerequisites=labels.prerequisites;lesson.objectives=labels.objectives;
  return lesson;
}
/** Repairs change named prose fields rather than regenerating already-reviewed equations and claims. */
async function patchLesson(lesson:z.infer<typeof subjectLessonSchema>,findings:string,common:string,sourceIds:string[],directory:string,name:string){
  const patch=await subjectModel(`Correct only the named substantive defects in this original lesson. Return complete replacement strings for affected fields; retain every correct field unchanged. For a section return its complete Markdown, including correct paragraphs, with targeted repairs incorporated. Preserve claim identities. Correct section, figure or quiz claimLinks only to already-declared claims when a finding identifies a mismatched scientific relationship; every revised relationship receives full source review. Correct citation mapping only to supplied primary source IDs when required for a supported statement or its conditions. Do not generate or update quoted evidence: the independent passage selector will bind exact primary ranges after claim or citation changes. Each patch value must satisfy its field-specific schema, not a general long-text bound. Prerequisite labels must be plain text under 65 characters; objectives complete under 105 characters. Place experiment interpretation, units, chosen assumptions and relevant differences from the paper in the lesson prose naturally, without repetitive warning/disclaimer paragraphs, inventories of unimplemented things, or supplied-excerpt/provenance narration. Do not add measured results or imply the illustrative contract is the complete paper algorithm. Never truncate to fit a schema bound.\nFINDINGS:\n${findings}\nLESSON:\n${JSON.stringify(lesson)}${common}`,subjectPatchSchema(lesson,sourceIds,{allowEvidenceUpdates:false,allowClaimLinks:true}),directory,name);
  return applySubjectPatch(lesson,patch,sourceIds);
}

async function generate(entry: SubjectEntry) {
  const file = path.join(root,entry.id+".json");
  try {
    const existing = JSON.parse(await readFile(file,"utf8")) as PublishedLesson;
    const content=subjectPublicLessonSchema.parse(existing);
    if(existing.pipelineVersion===pipelineVersion && existing.review.status==="passed" && existing.review.contentDigest===subjectPublicationDigest(content,existing) && /[.!?]$/.test(existing.summary.trim())){
      validateSubjectMath(content);statuses[entry.id]="passed";console.log(`SKIP ${entry.id}: reviewed lesson exists`);return;
    }
  } catch {}
  statuses[entry.id]="running"; await saveStatus(); console.log(`START ${entry.id}`);
  const directory = path.join(privateRoot,entry.id); await mkdir(directory,{recursive:true});
  try {
    let context:{paper:{id:string;title:string;authors:string};scope:string;extractionVersion?:string;capturedAt?:string;sources:{id:string;label:string;url:string;excerpt:string}[]};
    let sourceRefreshed=false;
    let previousContext:typeof context|undefined;
    try {
      if(!resumeDefects||refreshEvidence)throw new Error("Fresh extraction requested");
      context=JSON.parse(await readFile(path.join(directory,"evidence.json"),"utf8"));
      previousContext=context;
      if(context.scope!=="full-text"||!hasSubstantiveSourceBody(context.sources))throw new Error("Cached scientific body unavailable");
      if(context.extractionVersion!==SOURCE_EXTRACTION_VERSION)throw new Error("Cached source extraction requires refresh");
    } catch {
      const paper = await importPaper(entry.arxivId);
      const extracted = await researchSources(paper);
      context={paper:{id:paper.id,title:paper.title,authors:paper.authors},scope:extracted.scope,
        extractionVersion:SOURCE_EXTRACTION_VERSION,capturedAt:new Date().toISOString(),sources:extracted.sources};
      sourceRefreshed=!previousContext||refreshEvidence||
        (context.sources.some(source=>source.id.startsWith("main-text"))&&!previousContext.sources.some(source=>source.id.startsWith("main-text")));
      await writeFile(path.join(directory,"evidence.json"),JSON.stringify(context,null,2));
    }
    const extracted=context;
    if (extracted.scope !== "full-text"||!hasSubstantiveSourceBody(extracted.sources)) throw new Error("FullTextEvidenceUnavailable");
    const common = "\nPRIMARY EVIDENCE:\n"+JSON.stringify(context)+"\nEXPERIMENT CONTRACTS:\n"+JSON.stringify(experimentContracts);
    let repair="", previous="";
    let draft:z.infer<typeof subjectLessonSchema>|undefined;
    let spellingOnlyRecovery=false;
    if(resumeDefects&&!sourceRefreshed){
      const names=(await readdir(directory)).filter(name=>/^(?:draft|recovery)-\d+(?:-candidate)?\.json$/.test(name));
      const candidates=await Promise.all(names.map(async name=>{
        try{const file=path.join(directory,name);return {name,data:JSON.parse(await readFile(file,"utf8")),modified:(await stat(file)).mtimeMs};}catch{return null;}
      }));
      const latest=candidates.filter(candidate=>candidate!==null).sort((a,b)=>b.modified-a.modified).find(candidate=>subjectLessonSchema.safeParse(candidate.data).success);
      if(latest){
        draft=subjectLessonSchema.parse(latest.data);
        const attempt=latest.name.match(/\d+/)![0];
        const defectsName=(latest.name.startsWith("recovery-")?"recovery-":"")+`defects-${attempt}.json`;
        try{repair=JSON.parse(await readFile(path.join(directory,defectsName),"utf8")).error;}catch{repair="Recheck and repair any incomplete labels or invalid math.";}
        const spellingRepairs=normalizeSubjectFigureReferences(draft);
        if(spellingRepairs.length){
          await writeFile(path.join(directory,"recovery-endpoint-repairs.json"),JSON.stringify(spellingRepairs,null,2));
          if(repair==="Unknown figure reference"){
            validateSubjectLesson(draft,extracted.sources);validateSubjectMath(draft);
            spellingOnlyRecovery=true;
          }
        }
      }
    }
    let evidenceSignature="";
    const attempts=draft&&!evidenceRecovery?4:5; // Initial draft plus at most four targeted repairs; recovery has four repairs.
    for (let attempt=0;attempt<attempts;attempt++) {
      const stage=resumeDefects?`recovery-${attempt}`:`draft-${attempt}`;
      console.log(`${draft?"PATCH":"DRAFT"} ${entry.id} attempt ${attempt+1}`);
      try {
      let lesson = draft
        ? (spellingOnlyRecovery||evidenceRecovery)&&attempt===0?draft:await patchLesson(draft,repair,common,extracted.sources.map(source=>source.id),directory,stage+"-patch")
        : await subjectModel(draftPrompt+common+"\nThe summary must be a complete sentence of 100–220 characters, ending in punctuation. Background labels are plain text under 65 characters, without math. Objectives are complete short sentences under 105 characters. Explain control assumptions and the actual pictured computation naturally in its lesson section, not repetitive warning paragraphs. Never truncate prose to fit a field.",subjectPublicLessonSchema,directory,stage).then(content=>subjectLessonSchema.parse({...content,claims:content.claims.map(claim=>({...claim,evidence:"Primary passage selection is pending."}))}));
      const spellingRepairs=normalizeSubjectFigureReferences(lesson);
      if(spellingRepairs.length)await writeFile(path.join(directory,stage+"-endpoint-repairs.json"),JSON.stringify(spellingRepairs,null,2));
      if(attempt===0)await compactLabels(lesson,directory,stage+"-labels");
      if(!/[.!?]$/.test(lesson.summary.trim())||lesson.summary.length>260){
        const fixed=await subjectModel("Write one complete original summary sentence of 100–220 characters, ending in punctuation. Do not cut a word or clause. Explain only the supported contribution in this draft.\nDRAFT:\n"+JSON.stringify(lesson),z.object({summary:z.string().min(40).max(250).regex(/[.!?]$/)}),directory,stage+"-summary");
        lesson.summary=fixed.summary;
      }
      // Persist original prose before selection so a transport failure cannot discard a valid draft.
      draft=lesson;
      await writeFile(path.join(directory,stage+"-candidate.json"),JSON.stringify(lesson));
      const signature=digest(JSON.stringify(lesson.claims.map(({evidence,...claim})=>claim)));
      if(signature!==evidenceSignature){
        lesson=await selectSubjectEvidence(lesson,extracted.sources,directory,stage+"-evidence");
        evidenceSignature=signature;
      }
      previous=JSON.stringify(lesson);
      draft=lesson;
      await writeFile(path.join(directory,stage+"-candidate.json"),previous);
        validateSubjectLesson(lesson,extracted.sources);
        validateSubjectMath(lesson);
        const review=await subjectModel(`You are an independent source and teaching reviewer. Reconstruct scientific support from PRIMARY EVIDENCE, not the draft ledger's assurance. Audit every load-bearing ledger statement, equation, worked calculation, reported number's conditions, and section. Check evidence limitations and whether the paper's actual contribution is taught. Do not demand an official-code citation where no code is supplied; reject claims that code was inspected. Check teaching for unexplained prerequisites/symbols, substantive mechanism depth, unsupported generalization, and repetitive filler. Check each experiment against its EXACT CONTRACT: reject promised dragging/3D/sampling/model updates or claimed curves that the implementation does not have. Illustrative baseline simulations are allowed ONLY when the draft explicitly distinguishes them from the paper's complete algorithm in its teaching prose. Do not demand repetitive disclaimers or captions; natural explanation of the calculation and chosen assumptions in the figure's section is sufficient. Check the correct quiz choice and all distractor explanations. Each check passes only with no substantive defects; findings must be actionable and source/section-specific. Do not request inventories of omitted implementation details or supplied-excerpt/provenance narration in the lesson. Specific scientific limits should explain consequences at the relevant teaching point. No stylistic preferences masquerading as scientific errors.\nDRAFT:\n${previous}${common}`,reviewSchema,directory,stage+"-review");
        const checks=Object.values(review);
        const findings=checks.flatMap(check=>check.findings.length?check.findings:check.passed?[]:["Reviewer rejected a check without a finding"]);
        if(checks.some(check=>!check.passed||check.findings.length>0)) throw new Error(findings.join("\n"));
        const published = publishSubjectLesson(lesson,{id:entry.id,createdAt:new Date().toISOString(),pipelineVersion,
          sources:extracted.sources.map(source=>({id:source.id,label:source.label,url:source.url,digest:digest(source.excerpt),extractionVersion:context.extractionVersion,capturedAt:context.capturedAt}))});
        await writeFile(file+".tmp",JSON.stringify(published,null,2)+"\n");await rename(file+".tmp",file);
        statuses[entry.id]="passed";console.log(`PASSED ${entry.id} (${lesson.sections.reduce((n,s)=>n+s.markdown.split(/\s+/).length,0)} words)`);await saveStatus();return;
      } catch(error) {repair=(error as Error).message;if(repair.startsWith("Subject model step failed")||repair.startsWith("Subject model returned no JSON output"))throw error;await writeFile(path.join(directory,`${resumeDefects?"recovery-":""}defects-${attempt}.json`),JSON.stringify({at:new Date().toISOString(),error:repair}));console.log(`REPAIR ${entry.id} attempt ${attempt+1}: ${repair.slice(0,180)}`);}
    }
    throw new Error("LessonReviewExhausted");
  } catch(error) {
    statuses[entry.id]="failed";await saveStatus();await writeFile(path.join(directory,"failure.json"),JSON.stringify({at:new Date().toISOString(),error:(error as Error).message}));
    console.log(`FAILED ${entry.id}: ${(error as Error).message.slice(0,180)}`);
  }
}
let cursor=0;
await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<selected.length){const entry=selected[cursor++];await generate(entry);}}));
await writes;
console.log(JSON.stringify({total:entries.length,passed:Object.values(statuses).filter(x=>x==="passed").length,failed:Object.values(statuses).filter(x=>x==="failed").length}));
if(selected.some(entry=>statuses[entry.id]!=="passed")) process.exitCode=1;
}
main().catch(error => {console.error((error as Error).message);process.exitCode=1;});
