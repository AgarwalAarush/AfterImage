import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { subjectBeatStateDigest, subjectVisualPresentationDigest } from "../src/lib/subject-visual-review";
import { subjectMechanismRendererDigest } from "../src/lib/subject-mechanism-store";
import { subjectVisualBrowserAuditSchema } from "../src/lib/subject-visual-review-schema";
import type { PublishedSubjectMechanism } from "../src/lib/subject-mechanism";

const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
/** Crop mechanism review regions from actual browser captures; never generate review frames.
 * The independent critic must still verify complete diagram/narration/control coverage.
 */
async function main(){
  const root=path.resolve(process.argv[2]||".artifacts/subjects/system-review");
  if(!root.startsWith(path.resolve(".artifacts/subjects")+path.sep))throw new Error("Capture batches must stay under private Subjects artifacts");
  const captures=JSON.parse(await readFile(path.join(root,"capture-manifest.json"),"utf8"));
  const bindings={rendererDigest:await subjectMechanismRendererDigest(),presentationDigest:await subjectVisualPresentationDigest()};
  const frames=[];
  for(const capture of captures){
    if(capture.bindings?.rendererDigest!==bindings.rendererDigest||capture.bindings?.presentationDigest!==bindings.presentationDigest)throw new Error("Capture bindings changed; repeat browser capture");
    const scene:PublishedSubjectMechanism=JSON.parse(await readFile(path.resolve("src/content/subjects/mechanisms",capture.lessonId+".json"),"utf8"));
    if(capture.bindings.contentDigest!==scene.review.contentDigest||capture.bindings.parentContentDigest!==scene.parentContentDigest)throw new Error("Captured scene changed");
    if(!path.resolve(capture.rawPath).startsWith(root+path.sep))throw new Error("Browser evidence must stay private");
    const crop=capture.context.crop, metadata=await sharp(capture.rawPath).metadata();
    if(crop.left<0||crop.top<0||crop.left+crop.width>metadata.width!||crop.top+crop.height>metadata.height!)throw new Error("Incomplete browser section capture");
    const bytes=await sharp(capture.rawPath).extract(crop).png().toBuffer(),artifactPath=path.join(root,capture.id+".png");
    await writeFile(artifactPath,bytes);
    const artifact={path:artifactPath,sha256:hash(bytes),width:crop.width,height:crop.height,regions:["diagram","narration","controls"]};
    const stateDigest=subjectBeatStateDigest(scene,capture.beatIndex);
    const audit=subjectVisualBrowserAuditSchema.parse({version:1,lessonId:capture.lessonId,...capture.bindings,frameId:capture.id,viewId:capture.viewId,beatIndex:capture.beatIndex,stateDigest,artifactDigests:[artifact.sha256],facts:capture.audit});
    const auditBytes=Buffer.from(JSON.stringify(audit,null,2)),auditPath=path.join(root,capture.id+"-audit.json");await writeFile(auditPath,auditBytes);
    frames.push({id:capture.id,lessonId:capture.lessonId,viewId:capture.viewId,beatIndex:capture.beatIndex,stateDigest,svgWidth:capture.audit.canvasWidth,svgHeight:capture.context.svgHeight,captureSource:"browser",resolvedFontFamily:capture.audit.fonts[0],artifacts:[artifact],browserAudit:{path:auditPath,sha256:hash(auditBytes)},capturedAt:capture.capturedAt,context:capture.context});
  }
  await writeFile(path.join(root,"frame-index.json"),JSON.stringify({bindings,frames},null,2));
  console.log(JSON.stringify({frames:frames.length,bindings}));
}
main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
