import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { subjectPublicationDigest } from "./subject-publication";
import { validateSubjectMath } from "./subject-math";
import catalog from "../content/subjects/catalog.json";
import { publishedSubjectSourceSchema, subjectEntrySchema, subjectPublicLessonSchema, type PublishedLesson, type SubjectListing } from "./subjects";

export const subjectCatalog = catalog.entries.map(entry=>subjectEntrySchema.parse(entry));
const directory=path.resolve("src/content/subjects/lessons");
const readerPublicationSchema=subjectPublicLessonSchema.extend({
  id:z.string().regex(/^[a-z0-9-]+$/).max(150),createdAt:z.string().datetime(),pipelineVersion:z.string().min(1).max(200),
  sources:z.array(publishedSubjectSourceSchema).min(1).max(64),
  review:z.object({status:z.literal("passed"),reviewedAt:z.string().datetime(),contentDigest:z.string().regex(/^[a-f0-9]{64}$/)}),
});
export async function getSubjectLesson(id:string,options:{directory?:string}={}):Promise<PublishedLesson|null>{
  if(!subjectCatalog.some(entry=>entry.id===id))return null;
  try{
    // Parse the whole reader projection: neither unhashed audit fields nor
    // nested private source excerpts may cross the client serialization boundary.
    const data=readerPublicationSchema.parse(JSON.parse(await readFile(path.join(options.directory??directory,id+".json"),"utf8")));
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
