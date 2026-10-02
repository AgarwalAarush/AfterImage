import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSubjectLesson } from "../src/lib/subject-library";
import { publishedSubjectMechanismSchema, subjectMechanismSchema, validateSubjectMechanism } from "../src/lib/subject-mechanism";
import { validateSubjectMechanismQuality } from "../src/lib/subject-mechanism-quality";
import { mechanismDigest, subjectMechanismRendererDigest, validateMechanismMath } from "../src/lib/subject-mechanism-store";

/** Refresh presentation only; scientific scene and primary-source bindings cannot change. */
async function main() {
  if(!process.argv.includes("--run"))throw new Error("Use --run to reset presentation approval while preserving exact reviewed semantics");
  const directory=path.resolve("src/content/subjects/mechanisms"),rendererDigest=await subjectMechanismRendererDigest();
  for(const file of (await readdir(directory)).filter(file=>file.endsWith(".json"))) {
    const target=path.join(directory,file), input=publishedSubjectMechanismSchema.parse(JSON.parse(await readFile(target,"utf8")));
    const lesson=await getSubjectLesson(input.lessonId);
    if(!lesson||lesson.review.contentDigest!==input.parentContentDigest)throw new Error(`${file}: changed parent requires source review`);
    if(mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(input)))!==input.review.contentDigest)throw new Error(`${file}: changed semantics require source review`);
    validateSubjectMechanism(input,lesson,lesson.sources);validateMechanismMath(input,lesson);validateSubjectMechanismQuality(input);
    const review={...input.review,status:"source-passed" as const,rendererDigest,visualReviewedAt:null,visualAcceptance:undefined};
    await writeFile(target+".tmp",JSON.stringify({...input,review},null,2)+"\n");await rename(target+".tmp",target);
    console.log(`PRESENTATION REVIEW REQUIRED ${input.lessonId}`);
  }
}
main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
