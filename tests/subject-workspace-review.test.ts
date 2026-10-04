import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import {
  canonicalSubjectWorkspaceEvidence, subjectWorkspaceAuditSchema, validateSubjectWorkspaceAudit,
  validateSubjectWorkspaceReview, verifySubjectWorkspaceArtifacts, type SubjectWorkspaceReview,
  type WorkspaceCanonicalEvidence,
} from "../src/lib/subject-workspace-review";

const digest=(text:string|Buffer)=>createHash("sha256").update(text).digest("hex");
const time="2026-10-03T20:00:00.000Z";
const viewIds=["wide-light","wide-dark","narrow-light","narrow-dark"] as const;
const view=(id:typeof viewIds[number])=>({id,viewportWidth:id.startsWith("wide")?1440 as const:900 as const,viewportHeight:900 as const,theme:id.endsWith("light")?"light" as const:"dark" as const,audit:{path:"audit.json",sha256:"a".repeat(64)},captures:[{path:id+".png",sha256:"b".repeat(64)}]});
const canonical:WorkspaceCanonicalEvidence={bindings:{lessonId:"resnet",contentDigest:"1".repeat(64),parentContentDigest:"2".repeat(64),rendererDigest:"3".repeat(64),coreDigest:"4".repeat(64),integrationDigest:"5".repeat(64),legacyFullDigest:"6".repeat(64),reconstructedLegacyDigest:"6".repeat(64),scopeVersion:"subjects-scoped-v1",scopeCoreEquivalent:"true",harnessDigest:"7".repeat(64)},beatLabels:["Show Residual identity","Show Residual addition"]};
const clone=<T>(value:T):T=>structuredClone(value);
function snapshot(id:typeof viewIds[number],evidence=canonical) {
  const target=view(id),rect={x:100,y:100,width:300,height:80};
  const sample={rect,fontFamily:'"DM Sans", sans-serif',fontSize:"16px",fontWeight:"400",lineHeight:"24px",color:"rgb(0, 0, 0)",background:"rgba(0, 0, 0, 0)"};
  return {at:time,bindings:clone(evidence.bindings),viewport:{width:target.viewportWidth,height:900 as const,scrollX:0,scrollY:400},theme:target.theme,fontsReady:true as const,navigationExpanded:false,selectedBeat:evidence.beatLabels[0],playing:"false" as const,
    core:{main:clone(sample),reader:clone(sample),article:clone(sample),mechanism:clone(sample),diagram:clone(sample),controls:clone(sample)},
    diagramTexts:[{text:"Identity path",rect:clone(rect),fontFamily:sample.fontFamily,fontSize:"14px",fontWeight:"500"}],
    notices:[] as {text:string;rect:typeof rect;buttons:{text:string;label:string|null;disabled:boolean}[]}[],
    focused:{tag:"BODY",label:null,text:""},undoCount:0,events:[]};
}
function audit(evidence=canonical) {
  return {version:1 as const,kind:"workspace-overlay-observations" as const,syntheticNotices:true as const,requiresIndependentVisualReview:true as const,capturedAt:time,reviewerNotes:"Synthetic public regression fixture only.",
    audits:viewIds.flatMap(id=>{
      const baseline=snapshot(id,evidence),after=clone(baseline);
      after.notices=[{text:"Recommendation dismissed. You can undo this synthetic choice.",rect:{x:100,y:760,width:300,height:60},buttons:[{text:"Undo",label:null,disabled:false}]},{text:"Another synthetic status notice.",rect:{x:100,y:830,width:300,height:40},buttons:[]}];
      return [{label:"baseline" as const,previewScale:1,before:null,after:baseline,differences:null},{label:"comparison" as const,previewScale:1,before:clone(baseline),after,differences:[] as string[]}];
    })};
}
function report(scope:Awaited<ReturnType<typeof canonicalSubjectWorkspaceEvidence>>["scope"]):SubjectWorkspaceReview {
  const check={passed:true as const,observation:"Synthetic regression observation; no visual approval is granted."};
  return {version:1,policy:"subjects-scoped-v1",coreDigest:scope.coreDigest,integrationDigest:scope.integrationDigest,legacyPresentationDigest:scope.legacyCore.legacyPresentationDigest,authorId:"fixture-author",reviewerId:"fixture-reviewer",reviewedAt:time,passed:true,findings:[],views:viewIds.map(view),checks:{unchangedReader:check,themeAndTypography:check,notificationLegibility:check,longAndStackedNotices:check,persistentUndo:check,keyboardFocus:check,hoverPause:check,dismissal:check,navigation:check}};
}

test("a single audit may cover all four desktop views with real parsed baselines and stacked Undo",()=>{
  const input=audit();
  for(const id of viewIds)assert.doesNotThrow(()=>validateSubjectWorkspaceAudit(input,view(id),canonical));
});

test("measurements override a forged empty differences list",()=>{
  for(const change of [
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.core.diagram.rect.x+=1;},
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.core.reader.fontFamily="Different font";},
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.core.controls.fontSize="18px";},
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.diagramTexts[0].text="Changed identity";},
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.diagramTexts[0].rect.width+=1;},
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.selectedBeat=canonical.beatLabels[1];},
    (value:ReturnType<typeof audit>)=>{value.audits[1].after.viewport.scrollY+=1;},
  ]) {
    const input=audit();change(input);
    assert.throws(()=>validateSubjectWorkspaceAudit(input,view("wide-light"),canonical),/measured presentation changed/);
  }
});

test("canonical content, renderer, presentation and harness bindings are checked independently",()=>{
  for(const key of ["contentDigest","parentContentDigest","rendererDigest","coreDigest","integrationDigest","harnessDigest"] as const) {
    const input=audit();for(const observation of input.audits) {observation.after.bindings[key]="a".repeat(64);if(observation.before)observation.before.bindings[key]="a".repeat(64);}
    assert.throws(()=>validateSubjectWorkspaceAudit(input,view("wide-light"),canonical),/canonical bindings/);
  }
});

test("fonts must be loaded and the canonical beat must be paused in every snapshot",()=>{
  const unloaded=audit();Object.assign(unloaded.audits[1].after,{fontsReady:false});
  assert.throws(()=>validateSubjectWorkspaceAudit(unloaded,view("wide-light"),canonical));
  const playing=audit();Object.assign(playing.audits[1].after,{playing:"true"});
  assert.throws(()=>validateSubjectWorkspaceAudit(playing,view("wide-light"),canonical));
  const fakeBeat=audit();fakeBeat.audits[0].after.selectedBeat="Show unknown beat";
  assert.throws(()=>validateSubjectWorkspaceAudit(fakeBeat,view("wide-light"),canonical),/not canonical/);
});

test("missing targets, malformed and nonfinite rectangles fail before comparison",()=>{
  for(const invalid of [NaN,Infinity,-Infinity,0,-1]) {
    const input=audit();input.audits[0].after.core.diagram.rect.width=invalid;
    assert.equal(subjectWorkspaceAuditSchema.safeParse(input).success,false);
  }
  const input=audit();delete (input.audits[0].after.core as Partial<typeof input.audits[0]["after"]["core"]>).controls;
  assert.throws(()=>validateSubjectWorkspaceAudit(input,view("wide-light"),canonical));
});

test("each viewport/theme requires its own notice-free baseline and at least two notices with enabled Undo",()=>{
  const incomplete=audit();incomplete.audits=incomplete.audits.slice(0,6);
  assert.throws(()=>validateSubjectWorkspaceAudit(incomplete,view("narrow-dark"),canonical),/lacks hidden baseline/);
  const oneNotice=audit();oneNotice.audits[1].after.notices.pop();
  assert.throws(()=>validateSubjectWorkspaceAudit(oneNotice,view("wide-light"),canonical),/stacked Undo/);
  const disabled=audit();disabled.audits[1].after.notices[0].buttons[0].disabled=true;
  assert.throws(()=>validateSubjectWorkspaceAudit(disabled,view("wide-light"),canonical),/stacked Undo/);
  const noUndo=audit();noUndo.audits[1].after.notices[0].buttons[0].text="Close";
  assert.throws(()=>validateSubjectWorkspaceAudit(noUndo,view("wide-light"),canonical),/stacked Undo/);
  const visible=audit();visible.audits[0].after.notices=clone(visible.audits[1].after.notices);
  assert.throws(()=>validateSubjectWorkspaceAudit(visible,view("wide-light"),canonical),/baseline must have no notices/);
});

test("comparison cannot invent an unrecorded baseline or reuse a later baseline",()=>{
  const forged=audit();forged.audits[1].before!.at="2026-10-03T19:59:00.000Z";
  assert.throws(()=>validateSubjectWorkspaceAudit(forged,view("wide-light"),canonical),/preceding recorded hidden baseline/);
  const reversed=audit();[reversed.audits[0],reversed.audits[1]]=[reversed.audits[1],reversed.audits[0]];
  assert.throws(()=>validateSubjectWorkspaceAudit(reversed,view("wide-light"),canonical),/preceding recorded hidden baseline/);
});

test("legacy provenance equality does not bar a future separately reviewed core digest",async()=>{
  const evidence=await canonicalSubjectWorkspaceEvidence(),scope=clone(evidence.scope);
  scope.legacyCore.equivalent=false;scope.legacyCore.failures=["core-changed:fixture"];
  assert.doesNotThrow(()=>validateSubjectWorkspaceReview(report(scope),scope));
  const stale=report(scope);stale.legacyPresentationDigest="0".repeat(64);
  assert.throws(()=>validateSubjectWorkspaceReview(stale,scope),/legacy provenance/);
  const samePerson=report(scope);samePerson.reviewerId=" FIXTURE-AUTHOR ";
  assert.throws(()=>validateSubjectWorkspaceReview(samePerson,scope),/independent reviewer/);
});

async function artifacts(run:(value:SubjectWorkspaceReview,root:string,evidence:Awaited<ReturnType<typeof canonicalSubjectWorkspaceEvidence>>)=>Promise<void>) {
  const root=await mkdtemp(path.join(os.tmpdir(),"afterimage-workspace-evidence-"));
  try {
    const evidence=await canonicalSubjectWorkspaceEvidence(),value=report(evidence.scope),json=JSON.stringify(audit(evidence));
    const auditPath=path.join(root,"audit.json");await writeFile(auditPath,json);
    for(let i=0;i<value.views.length;i++) {
      const item=value.views[i],file=path.join(root,item.id+".png");
      const bytes=await sharp({create:{width:320,height:240,channels:3,background:{r:20+i*30,g:60,b:90}}}).png().toBuffer();
      await writeFile(file,bytes);item.audit={path:auditPath,sha256:digest(json)};item.captures=[{path:file,sha256:digest(bytes)}];
    }
    await run(value,root,evidence);
  } finally {await rm(root,{recursive:true,force:true});}
}

test("artifact verifier parses bounded audit JSON and decodes distinct PNG captures without issuing acceptance",async()=>{
  await artifacts(async(value,root)=>{assert.equal(await verifySubjectWorkspaceArtifacts(value,root),undefined);});
});

test("a correctly hashed JSON artifact with changed measurements is rejected",async()=>{
  await artifacts(async(value,root,evidence)=>{
    const invalid=audit(evidence);invalid.audits[1].after.core.diagram.rect.width+=1;
    const bytes=JSON.stringify(invalid);await writeFile(value.views[0].audit.path,bytes);
    for(const item of value.views)item.audit.sha256=digest(bytes);
    await assert.rejects(verifySubjectWorkspaceArtifacts(value,root),/measured presentation changed/);
  });
});

test("renamed JPEG bytes and repeated screenshots cannot serve as PNG workspace evidence",async()=>{
  await artifacts(async(value,root)=>{
    const file=value.views[0].captures[0].path,bytes=await sharp({create:{width:320,height:240,channels:3,background:"white"}}).jpeg().toBuffer();
    await writeFile(file,bytes);value.views[0].captures[0].sha256=digest(bytes);
    await assert.rejects(verifySubjectWorkspaceArtifacts(value,root),/PNG screenshot/);
  });
  await artifacts(async(value,root)=>{
    value.views[1].captures=clone(value.views[0].captures);
    await assert.rejects(verifySubjectWorkspaceArtifacts(value,root),/reuse a screenshot/);
  });
});
