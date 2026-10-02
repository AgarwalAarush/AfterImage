import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import mechanismCatalog from "../src/content/subjects/mechanism-catalog.json";
import { getSubjectLesson, subjectCatalog } from "../src/lib/subject-library";
import { getSubjectMechanism } from "../src/lib/subject-mechanism-store";

const mechanismCatalogSchema=z.object({version:z.literal(1),lessonIds:z.array(z.string().regex(/^[a-z0-9-]+$/).max(150)).min(1).max(1000)}).strict();
/** Expected walkthrough identities are independent of the files being shipped. */
export function mechanismInventoryIssues(input:unknown,fileIds:string[],subjectIds:ReadonlySet<string>){
  const catalog=mechanismCatalogSchema.parse(input),expected=new Set(catalog.lessonIds),present=new Set(fileIds),issues:string[]=[];
  if(expected.size!==catalog.lessonIds.length)issues.push("Mechanism catalog contains duplicate lesson identities");
  for(const id of expected){
    if(!subjectIds.has(id))issues.push(`${id}: mechanism catalog references an unknown lesson`);
    if(!present.has(id))issues.push(`${id}: catalog mechanism file is missing`);
  }
  for(const id of present)if(!expected.has(id))issues.push(`${id}: mechanism publication missing from mechanism catalog`);
  return issues;
}

/** Release checks must notice withheld content, rather than accepting a successful build. */
export async function auditSubjectPublication(inventory:{lessonDirectory?:string;mechanismDirectory?:string}={}) {
  const lessonFiles=(await readdir(inventory.lessonDirectory??path.resolve("src/content/subjects/lessons"))).filter(file=>file.endsWith(".json"));
  const mechanismFiles=(await readdir(inventory.mechanismDirectory??path.resolve("src/content/subjects/mechanisms"))).filter(file=>file.endsWith(".json"));
  const issues:string[]=[], lessons=new Map(), mechanisms:string[]=[];
  const publishedIds=new Set(lessonFiles.map(file=>file.slice(0,-5))),catalogIds=new Set(subjectCatalog.map(entry=>entry.id));
  if(catalogIds.size!==subjectCatalog.length)issues.push("Catalog contains duplicate lesson identities");
  for(const id of catalogIds)if(!publishedIds.has(id))issues.push(`${id}: catalog lesson file is missing`);
  issues.push(...mechanismInventoryIssues(mechanismCatalog,mechanismFiles.map(file=>file.slice(0,-5)),catalogIds));
  let figures=0;
  for(const file of lessonFiles) {
    const id=file.slice(0,-5), lesson=await getSubjectLesson(id);
    if(!lesson){issues.push(`${id}: publication withheld`);continue;}
    lessons.set(id,lesson);figures+=lesson.figures.length;
    if(!subjectCatalog.some(entry=>entry.id===id))issues.push(`${id}: publication missing from catalog`);
  }
  for(const file of mechanismFiles) {
    const id=file.slice(0,-5),lesson=lessons.get(id);
    if(!lesson||!await getSubjectMechanism(lesson))issues.push(`${id}: mechanism lacks current complete approval`);
    else mechanisms.push(id);
  }
  return {catalog:catalogIds.size,mechanismCatalog:mechanismCatalog.lessonIds.length,lessons:lessons.size,figures,mechanisms:mechanisms.length,issues};
}
if(process.argv[1]?.endsWith("audit-subject-publication.ts"))auditSubjectPublication().then(result=>{
  console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;
});
