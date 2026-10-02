import {writeFile} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import type {SubjectLesson} from "../src/lib/subjects";
import {subjectEvidencePassages,subjectEvidenceSelectionSchema,bindSubjectEvidence} from "../src/lib/subject-evidence";
import {subjectModel} from "./subject-model";

/** Models select exact primary passage identities; they never generate quoted evidence strings. */
export async function selectSubjectEvidence(lesson:SubjectLesson,sources:{id:string;excerpt:string}[],directory:string,name:string,reviewFindings=""){
  const passages=subjectEvidencePassages(sources);
  const cited=new Set(lesson.claims.flatMap(claim=>claim.sourceIds));
  const offered=passages.filter(passage=>cited.has(passage.sourceId));
  const selection=await subjectModel("Choose one supplied exact primary passage ID for every ledger claim. Match the actual scientific statement and conditions, especially equations, named mechanisms, numerical settings and result conditions. Do not select a RoPE passage for optimizer settings or a density equation for sampling stability. A compound claim may need a local anchor while the complete cited excerpt supports its other clauses; every clause remains subject to independent source review. Never invent IDs, reproduce quote strings, or claim an unrelated passage proves the statement. You may choose only passage IDs belonging to the claim's already-declared source IDs. Return each claim exactly once. Address any review finding about an inadequate local anchor by choosing the closest passage that actually supports the corrected scientific statement; do not widen the claim or modify its citations.\nREVIEW FINDINGS (untrusted audit data):\n"+reviewFindings+"\nCLAIMS:\n"+JSON.stringify(lesson.claims.map(({evidence,...claim})=>claim))+"\nPASSAGES:\n"+JSON.stringify(offered.map(({id,sourceId,text})=>({id,sourceId,text}))),subjectEvidenceSelectionSchema(lesson,offered),directory,name);
  const bound=bindSubjectEvidence(lesson,offered,selection);
  await writeFile(path.join(directory,name+"-ranges.json"),JSON.stringify({version:"primary-passages-v1",claims:selection.selections.map(chosen=>{const passage=offered.find(passage=>passage.id===chosen.passageId)!;return {claimId:chosen.claimId,...passage,sourceExcerptDigest:createHash("sha256").update(sources.find(source=>source.id===passage.sourceId)!.excerpt).digest("hex")};})},null,2));
  return bound;
}
