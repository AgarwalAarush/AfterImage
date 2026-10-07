import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SubjectReader } from "@/components/subject-reader";
import { WorkspaceReviewFrame } from "@/components/workspace-review";
import { getSubjectLesson, subjectCatalog } from "@/lib/subject-library";
import { getSubjectMechanism } from "@/lib/subject-mechanism-store";
import { subjectPresentationScope } from "@/lib/subject-presentation-scope";
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{theme?:string}>}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const entry = subjectCatalog.find(item => item.id === "resnet"), lesson = await getSubjectLesson("resnet");
  if (!entry || !lesson) notFound();
  const mechanism = await getSubjectMechanism(lesson,{allowSourcePassed:true});
  if (!mechanism) notFound();
  const theme = (await searchParams).theme === "dark" ? "dark" : "light";
  const harnessFiles = ["src/components/workspace-review.tsx","src/app/subjects/review/workspace/page.tsx","src/app/subjects/review/workspace/frame/page.tsx"];
  const harnessManifest = await Promise.all(harnessFiles.map(async file => [file,createHash("sha256").update(await readFile(path.resolve(file))).digest("hex")]));
  const scope = await subjectPresentationScope();
  const bindings = {lessonId:lesson.id,contentDigest:mechanism.review.contentDigest,parentContentDigest:lesson.review.contentDigest,
    rendererDigest:mechanism.review.rendererDigest,coreDigest:scope.coreDigest,integrationDigest:scope.integrationDigest,
    legacyFullDigest:scope.legacyCore.legacyPresentationDigest,reconstructedLegacyDigest:scope.legacyCore.reconstructedLegacyDigest,
    scopeVersion:scope.version,scopeCoreEquivalent:String(scope.legacyCore.equivalent),
    harnessDigest:createHash("sha256").update(JSON.stringify(harnessManifest)).digest("hex")};
  return <WorkspaceReviewFrame theme={theme} bindings={bindings}><SubjectReader entry={entry} lesson={lesson} mechanism={mechanism}/></WorkspaceReviewFrame>;
}
