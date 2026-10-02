import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { assertSubjectMechanismGeometry, inspectSubjectMechanismGeometry, layoutMechanismGlyphs, layoutSubjectMechanism, publishedSubjectMechanismSchema, subjectMechanismSchema, validateSubjectMechanism, type SubjectMechanism } from "../src/lib/subject-mechanism";
import type { PublishedLesson } from "../src/lib/subjects";

const lesson=JSON.parse(readFileSync(new URL("../src/content/subjects/lessons/playing-atari-with-deep-reinforcement-learning.json",import.meta.url),"utf8")) as PublishedLesson;
const references={sourceIds:[lesson.sources[0].id],claimIds:[lesson.claims[0].id]};
const ids=["buffer","sample","online","target","loss"];
function fixture():SubjectMechanism{
  const base={...references};
  const snapshots=(last:boolean)=>ids.map(id=>({objectId:id,status:(id==="buffer"?"retained":id==="loss"&&!last?"pending":"active") as "retained"|"pending"|"active",entityIds:id==="buffer"?["tau-one","tau-two"]:id==="loss"?(last?["error"]:[]):["tau-one"]}));
  return {version:1,sectionId:lesson.sections[0].id,title:"A symbolic replay update",introduction:"Two named transitions are retained in a symbolic replay collection. Follow one selected transition into the update.",entities:[{id:"tau-one",label:"τ₁",meaning:"The first named example transition."},{id:"tau-two",label:"τ₂",meaning:"The second named example transition."},{id:"error",label:"δ",meaning:"A symbolic prediction error for the selected transition."}],objects:ids.map((id,index)=>({...base,id,form:index===0?"bank":index===1?"vector":"module",label:id,detail:"A named scientific object"})),relationships:[{id:"draw",from:"buffer",to:"sample",label:"select transition",dashed:false,...base},{id:"predict",from:"sample",to:"online",label:"current prediction",dashed:false,...base},{id:"target-input",from:"sample",to:"target",label:"target input",dashed:false,...base},{id:"loss-current",from:"online",to:"loss",label:"prediction",dashed:false,...base},{id:"loss-target",from:"target",to:"loss",label:"target",dashed:false,...base}],beats:[{...base,title:"Retain the collection",explanation:"The example collection already holds two named transitions, keeping their identities stable before any selection or prediction happens.",objects:ids.map(id=>({objectId:id,status:id==="buffer"?"active":"pending",entityIds:id==="buffer"?["tau-one","tau-two"]:[]})),relationships:[]},{...base,title:"Select an existing transition",explanation:"The same first transition is visible in both the retained collection and the selected input. Selecting it does not remove it from the collection.",objects:snapshots(false),relationships:[{relationshipId:"draw",entityIds:["tau-one"]}]},{...base,title:"Compare prediction with target",explanation:"The two available quantities enter the same update comparison. The displayed error is a symbolic result, while the replay collection remains retained.",objects:snapshots(true),relationships:[{relationshipId:"loss-current",entityIds:[]},{relationshipId:"loss-target",entityIds:[]}]}],takeaway:"The selected transition remains identifiable while the replay collection persists across the update.",...base};
}

test("mechanism data states preserve identity and layout routes avoid object interiors",()=>{
  const mechanism=validateSubjectMechanism(fixture(),lesson,lesson.sources);
  for(const width of [760,560]){
    const layout=layoutSubjectMechanism(mechanism,width);
    assert.equal(layout.nodes.length,5);
    for(const edge of layout.edges)for(let i=1;i<edge.points.length;i++){
      const a=edge.points[i-1],b=edge.points[i],length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
      for(let offset=10;offset<length;offset+=10){
        const point={x:a.x+Math.sign(b.x-a.x)*offset,y:a.y+Math.sign(b.y-a.y)*offset};
        assert.equal(layout.nodes.some(node=>point.x>node.x&&point.x<node.x+node.w&&point.y>node.y&&point.y<node.y+node.h),false);
      }
    }
  }
});

test("pending results and fabricated transfer identities cannot pass mechanism validation",()=>{
  const pending=fixture();pending.beats[0].objects[1].entityIds=["tau-one"];
  assert.throws(()=>validateSubjectMechanism(pending,lesson,lesson.sources),/Pending objects/);
  const absent=fixture();absent.beats[1].relationships[0].entityIds=["tau-two"];
  assert.throws(()=>validateSubjectMechanism(absent,lesson,lesson.sources),/both endpoints/);
});

test("decorative highlights cannot substitute for changing scientific data",()=>{
  const unchanged=fixture();unchanged.beats.forEach(beat=>{beat.objects=structuredClone(unchanged.beats[2].objects);});
  assert.throws(()=>validateSubjectMechanism(unchanged,lesson,lesson.sources),/scientific state changing/);
  const invalid=fixture();invalid.objects[0].sourceIds=["invented-source"];
  assert.throws(()=>validateSubjectMechanism(invalid,lesson,lesson.sources),/Unknown mechanism source/);
});

test("mechanism publications accept catalog identities and reject corrupted small details",()=>{
  const published=publishedSubjectMechanismSchema.parse({...fixture(),lessonId:lesson.id,parentContentDigest:"a".repeat(64),review:{status:"source-passed",reviewedAt:new Date().toISOString(),contentDigest:"b".repeat(64),rendererDigest:"c".repeat(64),visualReviewedAt:null}});
  assert.equal(published.lessonId,lesson.id);
  for(const detail of ["Acoustic representation followed，","Predictions conditioned jointly on the","Normalized spectrogram for the 〰"]){
    const bad=fixture();bad.objects[0].detail=detail;
    assert.throws(()=>validateSubjectMechanism(bad,lesson,lesson.sources),/complete concise English noun phrase/);
  }
});

test("complete symbols reserve readable width without overlapping neighboring glyphs",()=>{
  const labels=["sα′","Qold(u)","Qold(v)","maxQold"],glyphs=layoutMechanismGlyphs(280,labels);
  glyphs.forEach((glyph,index)=>{
    assert.ok(glyph.width-6>=[...labels[index]].length*8);
    if(index)assert.ok(glyph.offset>=glyphs[index-1].offset+glyphs[index-1].width);
  });
  assert.throws(()=>layoutMechanismGlyphs(280,Array(5).fill("Qold(u)")),/do not fit/);
});

test("clear aligned arrows use centered direct segments while long obstructed links retain routing",()=>{
  const mechanism=fixture();
  mechanism.relationships=ids.slice(1).map((id,i)=>({id:`chain-${i}`,from:ids[i],to:id,label:"ordered dependency",dashed:false,...references}));
  for(const width of [760,560]){
    const layout=layoutSubjectMechanism(mechanism,width);
    const from=layout.nodes.find(node=>node.id==="buffer")!,to=layout.nodes.find(node=>node.id==="sample")!;
    const direct=layout.edges.find(edge=>edge.from==="buffer"&&edge.to==="sample")!;
    assert.equal(direct.points.length,2);
    if(width<700){
      assert.equal(direct.points[0].x,from.x+from.w/2);
      assert.equal(direct.points[1].x,to.x+to.w/2);
      assert.equal(direct.points[0].y,from.y+from.h);
      assert.equal(direct.points[1].y,to.y);
    }else{
      assert.equal(direct.points[0].y,from.y+from.h/2);
      assert.equal(direct.points[1].y,to.y+to.h/2);
      assert.equal(direct.points[0].x,from.x+from.w);
      assert.equal(direct.points[1].x,to.x);
    }
    const withFeedback={...mechanism,relationships:[...mechanism.relationships,{id:"long-feedback",from:"buffer",to:"loss",label:"retained dependency",dashed:true,...references}]};
    const routed=layoutSubjectMechanism(withFeedback,width);
    assert.ok(routed.edges.find(edge=>edge.from==="buffer"&&edge.to==="loss")!.points.length>2);
  }
});

test("module sizes fit their maximum content across beats without reserving blank glyph rows",()=>{
  const mechanism=fixture();
  for(const beat of mechanism.beats)beat.objects.find(state=>state.objectId==="target")!.entityIds=[];
  mechanism.beats[2].objects.find(state=>state.objectId==="online")!.entityIds=["tau-one","tau-two"];
  for(const width of [760,560]){
    const layout=layoutSubjectMechanism(mechanism,width),reversed=layoutSubjectMechanism({...mechanism,beats:[...mechanism.beats].reverse()},width);
    const node=(id:string)=>layout.nodes.find(node=>node.id===id)!;
    const labels=(id:string)=>layout.nativeLabels.find(labels=>labels.id===id)!;
    assert.equal(labels("target").maxEntityCount,0);
    assert.equal(labels("loss").maxEntityCount,1);
    assert.equal(labels("loss").inlineGlyph,true);
    assert.equal(labels("online").maxEntityCount,2);
    assert.equal(labels("online").inlineGlyph,false);
    assert.ok(node("online").h>node("target").h);
    assert.equal(node("loss").h,node("target").h);
    assert.deepEqual(layout.nodes,reversed.nodes);
    assert.ok(labels("online").glyphY+29<=node("online").h-14);
    assert.ok(labels("loss").glyphY+29<node("loss").h);
    assert.equal(labels("loss").textAnchor,"start");
    assert.equal(labels("loss").titleX,labels("loss").detailX);
    assert.ok(labels("loss").glyphOffset!<node("loss").w-50,"the retained identity belongs beside its centered text group, not at the card edge");
  }
});

test("all published walkthroughs satisfy relational geometry in every beat and supported column width",()=>{
  const directory=new URL("../src/content/subjects/mechanisms/",import.meta.url),files=readdirSync(directory).filter(file=>file.endsWith(".json"));
  assert.ok(files.length>=14,"exercise the complete authored catalog, rather than a single screenshot fixture");
  for(const file of files){
    const mechanism=subjectMechanismSchema.parse(JSON.parse(readFileSync(new URL(file,directory),"utf8")));
    for(const width of [760,700,560,380]){
      const layout=layoutSubjectMechanism(mechanism,width);
      assert.deepEqual(inspectSubjectMechanismGeometry(mechanism,layout),[],`${file} at ${width}px`);
      const reordered=layoutSubjectMechanism({...mechanism,beats:[...mechanism.beats].reverse()},width);
      assert.deepEqual(reordered,layout,"reserving every beat's maximum content keeps geometry stable during playback");
    }
  }
});

test("previous corner-badge module layout fails association even when nothing overlaps or clips",()=>{
  const mechanism=fixture(),layout=layoutSubjectMechanism(mechanism,760),labels=layout.nativeLabels.find(label=>label.id==="loss")!,node=layout.nodes.find(node=>node.id==="loss")!;
  assert.equal(labels.inlineGlyph,true);
  // The previous design centered the title but left-aligned the detail and put
  // the same glyph near the card's right edge. A bounds-only test accepted it.
  labels.titleX=(node.w-labels.title[0].length*7.5)/2;labels.detailX=14;labels.textAnchor="start";labels.glyphOffset=node.w-44;
  const issues=inspectSubjectMechanismGeometry(mechanism,layout);
  assert.equal(issues.some(issue=>issue.code==="bounds"||issue.code==="collision"),false,"the previous arrangement's defect was relational, not clipping");
  assert.ok(issues.some(issue=>issue.code==="text-alignment"&&issue.location==="object loss"));
  assert.ok(issues.some(issue=>issue.code==="glyph-association"&&issue.location==="object loss"));
  assert.throws(()=>assertSubjectMechanismGeometry(mechanism,layout),/glyph-association/);
});

test("geometry gate rejects spare rows, canvas gaps, misaligned peers, and identity/order detachment",()=>{
  const mechanism=fixture();
  const surplus=layoutSubjectMechanism(mechanism,760);surplus.nodes[4].h+=80;
  assert.ok(inspectSubjectMechanismGeometry(mechanism,surplus).some(issue=>issue.code==="occupancy"&&issue.location==="object loss"));
  const gap=layoutSubjectMechanism(mechanism,760);gap.height+=120;
  assert.ok(inspectSubjectMechanismGeometry(mechanism,gap).some(issue=>issue.code==="occupancy"&&issue.location==="canvas"));
  const misaligned=layoutSubjectMechanism(mechanism,760);misaligned.nodes[1].y+=8;
  assert.ok(inspectSubjectMechanismGeometry(mechanism,misaligned).some(issue=>issue.code==="row-alignment"));
  const detached=layoutSubjectMechanism(mechanism,760);[detached.nativeLabels[0],detached.nativeLabels[1]]=[detached.nativeLabels[1],detached.nativeLabels[0]];
  assert.ok(inspectSubjectMechanismGeometry(mechanism,detached).some(issue=>issue.code==="glyph-association"&&issue.location==="layout"));
});

test("late-state wider identities cannot escape fit checks or reserve an undersized object",()=>{
  const mechanism=fixture(),layout=layoutSubjectMechanism(mechanism,760);
  mechanism.entities.push({id:"late-result",label:"Qnew(u)",meaning:"A complete symbolic prediction computed in the final state."});
  mechanism.beats[2].objects.find(state=>state.objectId==="loss")!.entityIds=["late-result"];
  const issues=inspectSubjectMechanismGeometry(mechanism,layout);
  assert.ok(issues.some(issue=>issue.code==="glyph-association"&&issue.location==="object loss"));
  const wider=fixture();wider.entities.push({id:"wide-result",label:"Qold(u)",meaning:"One of several complete symbolic predictions in the final state."});
  wider.beats[2].objects.find(state=>state.objectId==="online")!.entityIds=Array(5).fill("wide-result");
  const overflow=inspectSubjectMechanismGeometry(wider,layout);
  assert.ok(overflow.some(issue=>issue.code==="bounds"&&issue.location==="beat 3, object online"));
});

test("arrow contracts reject gratuitous detours, false endpoints, diagonal paths and node crossings",()=>{
  const mechanism=fixture();
  mechanism.relationships=ids.slice(1).map((id,i)=>({id:`chain-${i}`,from:ids[i],to:id,label:"ordered dependency",dashed:false,...references}));
  const layout=layoutSubjectMechanism(mechanism,560),edge=layout.edges[0],[a,b]=edge.points;
  edge.points=[a,{x:a.x+20,y:a.y},{x:b.x+20,y:b.y},b];
  assert.ok(inspectSubjectMechanismGeometry(mechanism,layout).some(issue=>issue.code==="arrow-detour"));
  const falseEndpoint=layoutSubjectMechanism(mechanism,560);falseEndpoint.edges[0].points[0].y+=10;
  assert.ok(inspectSubjectMechanismGeometry(mechanism,falseEndpoint).some(issue=>issue.code==="arrow-endpoint"));
  const diagonal=layoutSubjectMechanism(mechanism,560);diagonal.edges[0].points[1].x+=10;
  assert.ok(inspectSubjectMechanismGeometry(mechanism,diagonal).some(issue=>issue.code==="arrow-route"));
  const crossing=layoutSubjectMechanism(mechanism,560),from=crossing.nodes[0],through=crossing.nodes[2];
  crossing.edges[0].points=[{x:from.x+from.w/2,y:from.y+from.h},{x:through.x+through.w/2,y:through.y+through.h}];
  assert.ok(inspectSubjectMechanismGeometry(mechanism,crossing).some(issue=>issue.code==="arrow-route"&&issue.message.includes("interior")));
});
