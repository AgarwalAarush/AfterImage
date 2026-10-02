import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import type { SubjectMechanism } from "../src/lib/subject-mechanism";
import { layoutSubjectMechanism } from "../src/lib/subject-mechanism";
import { subjectMechanismQualityVersion } from "../src/lib/subject-mechanism-quality";
import { subjectBeatStateDigest, validateSubjectVisualReview, verifySubjectVisualArtifacts, subjectVisualAcceptance } from "../src/lib/subject-visual-review";
import { subjectVisualReviewSchema } from "../src/lib/subject-visual-review-schema";

const digest=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const bindings={lessonId:"constructed",contentDigest:"a".repeat(64),parentContentDigest:"b".repeat(64),rendererDigest:"c".repeat(64),presentationDigest:"d".repeat(64)};
const mechanism={version:1,title:"Constructed trace",introduction:"An original constructed trace used to verify coverage without approving any real scientific lesson.",sectionId:"s1",takeaway:"Coverage includes every stable symbolic state and its adjacent transitions.",sourceIds:["main"],claimIds:["c1"],entities:[{id:"x",label:"x",meaning:"The original token identity."},{id:"y",label:"y",meaning:"The appended token identity."}],objects:["prefix","output","encoder","input","history"].map(id=>({id,form:"tokens",label:id,detail:"Token identities",sourceIds:["main"],claimIds:["c1"]})),relationships:[{id:"append",from:"prefix",to:"output",label:"append",dashed:false,sourceIds:["main"],claimIds:["c1"]}],beats:Array.from({length:3},(_,index)=>({title:`Step ${index+1}`,explanation:"This constructed state verifies the evidence boundaries without representing a paper's empirical measurement.",sourceIds:["main"],claimIds:["c1"],objects:[{objectId:"prefix",status:"active",entityIds:["x",...(index?["y"]:[])]},{objectId:"output",status:index===2?"active":"pending",entityIds:index===2?["y"]:[]},...["encoder","input","history"].map(objectId=>({objectId,status:"pending",entityIds:[]}))],relationships:index===2?[{relationshipId:"append",entityIds:["y"]}]:[]}))} as unknown as SubjectMechanism;
const passed={passed:true as const,observation:"Actual rendered evidence was checked for this criterion."};
function report(){
 const views=[{id:"wide-light",viewportWidth:1440,viewportHeight:900,theme:"light"},{id:"wide-dark",viewportWidth:1440,viewportHeight:900,theme:"dark"},{id:"narrow-light",viewportWidth:900,viewportHeight:900,theme:"light"},{id:"narrow-dark",viewportWidth:900,viewportHeight:900,theme:"dark"}];
 const frames=views.flatMap(view=>mechanism.beats.map((_,beatIndex)=>({id:`${view.id}-${beatIndex}`,viewId:view.id,beatIndex,stateDigest:subjectBeatStateDigest(mechanism,beatIndex),svgWidth:view.viewportWidth===1440?760:560,svgHeight:600,captureSource:"browser",fontsReady:true,resolvedFontFamily:"Overused Grotesk, sans-serif",artifacts:[{path:`.artifacts/subjects/${view.id}-${beatIndex}.png`,sha256:digest(`${view.id}-${beatIndex}`),width:760,height:1200,regions:["diagram","narration","controls"]}],browserAudit:{path:`.artifacts/subjects/${view.id}-${beatIndex}.json`,sha256:digest(`audit-${view.id}-${beatIndex}`)},checks:{textLegible:passed,themeContrast:passed,geometryClear:passed,labelGrouping:passed,spacingBalanced:passed,stateIdentityCorrect:passed,relationshipDirectionsCorrect:passed,explanationConsistent:passed,interactionControlsVisible:passed}})));
 const transitions=views.flatMap(view=>[0,1].map(fromBeatIndex=>({viewId:view.id,fromBeatIndex,toBeatIndex:fromBeatIndex+1,beforeFrameId:`${view.id}-${fromBeatIndex}`,afterFrameId:`${view.id}-${fromBeatIndex+1}`,motion:{mode:"status-only",geometryStable:true,properties:["fill","stroke","opacity"],durationMs:180},checks:{identityPreserved:passed,geometryContinuous:passed,relationshipAvailabilityCorrect:passed,motionSemanticsCorrect:passed}})));
 return {version:2,...bindings,semanticPolicyVersion:subjectMechanismQualityVersion,authorId:"original-generator",reviewerId:"separate-reviewer",reviewerRole:"independent",reviewedAt:"2026-10-02T03:00:00Z",passed:true,findings:[],views,frames,transitions};
}
test("visual acceptance needs all real storyboard states across four distinct desktop views",()=>{
 const value=validateSubjectVisualReview(report(),mechanism,bindings);
 assert.equal(value.frames.length,12);assert.equal(value.transitions.length,8);
 const proof=subjectVisualAcceptance(value);assert.equal(proof.beatCount,3);assert.equal(proof.viewCount,4);
 assert.equal(proof.reportDigest,digest(JSON.stringify(value)));assert.ok(!JSON.stringify(proof).includes(".artifacts"));
 const endpoints=report();endpoints.frames=endpoints.frames.filter(frame=>frame.beatIndex!==1);
 assert.throws(()=>validateSubjectVisualReview(endpoints,mechanism,bindings));
 const legacy={...bindings,passed:true,findings:[],checkedViews:["same view","same view","same view","same view"],reviewedAt:"2026-10-02T03:00:00Z"};
 assert.throws(()=>validateSubjectVisualReview(legacy,mechanism,bindings));
});
test("visual review rejects duplicate coverage, wrong themes, self review and stale fingerprints",()=>{
 for(const mutate of [
  (r:ReturnType<typeof report>)=>{r.views[1]=r.views[0];},
  (r:ReturnType<typeof report>)=>{r.frames[1]=r.frames[0];},
  (r:ReturnType<typeof report>)=>{r.views[0].theme="dark";},
  (r:ReturnType<typeof report>)=>{r.reviewerId=r.authorId;},
  (r:ReturnType<typeof report>)=>{r.presentationDigest="f".repeat(64);},
  (r:ReturnType<typeof report>)=>{r.rendererDigest="f".repeat(64);},
  (r:ReturnType<typeof report>)=>{r.frames[1].stateDigest="f".repeat(64);},
  (r:ReturnType<typeof report>)=>{r.frames[0].artifacts[0].regions=["diagram"];},
 ]){const r=report();mutate(r);assert.throws(()=>validateSubjectVisualReview(r,mechanism,bindings));}
});
test("transition review requires every adjacent pair and distinguishes status from spatial motion",()=>{
 const missing=report();missing.transitions.pop();assert.throws(()=>validateSubjectVisualReview(missing,mechanism,bindings));
 const skipped=report();skipped.transitions[0].toBeatIndex=2;assert.throws(()=>validateSubjectVisualReview(skipped,mechanism,bindings));
 const moved=report();moved.frames[1].svgHeight=601;assert.throws(()=>validateSubjectVisualReview(moved,mechanism,bindings));
 const spatial=report();spatial.transitions[0].motion.mode="spatial";assert.throws(()=>validateSubjectVisualReview(spatial,mechanism,bindings));
 const frame=report();frame.transitions[0].beforeFrameId="narrow-light-0";assert.throws(()=>validateSubjectVisualReview(frame,mechanism,bindings));
});
test("PNG evidence is actual decoded bytes with bounded path, digest and dimensions",async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),"subject-visual-review-"));t.after(()=>rm(directory,{recursive:true,force:true}));
 const r=subjectVisualReviewSchema.parse(report());
 for(const [index,frame] of r.frames.entries()){
  const bytes=await sharp({create:{width:800,height:1000,channels:3,background:{r:index*15,g:35,b:80}}}).png().toBuffer();
  const file=path.join(directory,`${index}.png`);await writeFile(file,bytes);
  frame.artifacts=[{path:file,sha256:digest(bytes),width:800,height:1000,regions:["diagram","narration","controls"]}];
  frame.svgHeight=layoutSubjectMechanism(mechanism,frame.svgWidth).height;
  const view=r.views.find(view=>view.id===frame.viewId)!;
  const objects=mechanism.beats[frame.beatIndex].objects.map((object,i)=>({id:object.objectId,status:object.status,bounds:{x:i*110,y:0,w:90,h:80},labels:[{text:object.objectId,x:i*110+8,y:8,w:50,h:12}],entities:object.entityIds.map((id,j)=>({id,pill:{x:i*110+10+j*34,y:35,w:28,h:29},text:id,x:i*110+15+j*34,y:44,w:10,h:12}))}));
  const audit={version:1,...bindings,frameId:frame.id,viewId:frame.viewId,beatIndex:frame.beatIndex,stateDigest:frame.stateDigest,artifactDigests:[digest(bytes)],facts:{theme:view.theme,viewportWidth:view.viewportWidth,canvasWidth:frame.svgWidth,viewBox:`0 0 ${frame.svgWidth} ${frame.svgHeight}`,introGap:40,fonts:[frame.resolvedFontFamily],objects,findings:[]}};
  const auditBytes=Buffer.from(JSON.stringify(audit)),auditPath=path.join(directory,`${index}.json`);await writeFile(auditPath,auditBytes);frame.browserAudit={path:auditPath,sha256:digest(auditBytes)};
 }
 await verifySubjectVisualArtifacts(r,mechanism,directory);
 const wrongHash=structuredClone(r);wrongHash.frames[0].artifacts[0].sha256="f".repeat(64);await assert.rejects(()=>verifySubjectVisualArtifacts(wrongHash,mechanism,directory),/fingerprint/);
 const wrongSize=structuredClone(r);wrongSize.frames[0].artifacts[0].width=17;await assert.rejects(()=>verifySubjectVisualArtifacts(wrongSize,mechanism,directory),/dimensions/);
 const reused=structuredClone(r);reused.frames[4].artifacts=reused.frames[0].artifacts;await assert.rejects(()=>verifySubjectVisualArtifacts(reused,mechanism,directory),/distinct storyboard/);
 const outside=await mkdtemp(path.join(os.tmpdir(),"subject-visual-outside-"));t.after(()=>rm(outside,{recursive:true,force:true}));
 await writeFile(path.join(outside,"outside.png"),await sharp({create:{width:16,height:16,channels:3,background:"red"}}).png().toBuffer());
 const link=path.join(directory,"link.png");await symlink(path.join(outside,"outside.png"),link);const escaped=structuredClone(r);escaped.frames[0].artifacts[0].path=link;
 await assert.rejects(()=>verifySubjectVisualArtifacts(escaped,mechanism,directory),/private Subjects PNG/);
 const badAudit=structuredClone(r),record=JSON.parse(await readFile(badAudit.frames[0].browserAudit.path,"utf8"));
 record.facts.objects[0].labels[0].x=-30;const badBytes=Buffer.from(JSON.stringify(record));await writeFile(badAudit.frames[0].browserAudit.path,badBytes);badAudit.frames[0].browserAudit.sha256=digest(badBytes);
 await assert.rejects(()=>verifySubjectVisualArtifacts(badAudit,mechanism,directory),/label exceeds/);
 const associated=structuredClone(mechanism);associated.objects[1].form="module";
 const detached=structuredClone(r),index=2,associationAudit=JSON.parse(await readFile(detached.frames[index].browserAudit.path,"utf8"));
 const output=associationAudit.facts.objects[1];output.bounds.w=140;output.labels[0].w=20;output.entities[0].pill.x=output.labels[0].x+20+40.7;output.entities[0].x=output.entities[0].pill.x+6;
 detached.frames[index].svgHeight=layoutSubjectMechanism(associated,detached.frames[index].svgWidth).height;
 associationAudit.facts.viewBox=`0 0 ${detached.frames[index].svgWidth} ${detached.frames[index].svgHeight}`;
 const associationBytes=Buffer.from(JSON.stringify(associationAudit));await writeFile(detached.frames[index].browserAudit.path,associationBytes);detached.frames[index].browserAudit.sha256=digest(associationBytes);
 // Isolate the adverse 40.7px gap: the glyph fits its object but is detached from its text.
 detached.frames=[detached.frames[index]];detached.transitions=[];
 await assert.rejects(()=>verifySubjectVisualArtifacts(detached,associated,directory),/detached from its text group/);
});
