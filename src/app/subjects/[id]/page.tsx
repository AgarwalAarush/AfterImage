import { notFound, redirect } from "next/navigation";
import { authenticated } from "@/lib/auth";
import { SubjectReader } from "@/components/subject-reader";
import { getSubjectMechanism } from "@/lib/subject-mechanism-store";
import { getSubjectLesson, subjectCatalog } from "@/lib/subject-library";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
  if(!(await authenticated()))redirect("/login");
  const {id}=await params;
  const entry=subjectCatalog.find(entry=>entry.id===id);
  const lesson=await getSubjectLesson(id);
  if(!entry||!lesson)notFound();
  const mechanism=await getSubjectMechanism(lesson);
  return <SubjectReader key={`${lesson.review.contentDigest}:${mechanism?.review.contentDigest??"lesson"}`} entry={entry} lesson={lesson} mechanism={mechanism}/>;
}
