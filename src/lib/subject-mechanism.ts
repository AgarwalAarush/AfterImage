import { z } from "zod";
import type { SubjectPublicLesson } from "./subjects";
import { routePlacedEdges, wrapDiagramText } from "./scene-layout";
import type { Scene } from "./types";

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
  review:z.object({status:z.enum(["source-passed","passed"]),reviewedAt:z.string(),contentDigest:z.string().regex(/^[a-f0-9]{64}$/),rendererDigest:z.string().regex(/^[a-f0-9]{64}$/),visualReviewedAt:z.string().nullable()}),
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
    for(const beat of mechanism.beats)for(const state of beat.objects){
      const node=layout.nodes.find(node=>node.id===state.objectId)!;
      layoutMechanismGlyphs(node.w,state.entityIds.map(id=>mechanism.entities.find(entity=>entity.id===id)!.label));
    }
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
    const title=wrapDiagramText(object.label,Math.floor((nodeWidth-30)/7.5)),detail=wrapDiagramText(object.detail,Math.floor((nodeWidth-30)/6.5));
    const maxEntityCount=Math.max(...mechanism.beats.map(beat=>beat.objects.find(state=>state.objectId===object.id)!.entityIds.length));
    const maxGlyphWidth=Math.max(0,...mechanism.beats.flatMap(beat=>beat.objects.find(state=>state.objectId===object.id)!.entityIds.map(id=>Math.max(32,[...mechanism.entities.find(entity=>entity.id===id)!.label].length*8+14))));
    const textWidth=Math.max(...title.map(line=>line.length*7.5),...detail.map(line=>line.length*6.5));
    const inlineGlyph=object.form==="module"&&maxEntityCount===1&&textWidth+maxGlyphWidth+12<=nodeWidth-28;
    const titleY=22,detailY=titleY+(title.length-1)*17+20;
    const glyphY=inlineGlyph?(titleY-12+detailY+(detail.length-1)*15-29)/2:detailY+(detail.length-1)*15+12;
    const contentBottom=maxEntityCount&&!inlineGlyph?glyphY+29:detailY+(detail.length-1)*15;
    const textX=inlineGlyph?(nodeWidth-textWidth-maxGlyphWidth-12)/2:nodeWidth/2;
    const glyphOffset=inlineGlyph?textX+textWidth+12:null;
    return {id:object.id,title,detail,titleY,titleX:textX,detailX:textX,textAnchor:inlineGlyph?"start" as const:"middle" as const,detailY,glyphY,glyphOffset,inlineGlyph,maxEntityCount,height:Math.ceil((contentBottom+14)/20)*20};
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
