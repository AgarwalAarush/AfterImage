import { createHash } from "node:crypto";
import { snapshot } from "./store";
import { getSubjectLesson, subjectCatalog } from "./subject-library";
import { sourcesFromHtml, hasSubstantiveSourceBody } from "./source-extraction";
import type { Paper, Source } from "./types";
import type { AssistantEvidence, AssistantTarget } from "./assistant-model";

export function arxivResource(id:string,format:"pdf"|"html"|"abs"){
  if(!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/.test(id))throw Error("Invalid paper identifier.");
  return new URL(`https://arxiv.org/${format}/${id}`);
}
/** Only canonical arXiv resources; redirects cannot broaden the fetch boundary. */
export async function fetchArxiv(id:string,format:"pdf"|"html"|"abs",maxBytes:number){
  let url=arxivResource(id,format);const signal=AbortSignal.timeout(25000);
  for(let redirects=0;redirects<=3;redirects++){
    const response=await fetch(url,{redirect:"manual",signal,headers:{"User-Agent":"AfterImage research reader"},cache:"no-store"});
    if(response.status>=300&&response.status<400){
      const location=response.headers.get("location");await response.body?.cancel();if(!location)throw Error("Paper redirect is unavailable.");
      const next=new URL(location,url);
      if(next.origin!=="https://arxiv.org"||next.username||next.password||next.search||next.hash||!next.pathname.startsWith(`/${format}/`))throw Error("Paper redirect is not supported.");
      const destination=next.pathname.slice(format.length+2).replace(/\.pdf$/,"");arxivResource(destination,format);
      if(destination.replace(/v\d+$/,"")!==id.replace(/v\d+$/,""))throw Error("Paper redirect changed identity.");url=next;continue;
    }
    if(!response.ok||!response.body)throw Error("The original paper is unavailable. Try again later.");
    if(Number(response.headers.get("content-length"))>maxBytes){await response.body.cancel();throw Error("The original paper exceeds the reader size limit.");}
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
    try{while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>maxBytes)throw Error("The original paper exceeds the reader size limit.");chunks.push(item.value);}}catch(error){await reader.cancel();throw error;}
    const body=Buffer.concat(chunks);
    if(format==="pdf"&&!body.subarray(0,8).toString("ascii").startsWith("%PDF-"))throw Error("The source did not return a PDF.");
    return {body,url:url.toString(),digest:createHash("sha256").update(body).digest("hex")};
  }throw Error("The source redirected too many times.");
}
export async function resolveAssistantTarget(target:AssistantTarget){
  if(target.kind==="paper"){
    const paper=(await snapshot()).data.papers.find(p=>p.id===target.id);if(!paper)throw Error("Paper not found.");
    arxivResource(paper.arxivId,"pdf");return {paper,lesson:null,arxivId:paper.arxivId,title:paper.title};
  }
  const entry=subjectCatalog.find(e=>e.id===target.id),lesson=await getSubjectLesson(target.id);
  if(!entry||!lesson)throw Error("Published lesson not found.");
  return {paper:null,lesson,arxivId:entry.arxivId,title:lesson.title};
}
const evidenceCache=new Map<string,{at:number;evidence:AssistantEvidence}>();
export async function assistantEvidence(target:AssistantTarget):Promise<AssistantEvidence>{
  const {paper,lesson,arxivId,title}=await resolveAssistantTarget(target);
  const key=JSON.stringify([target,lesson?.review.contentDigest,paper?.sources,paper?.recall,paper?.study]);
  const cached=evidenceCache.get(key);if(cached&&Date.now()-cached.at<300000)return cached.evidence;
  let sources:Source[]=paper?.sources||[];
  if(!paper||!hasSubstantiveSourceBody(sources)){
    try{
      const html=await fetchArxiv(arxivId,"html",12_000_000);
      const base=paper||{arxivId,sources:[]} as unknown as Paper;
      const extracted=sourcesFromHtml(base,html.body.toString("utf8"));
      if(extracted.length)sources=extracted;
    }catch{/* Available lesson/notecard remains usable when the primary source is unavailable. */}
  }
  const primary=sources.map(source=>({...source,id:lesson?`paper-${source.id}`:source.id,kind:"paper" as const}));
  const editorial=lesson?lesson.sections.map(section=>({id:`lesson-${section.id}`,label:section.title,url:`/subjects/${target.id}#${section.id}`,excerpt:section.markdown,kind:"lesson" as const,sectionId:section.id})):paper?.recall?[{id:"notecard",label:"AfterImage notecard",url:`/papers/${target.id}`,excerpt:JSON.stringify(paper.recall),kind:"notecard" as const}]:[];
  const content={title,arxivId,lessonDigest:lesson?.review.contentDigest,sources:[...primary,...editorial],material:lesson?{summary:lesson.summary,objectives:lesson.objectives,claims:lesson.claims,figures:lesson.figures}:{abstract:paper?.abstract,notecard:paper?.recall,study:paper?.study},scope:hasSubstantiveSourceBody(sources)?"Primary paper excerpts and editorial explanation":"Editorial explanation and any available abstract only; full paper evidence unavailable"};
  const evidence={...content,digest:createHash("sha256").update(JSON.stringify(content)).digest("hex")};
  if(evidenceCache.size>=8)evidenceCache.delete(evidenceCache.keys().next().value!);evidenceCache.set(key,{at:Date.now(),evidence});return evidence;
}
