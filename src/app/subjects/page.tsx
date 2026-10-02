import { Subjects } from "@/components/subjects";
import { listSubjects } from "@/lib/subject-library";
import { authenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export const metadata={title:"Subjects"};
export default async function Page(){if(!(await authenticated()))redirect("/login");return <Subjects entries={await listSubjects()}/>;}
