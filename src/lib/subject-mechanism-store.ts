import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publishedSubjectMechanismSchema, subjectMechanismSchema, validateSubjectMechanism } from "./subject-mechanism";
import { validateSubjectMath } from "./subject-math";
import type { PublishedLesson } from "./subjects";

export const subjectMechanismRendererFiles=["src/lib/subject-mechanism.ts","src/components/subject-mechanism.tsx","src/components/subject-mechanism.module.css","src/lib/scene-layout.ts"];
export const mechanismDigest=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function subjectMechanismRendererDigest(){
  const files=await Promise.all(subjectMechanismRendererFiles.map(async file=>[file,mechanismDigest(await readFile(path.resolve(file),"utf8"))]));
  return mechanismDigest(JSON.stringify(files));
}
export function validateMechanismMath(input:unknown,lesson:PublishedLesson){
  const mechanism=subjectMechanismSchema.parse(input);
  validateSubjectMath({...lesson,title:mechanism.title,summary:mechanism.introduction,sections:mechanism.beats.map((beat,index)=>({...lesson.sections[0],id:`beat-${index}`,markdown:beat.explanation})),objectives:[mechanism.takeaway]});
}
/** The development reviewer may request source-passed drafts; ordinary readers never do. */
export async function getSubjectMechanism(lesson:PublishedLesson,{allowSourcePassed=false}:{allowSourcePassed?:boolean}={}){
  if(!/^[a-z0-9-]+$/.test(lesson.id))return null;
  try{
    const input=publishedSubjectMechanismSchema.parse(JSON.parse(await readFile(path.resolve("src/content/subjects/mechanisms",lesson.id+".json"),"utf8")));
    if(input.lessonId!==lesson.id||input.parentContentDigest!==lesson.review.contentDigest||(!allowSourcePassed&&input.review.status!=="passed")||input.review.status==="passed"&&!input.review.visualReviewedAt)return null;
    if(input.review.contentDigest!==mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(input)))||input.review.rendererDigest!==await subjectMechanismRendererDigest())return null;
    validateSubjectMechanism(input,lesson,lesson.sources);validateMechanismMath(input,lesson);
    return input;
  }catch{return null;}
}
