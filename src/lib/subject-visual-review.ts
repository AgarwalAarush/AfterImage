import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { layoutSubjectMechanism, type SubjectMechanism } from "./subject-mechanism";
import { subjectMechanismQualityVersion } from "./subject-mechanism-quality";
import { subjectVisualReviewSchema, subjectVisualBrowserAuditSchema, type SubjectVisualReview, type SubjectVisualAcceptance } from "./subject-visual-review-schema";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const subjectVisualPresentationFiles = [
  "src/app/globals.css", "src/app/theme.css", "src/app/ui.css", "src/app/layout.tsx", "src/lib/theme.ts",
  "src/components/subject-reader.tsx", "src/components/subject-prose.tsx",
  "src/lib/subject-visual-review-schema.ts", "src/lib/subject-visual-review.ts",
  "src/lib/subject-mechanism-quality.ts", "src/lib/subject-mechanism-store.ts", "package-lock.json",
];
let productionPresentationDigest: Promise<string> | undefined;
/** Geometry has its own fingerprint. Appearance includes local fonts and the imported font CSS/bytes. */
export function subjectVisualPresentationDigest() {
  // Production code/font bytes are immutable for the life of a deployment; development edits are not.
  if(process.env.NODE_ENV==="production")return productionPresentationDigest??=computePresentationDigest();
  return computePresentationDigest();
}
async function computePresentationDigest() {
  const fontDirectories = ["public/fonts", "node_modules/@fontsource-variable/newsreader", "node_modules/@fontsource/ibm-plex-mono"];
  const fontFiles: string[] = [];
  async function fonts(directory: string) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) await fonts(file);
      else if (/\.(?:woff2?|css)$/.test(item.name)) fontFiles.push(file);
    }
  }
  for (const directory of fontDirectories) await fonts(directory);
  const files = [...subjectVisualPresentationFiles, ...fontFiles].sort();
  const manifest = await Promise.all(files.map(async file => [file, hash(await readFile(file))]));
  return hash(JSON.stringify(manifest));
}
export function subjectBeatStateDigest(mechanism: SubjectMechanism, beatIndex: number) {
  const beat = mechanism.beats[beatIndex];
  if (!beat) throw new Error("Unknown visual review beat");
  return hash(JSON.stringify({ objects: [...beat.objects].sort((a,b)=>a.objectId.localeCompare(b.objectId)), relationships: [...beat.relationships].sort((a,b)=>a.relationshipId.localeCompare(b.relationshipId)) }));
}
type Bindings = { lessonId: string; contentDigest: string; parentContentDigest: string; rendererDigest: string; presentationDigest: string };
const expectedViews = new Map([
  ["wide-light", { width: 1440, theme: "light" }], ["wide-dark", { width: 1440, theme: "dark" }],
  ["narrow-light", { width: 900, theme: "light" }], ["narrow-dark", { width: 900, theme: "dark" }],
]);
/** Coverage is checked against the actual storyboard, not a reviewer-supplied endpoint count. */
export function validateSubjectVisualReview(input: unknown, mechanism: SubjectMechanism, bindings: Bindings): SubjectVisualReview {
  const report = subjectVisualReviewSchema.parse(input);
  for (const [key,value] of Object.entries(bindings)) if (report[key as keyof Bindings] !== value) throw new Error("Visual review is stale");
  if (report.semanticPolicyVersion !== subjectMechanismQualityVersion) throw new Error("Visual review uses a stale semantic policy");
  if (report.authorId === report.reviewerId) throw new Error("Visual review needs a separate independent reviewer");
  if (new Set(report.views.map(view=>view.id)).size!==4) throw new Error("Duplicate visual review views");
  for (const view of report.views) { const expected=expectedViews.get(view.id)!;if(view.viewportWidth!==expected.width||view.theme!==expected.theme)throw new Error("Visual review desktop view mismatch"); }
  const frames=new Map(report.frames.map(frame=>[frame.id,frame]));
  if(frames.size!==report.frames.length)throw new Error("Duplicate visual review frame identity");
  if(report.frames.length!==mechanism.beats.length*4)throw new Error("Visual review must capture every beat in every desktop view");
  const frameKeys=new Set<string>();
  for(const frame of report.frames){
    const key=`${frame.viewId}:${frame.beatIndex}`;
    if(frameKeys.has(key))throw new Error("Duplicate visual review state coverage");frameKeys.add(key);
    if(frame.stateDigest!==subjectBeatStateDigest(mechanism,frame.beatIndex))throw new Error("Visual review state does not match the storyboard");
    if(frame.svgWidth>expectedViews.get(frame.viewId)!.width)throw new Error("Visual review diagram overflows desktop viewport");
    const regions=new Set(frame.artifacts.flatMap(artifact=>artifact.regions));
    if(["diagram","narration","controls"].some(region=>!regions.has(region as "diagram")))throw new Error("Visual review omits diagram, explanation, or controls");
    if(!frame.artifacts.some(artifact=>artifact.regions.includes("diagram")&&artifact.width>=frame.svgWidth-2&&artifact.height>=frame.svgHeight-2))throw new Error("Visual review needs a readable complete diagram capture");
  }
  if(report.transitions.length!==(mechanism.beats.length-1)*4)throw new Error("Visual review must inspect every adjacent transition in every desktop view");
  const transitionKeys=new Set<string>();
  for(const transition of report.transitions){
    const key=`${transition.viewId}:${transition.fromBeatIndex}`;
    if(transitionKeys.has(key))throw new Error("Duplicate transition coverage");transitionKeys.add(key);
    if(transition.toBeatIndex!==transition.fromBeatIndex+1||transition.toBeatIndex>=mechanism.beats.length)throw new Error("Visual review skips a storyboard transition");
    const before=frames.get(transition.beforeFrameId),after=frames.get(transition.afterFrameId);
    if(!before||!after||before.viewId!==transition.viewId||after.viewId!==transition.viewId||before.beatIndex!==transition.fromBeatIndex||after.beatIndex!==transition.toBeatIndex)throw new Error("Visual transition evidence endpoints mismatch");
    if(transition.motion.mode==="status-only"){
      if(!transition.motion.geometryStable||transition.motion.midpoint||transition.motion.properties.some(property=>!["fill","stroke","opacity"].includes(property)))throw new Error("Status-only transitions cannot claim spatial motion");
      if(before.svgWidth!==after.svgWidth||before.svgHeight!==after.svgHeight)throw new Error("Status-only transition changes diagram geometry");
    } else if(!transition.motion.midpoint)throw new Error("Spatial transitions require actual intermediate browser evidence");
  }
  return report;
}
/** Artifact validation happens at approval; private screenshots are never needed by a production reader. */
export async function verifySubjectVisualArtifacts(report: SubjectVisualReview, mechanism:SubjectMechanism, privateRoot=path.resolve(".artifacts/subjects")) {
  const root=await realpath(privateRoot),seen=new Map<string,{sha256:string;width:number;height:number}>();
  const artifacts=[...report.frames.flatMap(frame=>frame.artifacts),...report.transitions.flatMap(transition=>transition.motion.midpoint?.artifacts??[])];
  for(const artifact of artifacts){
    const file=await realpath(path.resolve(artifact.path));
    if(!file.startsWith(root+path.sep)||!file.endsWith(".png"))throw new Error("Visual evidence must be a private Subjects PNG");
    const previous=seen.get(file);
    if(previous&&(previous.sha256!==artifact.sha256||previous.width!==artifact.width||previous.height!==artifact.height))throw new Error("Conflicting visual artifact fingerprints or dimensions");
    if(previous)continue;
    if((await stat(file)).size>10*1024*1024)throw new Error("Visual PNG exceeds bounded review size");
    const bytes=await readFile(file);
    if(hash(bytes)!==artifact.sha256)throw new Error("Visual PNG fingerprint mismatch");
    const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();
    if(metadata.format!=="png"||metadata.width!==artifact.width||metadata.height!==artifact.height)throw new Error("Visual PNG dimensions or format mismatch");
    await sharp(bytes,{limitInputPixels:40000000}).stats();
    seen.set(file,{sha256:artifact.sha256,width:artifact.width,height:artifact.height});
  }
  const hashes=report.frames.map(frame=>frame.artifacts.map(artifact=>artifact.sha256).sort().join(":"));
  if(new Set(hashes).size!==report.frames.length)throw new Error("One screenshot set cannot prove distinct storyboard states and desktop views");
  const inside=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number},padding:number)=>a.x>=b.x+padding-.5&&a.y>=b.y+padding-.5&&a.x+a.w<=b.x+b.w-padding+.5&&a.y+a.h<=b.y+b.h-padding+.5;
  const auditedFrames=new Map<string,ReturnType<typeof subjectVisualBrowserAuditSchema.parse>>();
  for(const frame of report.frames){
    const file=await realpath(path.resolve(frame.browserAudit.path));
    if(!file.startsWith(root+path.sep)||!file.endsWith(".json")||(await stat(file)).size>256*1024)throw new Error("Browser audit must be a bounded private Subjects JSON");
    const bytes=await readFile(file);if(hash(bytes)!==frame.browserAudit.sha256)throw new Error("Browser audit fingerprint mismatch");
    const audit=subjectVisualBrowserAuditSchema.parse(JSON.parse(bytes.toString("utf8")));
    for(const key of ["lessonId","contentDigest","parentContentDigest","rendererDigest","presentationDigest"] as const)if(audit[key]!==report[key])throw new Error("Browser audit is stale");
    if(audit.frameId!==frame.id||audit.viewId!==frame.viewId||audit.beatIndex!==frame.beatIndex||audit.stateDigest!==frame.stateDigest)throw new Error("Browser audit state or view mismatch");
    if(JSON.stringify([...audit.artifactDigests].sort())!==JSON.stringify(frame.artifacts.map(artifact=>artifact.sha256).sort()))throw new Error("Browser audit refers to different screenshots");
    const view=report.views.find(view=>view.id===frame.viewId)!;
    if(audit.facts.theme!==view.theme||audit.facts.viewportWidth!==view.viewportWidth||Math.abs(audit.facts.canvasWidth-frame.svgWidth)>.5||!audit.facts.fonts.includes(frame.resolvedFontFamily))throw new Error("Browser audit desktop presentation mismatch");
    const viewBox=audit.facts.viewBox.trim().split(/[ ,]+/).map(Number);
    if(viewBox.length!==4||viewBox.some(value=>!Number.isFinite(value))||viewBox[0]!==0||viewBox[1]!==0||viewBox[2]<=0||viewBox[3]<=0)throw new Error("Browser audit viewBox is invalid");
    const scale=frame.svgWidth/viewBox[2],layout=layoutSubjectMechanism(mechanism,viewBox[2]);
    if(Math.abs(frame.svgHeight-viewBox[3]*scale)>.5||Math.abs(layout.height-viewBox[3])>.5)throw new Error("Browser audit canvas differs from current geometry");
    const actualObjects=new Map(audit.facts.objects.map(object=>[object.id,object]));
    if(actualObjects.size!==mechanism.objects.length)throw new Error("Browser audit object coverage mismatch");
    const texts=[];
    for(const expected of mechanism.beats[frame.beatIndex].objects){
      const object=actualObjects.get(expected.objectId);
      if(!object||object.status!==expected.status||JSON.stringify(object.entities.map(entity=>entity.id))!==JSON.stringify(expected.entityIds))throw new Error("Browser audit object identity mismatch");
      for(const label of object.labels){if(!inside(label,object.bounds,6))throw new Error("Actual browser label exceeds object inset");texts.push(label);}
      for(const entity of object.entities){if(!inside(entity.pill,object.bounds,6)||!inside(entity,entity.pill,2))throw new Error("Actual browser identity exceeds glyph inset");texts.push(entity);}
      const labels=layout.nativeLabels.find(labels=>labels.id===object.id)!;
      if(labels.textAnchor==="start"){
        if(object.labels.some(label=>Math.abs(label.x-object.labels[0].x)>.5))throw new Error("Actual browser title/detail alignment axes differ");
        if(object.entities.length===1){
          const left=Math.min(...object.labels.map(label=>label.x)),right=Math.max(...object.labels.map(label=>label.x+label.w)),glyph=object.entities[0].pill,gap=glyph.x-right;
          if(gap<8||gap>32)throw new Error("Actual browser identity is detached from its text group");
          if(Math.abs((left+glyph.x+glyph.w)/2-(object.bounds.x+object.bounds.w/2))>18)throw new Error("Actual browser text and identity group is off-center");
        }
      }
    }
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
      const a=texts[i],b=texts[j];if(a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1)throw new Error("Actual browser text overlaps");
    }
    auditedFrames.set(frame.id,audit);
  }
  for(const transition of report.transitions){
    if(!transition.motion.geometryStable)continue;
    const before=auditedFrames.get(transition.beforeFrameId)!.facts.objects,after=auditedFrames.get(transition.afterFrameId)!.facts.objects;
    const origin=(objects:typeof before)=>({x:Math.min(...objects.map(object=>object.bounds.x)),y:Math.min(...objects.map(object=>object.bounds.y))}),a=origin(before),b=origin(after);
    for(const object of before){
      const next=after.find(candidate=>candidate.id===object.id)!;
      if(Math.abs((object.bounds.x-a.x)-(next.bounds.x-b.x))>.5||Math.abs((object.bounds.y-a.y)-(next.bounds.y-b.y))>.5||Math.abs(object.bounds.w-next.bounds.w)>.5||Math.abs(object.bounds.h-next.bounds.h)>.5)throw new Error("Actual browser stable object geometry jumps between beats");
    }
  }
}
export function subjectVisualAcceptance(report:SubjectVisualReview):SubjectVisualAcceptance {
  return {version:2,reportDigest:hash(JSON.stringify(report)),presentationDigest:report.presentationDigest,semanticPolicyVersion:report.semanticPolicyVersion,reviewerId:report.reviewerId,viewCount:4,beatCount:report.frames.length/4,transitionCount:report.transitions.length};
}
