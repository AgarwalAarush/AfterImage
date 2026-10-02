import { z } from "zod";
import { subjectLessonSchema, type SubjectLesson } from "./subjects";

/** Only repair an endpoint spelling that resolves to an already-declared figure. */
export function normalizeSubjectFigureReferences(lesson:SubjectLesson){
  const identities=new Set(lesson.figures.map(figure=>figure.id));
  const repairs:{sectionId:string;from:string;to:string}[]=[];
  for(const section of lesson.sections){
    if(!section.figureId||identities.has(section.figureId))continue;
    const matched=section.figureId.replace(/_/g,"-");
    if(matched!==section.figureId&&identities.has(matched)){
      repairs.push({sectionId:section.id,from:section.figureId,to:matched});
      section.figureId=matched;
    }
  }
  return repairs;
}

/** A prose patch carries the exact bound of the field it changes. */
export function subjectPatchSchema(lesson:SubjectLesson,availableSourceIds:string[],options:{allowEvidenceUpdates?:boolean;allowClaimLinks?:boolean}={}){
  const choices:z.ZodType<{path:string;value:string}>[]=[];
  const sourcePaths:string[]=[];
  const claimPaths:{path:string;maximum:number}[]=[];
  const add=(path:string,value:z.ZodType<string>)=>choices.push(z.object({path:z.literal(path),value}));
  add("title",subjectLessonSchema.shape.title);add("summary",subjectLessonSchema.shape.summary);
  lesson.prerequisites.forEach((_,i)=>add(`prerequisites.${i}`,z.string().min(3).max(75)));
  lesson.objectives.forEach((_,i)=>add(`objectives.${i}`,z.string().min(10).max(120)));
  lesson.claims.forEach(claim=>{for(const key of ["statement","conditions","evidence"]as const)if(key!=="evidence"||options.allowEvidenceUpdates!==false)add(`claims.${claim.id}.${key}`,subjectLessonSchema.shape.claims.element.shape[key]);sourcePaths.push(`claims.${claim.id}.sourceIds`);});
  lesson.sections.forEach((_,i)=>{for(const key of ["title","markdown"]as const)add(`sections.${i}.${key}`,subjectLessonSchema.shape.sections.element.shape[key]);sourcePaths.push(`sections.${i}.sourceIds`);claimPaths.push({path:`sections.${i}.claimIds`,maximum:8});});
  lesson.figures.forEach((_,i)=>{for(const key of ["title","question","caption","limitation"]as const)add(`figures.${i}.${key}`,subjectLessonSchema.shape.figures.element.shape[key]);sourcePaths.push(`figures.${i}.sourceIds`);claimPaths.push({path:`figures.${i}.claimIds`,maximum:6});});
  lesson.quiz.forEach((question,i)=>{add(`quiz.${i}.question`,subjectLessonSchema.shape.quiz.element.shape.question);sourcePaths.push(`quiz.${i}.sourceIds`);claimPaths.push({path:`quiz.${i}.claimIds`,maximum:4});question.options.forEach((_,j)=>{for(const key of ["text","explanation"]as const)add(`quiz.${i}.options.${j}.${key}`,subjectLessonSchema.shape.quiz.element.shape.options.element.shape[key]);});});
  const identities=lesson.claims.map(claim=>claim.id)as[string,...string[]];
  const links=claimPaths.map(link=>z.object({path:z.literal(link.path),claimIds:z.array(z.enum(identities)).min(1).max(link.maximum)}));
  return z.object({
    ...(options.allowClaimLinks?{claimLinks:z.array(z.union(links as [typeof links[number],typeof links[number],...typeof links[number][]])).max(12)}:{}),
    updates:z.array(z.union(choices as [z.ZodType<{path:string;value:string}>,z.ZodType<{path:string;value:string}>,...z.ZodType<{path:string;value:string}>[]])).max(24),
    answers:z.array(z.object({questionIndex:z.number().int().min(0).max(2),answer:z.number().int().min(0).max(2)})).max(3),
    citations:z.array(z.object({path:z.enum(sourcePaths as [string,...string[]]),sourceIds:z.array(z.enum(availableSourceIds as [string,...string[]])).min(1).max(8)})).max(16),
  });
}
export type SubjectPatch=z.infer<ReturnType<typeof subjectPatchSchema>>;
export function applySubjectPatch(lesson:SubjectLesson,patch:SubjectPatch,availableSourceIds:string[]){
  subjectPatchSchema(lesson,availableSourceIds,{allowClaimLinks:patch.claimLinks!==undefined}).parse(patch);
  const next=structuredClone(lesson),seen=new Set<string>();
  function assign(path:string,value:string|string[]){
    if(seen.has(path))throw new Error("Duplicate lesson patch path");seen.add(path);
    const parts=path.split(".");let owner:unknown=next;
    for(const part of parts.slice(0,-1)){
      owner=Array.isArray(owner)&&(owner===next.claims||!/^\d+$/.test(part))?owner.find(item=>item.id===part):(owner as Record<string,unknown>)[part];
      if(owner===undefined)throw new Error("Unknown lesson patch identity");
    }
    (owner as Record<string,unknown>)[parts.at(-1)!]=value;
  }
  for(const update of patch.updates)assign(update.path,update.value);
  for(const citation of patch.citations)assign(citation.path,citation.sourceIds);
  const links=z.array(z.object({path:z.string(),claimIds:z.array(z.string())})).parse(patch.claimLinks??[]);
  for(const link of links)assign(link.path,link.claimIds);
  for(const answer of patch.answers)next.quiz[answer.questionIndex].answer=answer.answer;
  return subjectLessonSchema.parse(next);
}
