import { readFile } from "node:fs/promises";
import path from "node:path";
import { subjectPublicationDigest } from "./subject-publication";
import { validateSubjectMath } from "./subject-math";
import catalog from "../content/subjects/catalog.json";
import { subjectEntrySchema, subjectPublicLessonSchema, type PublishedLesson, type SubjectListing } from "./subjects";

export const subjectCatalog = catalog.entries.map(entry=>subjectEntrySchema.parse(entry));
const directory=path.resolve("src/content/subjects/lessons");
export async function getSubjectLesson(id:string):Promise<PublishedLesson|null>{
  if(!subjectCatalog.some(entry=>entry.id===id))return null;
  try{
    const data=JSON.parse(await readFile(path.join(directory,id+".json"),"utf8")) as PublishedLesson;
    const lesson=subjectPublicLessonSchema.parse(data);
    validateSubjectMath(lesson);
    const digest=subjectPublicationDigest(lesson,data);
    if(data.id!==id||data.review?.status!=="passed"||data.review.contentDigest!==digest||!/[.!?]$/.test(lesson.summary.trim()))return null;
    return data;
  }catch{return null;}
}
export async function listSubjects():Promise<SubjectListing[]>{
  return Promise.all(subjectCatalog.map(async entry=>{
    const lesson=await getSubjectLesson(entry.id);
    return {...entry,status:lesson?"available":"pending",summary:lesson?.summary||"An original lesson from the primary research is not yet available.",words:lesson?.sections.reduce((sum,section)=>sum+section.markdown.split(/\s+/).length,0)||0};
  }));
}
