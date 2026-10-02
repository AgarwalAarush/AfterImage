import { notFound } from "next/navigation";
import { SubjectReader } from "@/components/subject-reader";
import { getSubjectLesson, subjectCatalog } from "@/lib/subject-library";
import { getSubjectMechanism } from "@/lib/subject-mechanism-store";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
  if(process.env.NODE_ENV!=="development")notFound();
  const {id}=await params;
  const entry=subjectCatalog.find(entry=>entry.id===id),lesson=await getSubjectLesson(id);
  if(!entry||!lesson)notFound();
  const mechanism=await getSubjectMechanism(lesson,{allowSourcePassed:true});
  if(!mechanism)notFound();
  return <SubjectReader key={`${lesson.review.contentDigest}:${mechanism.review.contentDigest}`} entry={entry} lesson={lesson} mechanism={mechanism}/>;
}
