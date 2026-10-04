import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { subjectPresentationScope } from "./subject-presentation-scope";
import { getSubjectLesson } from "./subject-library";
import { getSubjectMechanism } from "./subject-mechanism-store";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const check = z.object({passed:z.literal(true),observation:z.string().min(20).max(1600)}).strict();
const artifact = z.object({path:z.string().min(1).max(1200),sha256:digest}).strict();
const views = ["wide-light","wide-dark","narrow-light","narrow-dark"] as const;
const checks = z.object({
  unchangedReader:check, themeAndTypography:check, notificationLegibility:check,
  longAndStackedNotices:check, persistentUndo:check, keyboardFocus:check,
  hoverPause:check, dismissal:check, navigation:check,
}).strict();
export const subjectWorkspaceReviewSchema = z.object({
  version:z.literal(1),policy:z.literal("subjects-scoped-v1"),
  coreDigest:digest,integrationDigest:digest,legacyPresentationDigest:digest,
  authorId:z.string().trim().min(1).max(160),reviewerId:z.string().trim().min(1).max(160),
  reviewedAt:z.string().datetime(),passed:z.literal(true),findings:z.array(z.string()).length(0),
  views:z.array(z.object({
    id:z.enum(views),viewportWidth:z.union([z.literal(1440),z.literal(900)]),viewportHeight:z.literal(900),
    theme:z.enum(["light","dark"]),audit:artifact,captures:z.array(artifact).min(1).max(6),
  }).strict()).length(4),checks,
}).strict();
export type SubjectWorkspaceReview = z.infer<typeof subjectWorkspaceReviewSchema>;
const publicAcceptanceSchema = z.object({
  version:z.literal(1),policy:z.literal("subjects-scoped-v1"),coreDigest:digest,integrationDigest:digest,
  legacyPresentationDigest:digest,reportDigest:digest,reviewerId:z.string().min(1).max(160),
  reviewedAt:z.string().datetime(),viewCount:z.literal(4),
}).strict();
export function validateSubjectWorkspaceReview(input:unknown, scope:Awaited<ReturnType<typeof subjectPresentationScope>>) {
  const report=subjectWorkspaceReviewSchema.parse(input);
  if(report.authorId.trim().toLowerCase()===report.reviewerId.trim().toLowerCase())throw new Error("Workspace review requires an independent reviewer");
  if(report.coreDigest!==scope.coreDigest||report.integrationDigest!==scope.integrationDigest)throw new Error("Workspace review is stale");
  if(report.legacyPresentationDigest!==scope.legacyCore.legacyPresentationDigest)throw new Error("Workspace review legacy provenance mismatch");
  if(new Set(report.views.map(view=>view.id)).size!==4)throw new Error("Workspace review needs four distinct views");
  for(const view of report.views)if(view.viewportWidth!==(view.id.startsWith("wide")?1440:900)||view.theme!==(view.id.endsWith("light")?"light":"dark"))throw new Error("Workspace view mismatch");
  return report;
}
const hash=(bytes:string|Buffer)=>createHash("sha256").update(bytes).digest("hex");
const finite = z.number().finite();
const rectSchema = z.object({x:finite.min(-1_000_000).max(1_000_000),y:finite.min(-1_000_000).max(1_000_000),width:finite.positive().max(1_000_000),height:finite.positive().max(1_000_000)}).strict();
const fontSize = z.string().regex(/^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)px$/).max(30);
const font = {fontFamily:z.string().min(1).max(500),fontSize,fontWeight:z.string().min(1).max(100)};
const sampleSchema = z.object({rect:rectSchema,...font,lineHeight:z.string().min(1).max(100),color:z.string().min(1).max(100),background:z.string().min(1).max(100)}).strict();
const bindingsSchema = z.object({
  lessonId:z.literal("resnet"),contentDigest:digest,parentContentDigest:digest,rendererDigest:digest,
  coreDigest:digest,integrationDigest:digest,legacyFullDigest:digest,reconstructedLegacyDigest:digest,
  scopeVersion:z.literal("subjects-scoped-v1"),scopeCoreEquivalent:z.enum(["true","false"]),harnessDigest:digest,
}).strict();
const snapshotSchema = z.object({
  at:z.string().datetime(),bindings:bindingsSchema,
  viewport:z.object({width:z.union([z.literal(1440),z.literal(900)]),height:z.literal(900),scrollX:finite.min(0),scrollY:finite.min(0)}).strict(),
  theme:z.enum(["light","dark"]),fontsReady:z.literal(true),navigationExpanded:z.boolean(),selectedBeat:z.string().min(1).max(500),playing:z.literal("false"),
  core:z.object({main:sampleSchema,reader:sampleSchema,article:sampleSchema,mechanism:sampleSchema,diagram:sampleSchema,controls:sampleSchema}).strict(),
  diagramTexts:z.array(z.object({text:z.string().min(1).max(2000),rect:rectSchema,...font}).strict()).min(1).max(500),
  notices:z.array(z.object({text:z.string().min(1).max(4000),rect:rectSchema,buttons:z.array(z.object({text:z.string().max(500),label:z.string().max(500).nullable(),disabled:z.boolean()}).strict()).max(10)}).strict()).max(10),
  focused:z.object({tag:z.string().max(100),label:z.string().max(500).nullable(),text:z.string().max(120)}).strict(),
  undoCount:z.number().int().min(0).max(1000),events:z.array(z.object({at:z.string().datetime(),kind:z.string().min(1).max(100),detail:z.string().max(500)}).strict()).max(100),
}).strict();
export const subjectWorkspaceAuditSchema = z.object({
  version:z.literal(1),kind:z.literal("workspace-overlay-observations"),syntheticNotices:z.literal(true),requiresIndependentVisualReview:z.literal(true),
  capturedAt:z.string().datetime(),reviewerNotes:z.string().max(4000),
  audits:z.array(z.object({label:z.enum(["baseline","comparison"]),previewScale:finite.min(.2).max(1),before:snapshotSchema.nullable(),after:snapshotSchema,differences:z.array(z.string().max(500)).max(100).nullable()}).strict()).min(2).max(128),
}).strict();
type Snapshot = z.infer<typeof snapshotSchema>;
export type WorkspaceCanonicalEvidence = {bindings:z.infer<typeof bindingsSchema>;beatLabels:readonly string[]};
const canonicalHarnessFiles = ["src/components/workspace-review.tsx","src/app/subjects/review/workspace/page.tsx","src/app/subjects/review/workspace/frame/page.tsx"];
/** Resolve code-owned bindings independently of the submitted audit and its claimed differences. */
export async function canonicalSubjectWorkspaceEvidence() {
  const [scope,lesson,harnessManifest] = await Promise.all([
    subjectPresentationScope(),getSubjectLesson("resnet"),
    Promise.all(canonicalHarnessFiles.map(async file=>[file,hash(await readFile(path.resolve(file)))])),
  ]);
  if(!lesson)throw new Error("Canonical workspace lesson is unavailable");
  const mechanism=await getSubjectMechanism(lesson,{allowSourcePassed:true});
  if(!mechanism)throw new Error("Canonical workspace mechanism is unavailable");
  const bindings=bindingsSchema.parse({lessonId:lesson.id,contentDigest:mechanism.review.contentDigest,parentContentDigest:lesson.review.contentDigest,
    rendererDigest:mechanism.review.rendererDigest,coreDigest:scope.coreDigest,integrationDigest:scope.integrationDigest,
    legacyFullDigest:scope.legacyCore.legacyPresentationDigest,reconstructedLegacyDigest:scope.legacyCore.reconstructedLegacyDigest,
    scopeVersion:scope.version,scopeCoreEquivalent:String(scope.legacyCore.equivalent),harnessDigest:hash(JSON.stringify(harnessManifest))});
  return {scope,bindings,beatLabels:mechanism.beats.map(beat=>`Show ${beat.title}`)};
}
// Object key order is not evidence. Array order, text, coordinates and style values are.
function stable(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function subjectWorkspaceSnapshotDifferences(before:Snapshot,after:Snapshot) {
  const differences:string[]=[];
  for(const field of ["theme","fontsReady","navigationExpanded","selectedBeat","playing","viewport","core","diagramTexts","bindings"] as const)
    if(stable(before[field])!==stable(after[field]))differences.push(field);
  return differences;
}
/** Validate raw browser measurements, never the harness's self-reported pass/fail list. */
export function validateSubjectWorkspaceAudit(input:unknown, view:SubjectWorkspaceReview["views"][number], canonical:WorkspaceCanonicalEvidence) {
  const audit=subjectWorkspaceAuditSchema.parse(input),baselines=new Set<string>();
  let viewBaselines=0,stackedComparisons=0;
  for(const observation of audit.audits) {
    const {before,after}=observation;
    for(const snapshot of [before,after])if(snapshot) {
      if(stable(snapshot.bindings)!==stable(canonical.bindings))throw new Error("Workspace audit canonical bindings mismatch");
      if(!canonical.beatLabels.includes(snapshot.selectedBeat))throw new Error("Workspace audit selected beat is not canonical");
    }
    const matches=after.viewport.width===view.viewportWidth&&after.viewport.height===view.viewportHeight&&after.theme===view.theme;
    if(observation.label==="baseline") {
      if(before!==null||observation.differences!==null||after.notices.length)throw new Error("Workspace baseline must have no notices or comparison");
      baselines.add(stable(after));
      if(matches)viewBaselines++;
    } else {
      if(!before||!baselines.has(stable(before))||before.notices.length)throw new Error("Workspace comparison needs its preceding recorded hidden baseline");
      const actual=subjectWorkspaceSnapshotDifferences(before,after);
      if(actual.length)throw new Error(`Workspace measured presentation changed: ${actual.join(", ")}`);
      if(!observation.differences||observation.differences.length)throw new Error("Workspace claimed comparison differs from measured comparison");
      if(matches&&after.notices.length>=2&&after.notices.some(notice=>notice.buttons.some(button=>!button.disabled&&(button.text.trim()==="Undo"||button.label?.trim()==="Undo"))))stackedComparisons++;
    }
  }
  if(!viewBaselines||!stackedComparisons)throw new Error(`Workspace audit lacks hidden baseline and stacked Undo evidence for ${view.id}`);
  return audit;
}
/** Evidence is read only at review time; this helper is not wired to the publication gate. */
export async function verifySubjectWorkspaceArtifacts(report:SubjectWorkspaceReview, privateRoot=path.resolve(".artifacts/subjects")) {
  const canonical=await canonicalSubjectWorkspaceEvidence();
  validateSubjectWorkspaceReview(report,canonical.scope);
  const root=await realpath(privateRoot),seen=new Set<string>(),audits=new Map<string,unknown>();
  for(const view of report.views) {
    const artifacts = [{kind:"audit",artifact:view.audit}, ...view.captures.map(artifact=>({kind:"capture",artifact}))];
    for(const {kind,artifact} of artifacts) {
      const file=await realpath(artifact.path),info=await stat(file);
      if(!file.startsWith(root+path.sep)||!info.isFile()||info.size>(kind==="audit"?256*1024:10*1024*1024))throw new Error("Workspace evidence must be bounded private artifacts");
      const bytes=await readFile(file);
      if(hash(bytes)!==artifact.sha256)throw new Error("Workspace artifact fingerprint mismatch");
      if(kind==="audit") {
        if(!file.endsWith(".json"))throw new Error("Workspace audit must be JSON");
        let audit=audits.get(artifact.sha256);
        if(!audit){audit=JSON.parse(bytes.toString("utf8"));audits.set(artifact.sha256,audit);}
        validateSubjectWorkspaceAudit(audit,view,canonical);
      } else {
        const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();
        if(!file.endsWith(".png")||metadata.format!=="png"||!metadata.width||!metadata.height||metadata.width<320||metadata.height<240)throw new Error("Workspace capture must be a readable PNG screenshot");
        await sharp(bytes,{limitInputPixels:40000000}).stats();
        if(seen.has(artifact.sha256))throw new Error("Workspace views cannot reuse a screenshot");
        seen.add(artifact.sha256);
      }
    }
  }
}
export function subjectWorkspaceAcceptance(report:SubjectWorkspaceReview) {
  return publicAcceptanceSchema.parse({version:1,policy:report.policy,coreDigest:report.coreDigest,integrationDigest:report.integrationDigest,
    legacyPresentationDigest:report.legacyPresentationDigest,reportDigest:hash(JSON.stringify(report)),reviewerId:report.reviewerId,reviewedAt:report.reviewedAt,viewCount:4});
}
/** This extra proof covers shared controls only; the original per-beat review is still mandatory. */
export async function subjectWorkspaceAccepted(scope:Awaited<ReturnType<typeof subjectPresentationScope>>) {
  try {
    const receipt=publicAcceptanceSchema.parse(JSON.parse(await readFile(path.resolve("src/content/subjects/workspace-acceptance.json"),"utf8")));
    return receipt.coreDigest===scope.coreDigest&&receipt.integrationDigest===scope.integrationDigest&&
      receipt.legacyPresentationDigest===scope.legacyCore.legacyPresentationDigest;
  } catch {return false;}
}
