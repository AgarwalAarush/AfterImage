import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publishedSubjectMechanismSchema, subjectMechanismSchema, validateSubjectMechanism } from "./subject-mechanism";
import { validateSubjectMath } from "./subject-math";
import type { PublishedLesson } from "./subjects";
import { subjectPresentationScope } from "./subject-presentation-scope";
import { subjectOwnerPdfReaderAccepted, subjectOwnerTextWidthAccepted, subjectWorkspaceAccepted } from "./subject-workspace-review";
import { subjectMechanismQualityVersion, validateSubjectMechanismQuality } from "./subject-mechanism-quality";
import { subjectDiagramTextFile, subjectDiagramTextIsHistorical, subjectRendererSource } from "./subject-renderer-boundary";

export const subjectMechanismRendererFiles=["src/lib/subject-mechanism.ts","src/components/subject-mechanism.tsx","src/components/subject-mechanism.module.css","src/lib/scene-layout.ts","src/lib/diagram-text-metrics.ts","src/lib/diagram-text-metrics.json"];
export const mechanismDigest=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function subjectMechanismRendererDigest(){
  const helper=await readFile(path.resolve(subjectDiagramTextFile));
  const files=await Promise.all(subjectMechanismRendererFiles.map(async file=>[file,mechanismDigest(subjectRendererSource(file,await readFile(path.resolve(file),"utf8"),helper))]));
  // A changed helper requires a new renderer review; only the pinned, exact
  // extraction can retain the historical digest and its existing approval.
  if(!subjectDiagramTextIsHistorical(helper))files.push([subjectDiagramTextFile,mechanismDigest(helper.toString("utf8"))]);
  return mechanismDigest(JSON.stringify(files));
}
export function validateMechanismMath(input:unknown,lesson:PublishedLesson){
  const mechanism=subjectMechanismSchema.parse(input);
  validateSubjectMath({...lesson,title:mechanism.title,summary:mechanism.introduction,sections:mechanism.beats.map((beat,index)=>({...lesson.sections[0],id:`beat-${index}`,markdown:beat.explanation})),objectives:[mechanism.takeaway]});
}
/** The development reviewer may request source-passed drafts; ordinary readers never do. */
export async function getSubjectMechanism(lesson:PublishedLesson,{allowSourcePassed=false}:{allowSourcePassed?:boolean}={}){
  if(!/^[a-z0-9-]+$/.test(lesson.id))return null;
  try{
    const input=publishedSubjectMechanismSchema.parse(JSON.parse(await readFile(path.resolve("src/content/subjects/mechanisms",lesson.id+".json"),"utf8")));
    if(input.lessonId!==lesson.id||input.parentContentDigest!==lesson.review.contentDigest||(!allowSourcePassed&&input.review.status!=="passed")||input.review.status==="passed"&&!input.review.visualReviewedAt)return null;
    if(input.review.contentDigest!==mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(input)))||input.review.rendererDigest!==await subjectMechanismRendererDigest())return null;
    if(!allowSourcePassed){
      const acceptance=input.review.visualAcceptance;
      if(!acceptance||acceptance.semanticPolicyVersion!==subjectMechanismQualityVersion||acceptance.beatCount!==input.beats.length||acceptance.transitionCount!==(input.beats.length-1)*4)return null;
      const scope=await subjectPresentationScope();
      const current=acceptance.presentationDigest===scope.coreDigest;
      const unchangedLegacy=scope.legacyCore.equivalent && acceptance.presentationDigest===scope.legacyCore.legacyPresentationDigest;
      const ownerTextWidth=acceptance.presentationDigest===scope.legacyCore.legacyPresentationDigest&&await subjectOwnerTextWidthAccepted(scope);
      const ownerPdfReader=acceptance.presentationDigest===scope.legacyCore.legacyPresentationDigest&&await subjectOwnerPdfReaderAccepted(scope);
      // Existing every-beat acceptance remains necessary. Owner exceptions are
      // separate exact-source decisions, never invented independent reviews.
      if(!(current||unchangedLegacy||ownerTextWidth||ownerPdfReader)||!await subjectWorkspaceAccepted(scope))return null;
    }
    validateSubjectMechanism(input,lesson,lesson.sources);validateMechanismMath(input,lesson);
    validateSubjectMechanismQuality(input);
    return input;
  }catch{return null;}
}
