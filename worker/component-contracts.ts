import type { Source } from "../src/lib/types";
import { fingerprint, RepairFailure } from "./repair-controller";

export type ComponentPlan = { requirements: string[]; equations: string[]; example: string; diagram: { proof: string }; figures: { id: string; question: string }[]; sourceIds: string[] };
export type TeachingRequirement = { id: string; owner: string; field: string; text: string };
/** Global completeness stays owned by the stand-alone explanation; visuals own their precise proof. */
export function teachingOwnership(plan: ComponentPlan): TeachingRequirement[] {
 const requirement=(owner:string,field:string,text:string)=>({id:fingerprint([owner,field,text]).slice(0,32),owner,field,text});
 return [...plan.requirements.map((text,i)=>requirement("explanation",`/requirements/${i}`,text)),
  ...plan.equations.map((text,i)=>requirement("explanation",`/equations/${i}`,text)),
  ...(plan.example.trim()?[requirement("explanation","/example",plan.example)]:[]),
  requirement("diagram","/diagram/proof",plan.diagram.proof),
  ...plan.figures.map((figure,i)=>requirement(`figure:${figure.id}`,`/figures/${i}/question`,figure.question))];
}
export function componentTeachingContract(plan: ComponentPlan, id: string) {
 const ownership=teachingOwnership(plan);
 if(!["explanation","diagram","quiz",...plan.figures.map(f=>`figure:${f.id}`)].includes(id))throw new RepairFailure("schema","Component has no frozen teaching owner.");
 return {version:1,componentId:id,owned:ownership.filter(r=>r.owner===id),ownership:ownership.map(({text,...identity})=>identity),ownershipDigest:fingerprint(ownership),
  inheritedExplanation:id!=="explanation",quizRule:id==="quiz"?"Every question, correct answer and distractor explanation must be answerable from the published explanation and primary evidence, independently of figures.":undefined};
}
export type EvidenceAvailability = { sourceId: string; state: "unknown"|"known-omitted"|"supplied" };
export function evidenceAvailability(catalogue: Source[], supplied: Source[], ids: Iterable<string>): EvidenceAvailability[] {
 const known=new Set(catalogue.map(s=>s.id)),received=new Set(supplied.map(s=>s.id));
 return [...new Set(ids)].map(sourceId=>({sourceId,state:!known.has(sourceId)?"unknown":received.has(sourceId)?"supplied":"known-omitted"}));
}
/** Retain plan and candidate bindings before selecting bounded review contexts. Never rewrite excerpts. */
export function retainComponentEvidence(catalogue: Source[], selected: Source[], planIds: string[], referenced: Iterable<string>): Source[] {
 const ids=[...new Set([...referenced,...selected.map(s=>s.id),...planIds])];
 if(ids.some(id=>!catalogue.some(s=>s.id===id)))throw new RepairFailure("schema","Component cites an unknown immutable source.");
 for(const source of selected)if(fingerprint(source)!==fingerprint(catalogue.find(s=>s.id===source.id)))throw new RepairFailure("schema","Component evidence changed an immutable excerpt.");
 return ids.map(id=>catalogue.find(s=>s.id===id)!);
}
export function evidenceGroups(sources: Source[], limit=14): Source[][] {
 if(limit<1||limit>14)throw new RepairFailure("schema","Invalid review evidence bound.");
 return Array.from({length:Math.ceil(sources.length/limit)},(_,i)=>sources.slice(i*limit,i*limit+limit));
}
export const componentReviewContract = "TEACHING CONTRACT owns coverage: check every owned requirement, and fidelity of every actual claim. The published explanation supplies inherited prerequisites. Do not require a component to teach another owner's requirement. Global requirements and equations remain mandatory in the explanation. Diagram completeness means its own proof; figure completeness means its own question; quiz correctness includes every distractor explanation. Preserve unrelated panels and all inherited dependencies.";
export const evidenceContextContract = "EVIDENCE AVAILABILITY distinguishes unknown IDs, known-omitted excerpts and supplied excerpts. Unknown IDs are invalid. Known-omitted evidence is a context request, never authority to delete a claim or citation. Supplied does not imply support: unsupported-by-supplied is a scientific judgment requiring received exact passages. Other groups receive independent review; absence from this group cannot establish global absence. Request known omitted IDs explicitly. Cite only received excerpts.";
