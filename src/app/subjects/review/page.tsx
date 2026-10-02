import { notFound } from "next/navigation";
import { SubjectExperiment } from "@/components/subject-experiment";
import { experimentKinds } from "@/lib/subjects";
import { experimentContracts } from "@/lib/subject-experiments";
export default function Page(){
  if(process.env.NODE_ENV!=="development")notFound();
  return <div className="page"><div className="page-intro"><h1>Experiment review.</h1><p>Development fixtures for authored illustrative interactions.</p></div>{experimentKinds.map(kind=><SubjectExperiment key={kind} figure={{id:kind,kind,title:`${kind} experiment`,question:"Change the control. Which values change, and which assumptions stay fixed?",caption:experimentContracts[kind],limitation:"This is an illustrative development fixture, with no paper-specific performance claim.",sourceIds:["fixture"],claimIds:["fixture"],illustrative:true}}/>)}</div>;
}
