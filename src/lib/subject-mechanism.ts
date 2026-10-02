import { z } from "zod";
import type { SubjectPublicLesson } from "./subjects";
import { routePlacedEdges } from "./scene-layout";
import { diagramTextUsesFallback, diagramTextWidth, wrapDiagramTextByWidth } from "./diagram-text-metrics";
import type { Scene } from "./types";
import { subjectVisualAcceptanceSchema } from "./subject-visual-review-schema";

const identity=z.string().regex(/^[a-z0-9-]+$/).max(30);
const references=z.array(identity).min(1).max(8);
const plain=(max:number)=>z.string().min(1).max(max).refine(value=>! /[$]|\\[a-zA-Z]|[\u0000-\u001f]/.test(value),"Use concise plain text or Unicode notation for diagram labels");
const detail=plain(50).refine(value=>! /[\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\u3030]|[,;:]$|\b(?:a|an|the|and|or|for|in|of|to|from|while|with|that|which|as|by|is|being|at|on|its|their|then)$/i.test(value.trim()),"Object detail must be a complete concise English noun phrase, never cut-off or corrupted filler");
export const subjectMechanismSchema=z.object({
  version:z.literal(1),sectionId:identity,title:plain(90),introduction:z.string().min(80).max(700),
  entities:z.array(z.object({id:identity,label:plain(8).refine(value=>! /\s|[;,]$/.test(value)&&[...value].filter(char=>char==="(").length===[...value].filter(char=>char===")").length,"Use a complete compact symbol, never a cut-off formula or phrase"),meaning:z.string().min(10).max(160)})).min(2).max(24),
  objects:z.array(z.object({id:identity,form:z.enum(["module","vector","tokens","bank"]),label:plain(26),detail,sourceIds:references,claimIds:references})).min(5).max(8),
  relationships:z.array(z.object({id:identity,from:identity,to:identity,label:plain(30),dashed:z.boolean(),sourceIds:references,claimIds:references})).min(4).max(10),
  beats:z.array(z.object({
    title:plain(70),explanation:z.string().min(100).max(1100),sourceIds:references,claimIds:references,
    objects:z.array(z.object({objectId:identity,status:z.enum(["pending","active","retained"]),entityIds:z.array(identity).max(5)})).min(5).max(8),
    relationships:z.array(z.object({relationshipId:identity,entityIds:z.array(identity).max(5)})).max(5),
  })).min(3).max(6),
  takeaway:z.string().min(60).max(350),sourceIds:references,claimIds:references,
});
export type SubjectMechanism=z.infer<typeof subjectMechanismSchema>;
export const publishedSubjectMechanismSchema=subjectMechanismSchema.extend({
  lessonId:z.string().regex(/^[a-z0-9-]+$/).max(150),parentContentDigest:z.string().regex(/^[a-f0-9]{64}$/),
  review:z.object({status:z.enum(["source-passed","passed"]),reviewedAt:z.string(),contentDigest:z.string().regex(/^[a-f0-9]{64}$/),rendererDigest:z.string().regex(/^[a-f0-9]{64}$/),visualReviewedAt:z.string().nullable(),visualAcceptance:subjectVisualAcceptanceSchema.nullable().optional()}),
});
export type PublishedSubjectMechanism=z.infer<typeof publishedSubjectMechanismSchema>;

export function validateSubjectMechanism(input:unknown,lesson:SubjectPublicLesson,sources:{id:string}[]):SubjectMechanism{
  const mechanism=subjectMechanismSchema.parse(input),entities=new Set(mechanism.entities.map(entity=>entity.id)),objects=new Set(mechanism.objects.map(object=>object.id)),relationships=new Set(mechanism.relationships.map(edge=>edge.id));
  if(entities.size!==mechanism.entities.length||objects.size!==mechanism.objects.length||relationships.size!==mechanism.relationships.length)throw new Error("Duplicate mechanism identity");
  if(!lesson.sections.some(section=>section.id===mechanism.sectionId))throw new Error("Mechanism references an unknown lesson section");
  const claims=new Set(lesson.claims.map(claim=>claim.id)),sourceIds=new Set(sources.map(source=>source.id));
  const check=(item:{claimIds:string[];sourceIds:string[]})=>{if(item.claimIds.some(id=>!claims.has(id))||item.sourceIds.some(id=>!sourceIds.has(id)))throw new Error("Unknown mechanism source or claim reference");};
  check(mechanism);mechanism.objects.forEach(check);mechanism.relationships.forEach(check);mechanism.beats.forEach(check);
  const pairs=new Set<string>();
  for(const edge of mechanism.relationships){
    const pair=edge.from+":"+edge.to;
    if(!objects.has(edge.from)||!objects.has(edge.to)||edge.from===edge.to||pairs.has(pair))throw new Error("Invalid or duplicate mechanism relationship");
    pairs.add(pair);
  }
  if(mechanism.objects.some(object=>!mechanism.relationships.some(edge=>edge.from===object.id||edge.to===object.id)))throw new Error("Mechanism object lacks a scientific relationship");
  for(const beat of mechanism.beats){
    if(beat.objects.length!==objects.size||new Set(beat.objects.map(object=>object.objectId)).size!==objects.size||beat.objects.some(object=>!objects.has(object.objectId)))throw new Error("Each beat must specify every stable object exactly once");
    for(const state of beat.objects){
      if(new Set(state.entityIds).size!==state.entityIds.length||state.entityIds.some(id=>!entities.has(id)))throw new Error("Invalid mechanism entity state");
      if(state.status==="pending"&&state.entityIds.length)throw new Error("Pending objects cannot contain computed data");
    }
    if(!beat.objects.some(object=>object.status==="active"))throw new Error("Every mechanism beat needs a visible operation");
    if(new Set(beat.relationships.map(edge=>edge.relationshipId)).size!==beat.relationships.length)throw new Error("Duplicate beat relationship");
    for(const transfer of beat.relationships){
      const edge=mechanism.relationships.find(edge=>edge.id===transfer.relationshipId);
      if(!edge||new Set(transfer.entityIds).size!==transfer.entityIds.length||transfer.entityIds.some(id=>!entities.has(id)))throw new Error("Invalid beat relationship or entity");
      const from=beat.objects.find(object=>object.objectId===edge.from)!,to=beat.objects.find(object=>object.objectId===edge.to)!;
      if(from.status==="pending"||to.status==="pending")throw new Error("A beat cannot transfer data through pending objects");
      if(transfer.entityIds.some(id=>!from.entityIds.includes(id)||!to.entityIds.includes(id)))throw new Error("Transferred identities must be present at both endpoints");
    }
  }
  if(mechanism.objects.filter(object=>object.form!=="module").length<2)throw new Error("Mechanism needs data-bearing objects, not a row of compute boxes");
  for(const object of mechanism.objects)if(!mechanism.beats.some(beat=>beat.objects.find(state=>state.objectId===object.id)!.status!=="pending"))throw new Error("Mechanism object never becomes available");
  if(!mechanism.objects.some(object=>new Set(mechanism.beats.map(beat=>JSON.stringify(beat.objects.find(state=>state.objectId===object.id)!.entityIds))).size>1))throw new Error("Mechanism must show scientific state changing, not decorative highlights");
  for(const width of [760,700,560,380]){
    const layout=layoutSubjectMechanism(mechanism,width);
    assertSubjectMechanismGeometry(mechanism,layout);
  }
  return mechanism;
}

/** Thirteen-pixel monospace symbols keep their complete identity and reserved padding. */
export function layoutMechanismGlyphs(nodeWidth:number,labels:string[]){
  const widths=labels.map(label=>Math.max(32,[...label].length*8+14));
  const total=widths.reduce((sum,width)=>sum+width,0);
  if(total>nodeWidth-24)throw new Error("Mechanism symbols do not fit their object; use complete shorter aliases");
  let offset=(nodeWidth-total)/2;
  return widths.map(width=>{const item={offset,width};offset+=width;return item;});
}

type MechanismPoint={x:number;y:number};
/** Prefer a clear aligned connection; feedback and obstacle crossings retain reviewed routing. */
function alignedMechanismConnection(from:{x:number;y:number;w:number;h:number},to:{x:number;y:number;w:number;h:number}){
  const fx=from.x+from.w/2,tx=to.x+to.w/2,fy=from.y+from.h/2,ty=to.y+to.h/2;
  if(fx===tx){
    if(from.y+from.h<=to.y)return [{x:fx,y:from.y+from.h},{x:tx,y:to.y}];
    if(to.y+to.h<=from.y)return [{x:fx,y:from.y},{x:tx,y:to.y+to.h}];
  }
  if(fy===ty){
    if(from.x+from.w<=to.x)return [{x:from.x+from.w,y:fy},{x:to.x,y:ty}];
    if(to.x+to.w<=from.x)return [{x:from.x,y:fy},{x:to.x+to.w,y:ty}];
  }
  return null;
}
function parallelSegmentsOverlap(a:MechanismPoint,b:MechanismPoint,c:MechanismPoint,d:MechanismPoint){
  if(a.x===b.x&&c.x===d.x&&a.x===c.x)return Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
  if(a.y===b.y&&c.y===d.y&&a.y===c.y)return Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x));
  return false;
}

/** Object sizes reserve only their actual maximum glyph row and wrapped text across all beats. */
export function layoutSubjectMechanism(mechanism:SubjectMechanism,availableWidth:number){
  const width=Math.max(380,Math.floor(availableWidth/10)*10),columns=width>=700?2:1;
  const nodeWidth=columns===2?Math.floor((width-140)/20)*10:width-100;
  const nativeLabels=mechanism.objects.map(object=>{
    const title=wrapDiagramTextByWidth(object.label,nodeWidth-30,15),detail=wrapDiagramTextByWidth(object.detail,nodeWidth-30,12);
    const maxEntityCount=Math.max(...mechanism.beats.map(beat=>beat.objects.find(state=>state.objectId===object.id)!.entityIds.length));
    const maxGlyphWidth=Math.max(0,...mechanism.beats.flatMap(beat=>beat.objects.find(state=>state.objectId===object.id)!.entityIds.map(id=>Math.max(32,[...mechanism.entities.find(entity=>entity.id===id)!.label].length*8+14))));
    const textWidth=Math.max(...title.map(line=>diagramTextWidth(line,15)),...detail.map(line=>diagramTextWidth(line,12)));
    const fontFallback=diagramTextUsesFallback(object.label+object.detail);
    const inlineGlyph=!fontFallback&&object.form==="module"&&maxEntityCount===1&&textWidth+maxGlyphWidth+12<=nodeWidth-28;
    const titleY=22,detailY=titleY+(title.length-1)*17+20;
    const glyphY=inlineGlyph?(titleY-12+detailY+(detail.length-1)*15-29)/2:detailY+(detail.length-1)*15+12;
    const contentBottom=maxEntityCount&&!inlineGlyph?glyphY+29:detailY+(detail.length-1)*15;
    const textX=inlineGlyph?(nodeWidth-textWidth-maxGlyphWidth-12)/2:nodeWidth/2;
    const glyphOffset=inlineGlyph?textX+textWidth+12:null;
    return {id:object.id,title,detail,titleY,titleX:textX,detailX:textX,textAnchor:inlineGlyph?"start" as const:"middle" as const,detailY,glyphY,glyphOffset,inlineGlyph,maxEntityCount,fontFallback,height:Math.ceil((contentBottom+14)/20)*20};
  });
  const rows=Array.from({length:Math.ceil(mechanism.objects.length/columns)},(_,row)=>Math.max(...nativeLabels.slice(row*columns,(row+1)*columns).map(labels=>labels.height)));
  const rowTops:number[]=[];let top=24;
  for(const rowHeight of rows){rowTops.push(top);top+=rowHeight+50;}
  const nodes=mechanism.objects.map((object,index)=>({id:object.id,kind:"box" as const,label:object.label,detail:object.detail,emphasis:false,x:columns===2?40+(index%2)*(nodeWidth+60):50,y:rowTops[Math.floor(index/columns)]+(rows[Math.floor(index/columns)]-nativeLabels[index].height)/2,w:nodeWidth,h:nativeLabels[index].height}));
  const height=Math.max(...nodes.map(node=>node.y+node.h))+40;
  const scene:Scene={layout:"flow-v2",title:mechanism.title,description:mechanism.introduction,footnote:"",nodes,edges:mechanism.relationships.map(edge=>({from:edge.from,to:edge.to,label:edge.label,dashed:edge.dashed}))};
  const edges=routePlacedEdges(scene,nodes,width,height);
  edges.forEach((edge,index)=>{
    const from=nodes.find(node=>node.id===edge.from)!,to=nodes.find(node=>node.id===edge.to)!,direct=alignedMechanismConnection(from,to);
    if(!direct)return;
    const [a,b]=direct;
    const obstructed=nodes.some(node=>node!==from&&node!==to&&(a.x===b.x?
      a.x>node.x-10&&a.x<node.x+node.w+10&&Math.max(Math.min(a.y,b.y),node.y-10)<Math.min(Math.max(a.y,b.y),node.y+node.h+10):
      a.y>node.y-10&&a.y<node.y+node.h+10&&Math.max(Math.min(a.x,b.x),node.x-10)<Math.min(Math.max(a.x,b.x),node.x+node.w+10)));
    const overlaps=edges.some((other,otherIndex)=>otherIndex!==index&&other.points.some((point,i)=>i>0&&parallelSegmentsOverlap(a,b,other.points[i-1],point)));
    if(!obstructed&&!overlaps)edge.points=direct;
  });
  return {width,height,nodes,edges,nativeLabels};
}

export type SubjectMechanismLayout=ReturnType<typeof layoutSubjectMechanism>;
export type SubjectMechanismGeometryIssue={
  code:"bounds"|"text-alignment"|"glyph-association"|"collision"|"occupancy"|"row-alignment"|"arrow-endpoint"|"arrow-route"|"arrow-detour";
  location:string;message:string;
};
type GeometryBox={x:number;y:number;w:number;h:number};
const geometryTolerance=.01;
const near=(a:number,b:number)=>Math.abs(a-b)<=geometryTolerance;
function boxesOverlap(a:GeometryBox,b:GeometryBox){
  return a.x<b.x+b.w-geometryTolerance&&a.x+a.w>b.x+geometryTolerance&&a.y<b.y+b.h-geometryTolerance&&a.y+a.h>b.y+geometryTolerance;
}
function containsBox(outer:GeometryBox,inner:GeometryBox,padding=0){
  return inner.x>=outer.x+padding-geometryTolerance&&inner.y>=outer.y+padding-geometryTolerance&&inner.x+inner.w<=outer.x+outer.w-padding+geometryTolerance&&inner.y+inner.h<=outer.y+outer.h-padding+geometryTolerance;
}
function segmentCrossesBox(a:MechanismPoint,b:MechanismPoint,box:GeometryBox){
  if(near(a.x,b.x))return a.x>box.x+geometryTolerance&&a.x<box.x+box.w-geometryTolerance&&Math.max(Math.min(a.y,b.y),box.y)<Math.min(Math.max(a.y,b.y),box.y+box.h)-geometryTolerance;
  if(near(a.y,b.y))return a.y>box.y+geometryTolerance&&a.y<box.y+box.h-geometryTolerance&&Math.max(Math.min(a.x,b.x),box.x)<Math.min(Math.max(a.x,b.x),box.x+box.w)-geometryTolerance;
  return false;
}
function onBoundary(point:MechanismPoint,box:GeometryBox){
  return point.x>=box.x-geometryTolerance&&point.x<=box.x+box.w+geometryTolerance&&point.y>=box.y-geometryTolerance&&point.y<=box.y+box.h+geometryTolerance&&
    (near(point.x,box.x)||near(point.x,box.x+box.w)||near(point.y,box.y)||near(point.y,box.y+box.h));
}

/** Deterministic relational checks for this renderer, separate from semantic/source review.
 * Text envelopes use checksum-bound font advances and kerning; browser/font review remains required.
 * Every beat is checked, including later wider identities and pending objects. */
export function inspectSubjectMechanismGeometry(mechanism:SubjectMechanism,layout:SubjectMechanismLayout):SubjectMechanismGeometryIssue[]{
  const issues:SubjectMechanismGeometryIssue[]=[],canvas={x:0,y:0,w:layout.width,h:layout.height};
  const add=(code:SubjectMechanismGeometryIssue["code"],location:string,message:string)=>issues.push({code,location,message});
  const nodeById=new Map(layout.nodes.map(node=>[node.id,node])),labelById=new Map(layout.nativeLabels.map(label=>[label.id,label])),entityById=new Map(mechanism.entities.map(entity=>[entity.id,entity]));
  if(layout.nodes.length!==mechanism.objects.length||nodeById.size!==mechanism.objects.length||layout.nativeLabels.length!==mechanism.objects.length)add("bounds","layout","Every stable object needs exactly one node and text layout");
  if(layout.nodes.some((node,index)=>node.id!==mechanism.objects[index]?.id)||layout.nativeLabels.some((label,index)=>label.id!==mechanism.objects[index]?.id))add("glyph-association","layout","Rendered node/text order must preserve the storyboard's object identities");
  if(layout.edges.length!==mechanism.relationships.length||layout.edges.some((edge,index)=>edge.from!==mechanism.relationships[index]?.from||edge.to!==mechanism.relationships[index]?.to))add("arrow-endpoint","layout","Rendered connection order must preserve the storyboard's relationship identities");
  for(const object of mechanism.objects){
    const node=nodeById.get(object.id),labels=labelById.get(object.id),location=`object ${object.id}`;
    if(!node||!labels){add("bounds",location,"Missing stable object geometry");continue;}
    if(![node.x,node.y,node.w,node.h].every(Number.isFinite)||node.w<=0||node.h<=0||!containsBox(canvas,node,3))add("bounds",location,"Object must fit inside the canvas");
    const textBoxes=[...labels.title.map((line,i)=>{const w=diagramTextWidth(line,15);return {x:labels.titleX-(labels.textAnchor==="middle"?w/2:0),y:labels.titleY+i*17-15,w,h:18};}),
      ...labels.detail.map((line,i)=>{const w=diagramTextWidth(line,12);return {x:labels.detailX-(labels.textAnchor==="middle"?w/2:0),y:labels.detailY+i*15-12,w,h:15};})];
    const localNode={x:0,y:0,w:node.w,h:node.h};
    for(const box of textBoxes)if(!containsBox(localNode,box,5))add("bounds",location,"Wrapped title/detail must retain readable object padding");
    for(let i=0;i<textBoxes.length;i++)for(let j=i+1;j<textBoxes.length;j++)if(boxesOverlap(textBoxes[i],textBoxes[j]))add("collision",location,"Title/detail text envelopes overlap");
    if(!near(labels.titleX,labels.detailX)||labels.textAnchor!==(labels.inlineGlyph?"start":"middle")||!labels.inlineGlyph&&!near(labels.titleX,node.w/2))add("text-alignment",location,"Title and detail must share the group's alignment axis");
    const states=mechanism.beats.map(beat=>beat.objects.find(state=>state.objectId===object.id));
    if(states.some(state=>!state)){add("bounds",location,"Every beat requires the stable object");continue;}
    const maxCount=Math.max(...states.map(state=>state!.entityIds.length));
    const maxWidth=Math.max(0,...states.flatMap(state=>state!.entityIds.map(id=>Math.max(32,[...(entityById.get(id)?.label??"")].length*8+14))));
    if(labels.maxEntityCount!==maxCount)add("occupancy",location,"Reserved glyph space must match all storyboard states");
    const textLeft=Math.min(...textBoxes.map(box=>box.x)),textRight=Math.max(...textBoxes.map(box=>box.x+box.w)),textTop=Math.min(...textBoxes.map(box=>box.y)),textBottom=Math.max(...textBoxes.map(box=>box.y+box.h));
    if(labels.inlineGlyph){
      if(diagramTextUsesFallback(object.label+object.detail))add("glyph-association",location,"Unknown-font text cannot determine an inline symbol position");
      if(object.form!=="module"||maxCount!==1||labels.glyphOffset===null||!near(labels.glyphOffset,textRight+12))add("glyph-association",location,"A module symbol must sit beside its own text group with a twelve-pixel gap");
      if(labels.glyphOffset!==null){
        if(!near((textLeft+labels.glyphOffset+maxWidth)/2,node.w/2))add("glyph-association",location,"The combined text and symbol group must be horizontally centered");
        if(Math.abs(labels.glyphY+29/2-(textTop+textBottom)/2)>3)add("glyph-association",location,"The module symbol must align vertically with its title/detail group");
      }
    }else if(labels.glyphOffset!==null)add("glyph-association",location,"A separate data row must use its centered row positions");
    const contentBottom=Math.max(textBottom,maxCount?labels.glyphY+29:0);
    if(node.h-contentBottom<10||node.h-contentBottom>34||textTop>24)add("occupancy",location,"Object height must fit its maximum content without a spare empty glyph row");
    for(let beatIndex=0;beatIndex<states.length;beatIndex++){
      const state=states[beatIndex]!,beatLocation=`beat ${beatIndex+1}, ${location}`;
      let glyphs:ReturnType<typeof layoutMechanismGlyphs>;
      try{glyphs=layoutMechanismGlyphs(node.w,state.entityIds.map(id=>entityById.get(id)?.label??""));}
      catch{add("bounds",beatLocation,"Complete glyph identities exceed the reserved row width");continue;}
      const boxes=glyphs.map(glyph=>({x:(labels.glyphOffset??glyph.offset)+3,y:labels.glyphY,w:glyph.width-6,h:29}));
      for(const box of boxes){
        if(!containsBox(localNode,box,5))add("bounds",beatLocation,"Glyph must remain inside its associated object");
        if(textBoxes.some(text=>boxesOverlap(text,box)))add("collision",beatLocation,"Glyph and title/detail envelopes overlap");
      }
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(boxesOverlap(boxes[i],boxes[j]))add("collision",beatLocation,"Distinct scientific identities overlap");
      if(boxes.length&&object.form==="vector"&&(boxes[0].x-14<0||boxes.at(-1)!.x+boxes.at(-1)!.w+14>node.w))add("bounds",beatLocation,"Vector brackets must fit the object as well as the glyphs");
    }
  }
  for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++)if(boxesOverlap(layout.nodes[i],layout.nodes[j]))add("collision",`objects ${layout.nodes[i].id}/${layout.nodes[j].id}`,"Stable objects overlap");
  const columns=layout.width>=700?2:1;
  const rows=Array.from({length:Math.ceil(layout.nodes.length/columns)},(_,index)=>layout.nodes.slice(index*columns,(index+1)*columns));
  let previousGap:number|undefined;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.some(node=>!near(node.y+node.h/2,row[0].y+row[0].h/2)))add("row-alignment",`row ${i+1}`,"Paired objects must share a horizontal centerline despite different content heights");
    const top=Math.min(...row.map(node=>node.y)),bottom=Math.max(...row.map(node=>node.y+node.h));
    const gap=i?top-Math.max(...rows[i-1].map(node=>node.y+node.h)):top;
    if(i===0&&(gap<12||gap>32)||i>0&&(gap<32||gap>64||previousGap!==undefined&&!near(gap,previousGap)))add("occupancy",`row ${i+1}`,"Rows must retain bounded, consistent introduction and relationship spacing");
    if(i)previousGap=gap;
    if(i===rows.length-1&&(layout.height-bottom<20||layout.height-bottom>56))add("occupancy","canvas","Trailing empty canvas must be bounded");
  }
  for(let edgeIndex=0;edgeIndex<layout.edges.length;edgeIndex++){
    const edge=layout.edges[edgeIndex],from=nodeById.get(edge.from),to=nodeById.get(edge.to),location=`relationship ${edge.from} → ${edge.to}`;
    if(!from||!to||edge.points.length<2){add("arrow-endpoint",location,"Connection requires its two object endpoints");continue;}
    if(!onBoundary(edge.points[0],from)||!onBoundary(edge.points.at(-1)!,to))add("arrow-endpoint",location,"Arrow endpoints must attach to their declared object boundaries");
    for(let i=1;i<edge.points.length;i++){
      const a=edge.points[i-1],b=edge.points[i];
      if(![a.x,a.y,b.x,b.y].every(Number.isFinite)||!near(a.x,b.x)&&!near(a.y,b.y)||near(a.x,b.x)&&near(a.y,b.y))add("arrow-route",location,"Connection segments must be finite, nonzero and orthogonal");
      if(!containsBox(canvas,{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)},3))add("bounds",location,"Connection must stay inside the canvas");
      if(layout.nodes.some(node=>segmentCrossesBox(a,b,node)))add("arrow-route",location,"Connection crosses an object interior");
      for(let otherIndex=edgeIndex+1;otherIndex<layout.edges.length;otherIndex++)if(layout.edges[otherIndex].points.some((point,index)=>index>0&&parallelSegmentsOverlap(a,b,layout.edges[otherIndex].points[index-1],point)))add("arrow-route",location,"Distinct relationships must not share a routed segment");
    }
    const direct=alignedMechanismConnection(from,to);
    if(direct){
      const [a,b]=direct;
      const obstruction=layout.nodes.some(node=>node.id!==from.id&&node.id!==to.id&&segmentCrossesBox(a,b,{x:node.x-10,y:node.y-10,w:node.w+20,h:node.h+20}));
      const competition=layout.edges.some((other,index)=>index!==edgeIndex&&other.points.some((point,i)=>i>0&&parallelSegmentsOverlap(a,b,other.points[i-1],point)));
      if(!obstruction&&!competition&&(edge.points.length!==2||!near(edge.points[0].x,a.x)||!near(edge.points[0].y,a.y)||!near(edge.points[1].x,b.x)||!near(edge.points[1].y,b.y)))add("arrow-detour",location,"An unobstructed aligned dependency must use its direct centered connection");
    }
  }
  return issues;
}

export function assertSubjectMechanismGeometry(mechanism:SubjectMechanism,layout:SubjectMechanismLayout){
  const issues=inspectSubjectMechanismGeometry(mechanism,layout);
  if(issues.length)throw new Error(`Mechanism geometry at ${layout.width}px: ${issues.map(issue=>`${issue.code}: ${issue.location}: ${issue.message}`).join("; ")}`);
}
