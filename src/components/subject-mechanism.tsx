"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { layoutMechanismGlyphs, layoutSubjectMechanism, type SubjectMechanism } from "@/lib/subject-mechanism";
import { SubjectProse } from "./subject-prose";
import styles from "./subject-mechanism.module.css";

/** One semantic storyboard drives both the static poster and its explanatory beats. */
export function SubjectMechanismWalkthrough({mechanism}:{mechanism:SubjectMechanism}){
  const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[visible,setVisible]=useState(false),[width,setWidth]=useState(760);
  const container=useRef<HTMLDivElement>(null),elapsed=useRef(0);
  const instanceId=useId().replaceAll(":","");
  const layout=useMemo(()=>layoutSubjectMechanism(mechanism,width),[mechanism,width]);
  const beat=mechanism.beats[index];
  useEffect(()=>{
    const element=container.current!;
    const resize=new ResizeObserver(entries=>setWidth(Math.max(380,entries[0].contentRect.width)));
    resize.observe(element);
    const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.12});observer.observe(element);
    const motion=matchMedia("(prefers-reduced-motion: reduce)");
    const preference=()=>{if(motion.matches){setPlaying(false);setIndex(mechanism.beats.length-1);elapsed.current=0;}};
    preference();if(!motion.matches)setPlaying(true);motion.addEventListener("change",preference);
    return()=>{resize.disconnect();observer.disconnect();motion.removeEventListener("change",preference);};
  },[mechanism]);
  useEffect(()=>{
    if(!playing||!visible)return;
    let frame=0,last=performance.now();
    const tick=(now:number)=>{
      const delta=now-last;last=now;
      if(document.visibilityState==="visible")elapsed.current+=Math.min(delta,250);
      const hold=Math.max(6500,beat.explanation.split(/\s+/).length*230);
      if(elapsed.current>=hold){elapsed.current=0;if(index===mechanism.beats.length-1){setPlaying(false);return;}setIndex(index+1);return;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,visible,index,beat,mechanism.beats.length]);
  const entities=new Map(mechanism.entities.map(entity=>[entity.id,entity]));
  function show(next:number){setPlaying(false);elapsed.current=0;setIndex(next);}
  const activeRelationships=new Set(beat.relationships.map(edge=>edge.relationshipId));
  const markerId=`mechanism-arrow-${instanceId}`;
  return <section className={styles.walkthrough} aria-label={mechanism.title}>
    <div className={styles.heading}><h3>{mechanism.title}</h3><button className="icon-button" aria-label={playing?"Pause mechanism walkthrough":"Play mechanism walkthrough"} aria-pressed={playing} onClick={()=>{if(!playing&&index===mechanism.beats.length-1){setIndex(0);elapsed.current=0;}setPlaying(!playing);}}>{playing?<Pause size={16}/>:<Play size={16}/>}</button></div>
    <div className={`subject-prose ${styles.introduction}`}><SubjectProse text={mechanism.introduction}/></div>
    <div ref={container} className={styles.canvas}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${beat.title}. ${beat.explanation}`}>
        <title>{mechanism.title}</title><desc>{mechanism.objects.map(object=>`${object.label}: ${object.detail}`).join(". ")}</desc>
        <defs><marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="var(--accent)"/></marker></defs>
        {layout.edges.map((edge,edgeIndex)=>{
          const relationship=mechanism.relationships[edgeIndex],active=activeRelationships.has(relationship.id),from=beat.objects.find(object=>object.objectId===relationship.from)!,to=beat.objects.find(object=>object.objectId===relationship.to)!;
          const available=from.status!=="pending"&&to.status!=="pending";
          const d=edge.points.map((point,i)=>`${i?"L":"M"}${point.x} ${point.y}`).join(" ");
          return <g key={relationship.id} opacity={active?1:available?.45:.18} data-relationship={relationship.id} data-active={active}><path d={d} fill="none" stroke="var(--paper)" strokeWidth="5"/><path d={d} fill="none" stroke="var(--accent)" strokeWidth={active?2:1.2} strokeDasharray={relationship.dashed?"5 5":undefined} markerEnd={`url(#${markerId})`}><title>{relationship.label}</title></path></g>;
        })}
        {layout.nodes.map((node,nodeIndex)=>{
          const object=mechanism.objects[nodeIndex],state=beat.objects.find(state=>state.objectId===object.id)!,labels=layout.nativeLabels[nodeIndex],active=state.status==="active",pending=state.status==="pending";
          const items=state.entityIds.map(id=>entities.get(id)!);
          const glyphs=layoutMechanismGlyphs(node.w,items.map(item=>item.label)).map(glyph=>labels.glyphOffset===null?glyph:{...glyph,offset:labels.glyphOffset});
          const start=node.x+(glyphs[0]?.offset??node.w/2),end=node.x+(glyphs.at(-1)?glyphs.at(-1)!.offset+glyphs.at(-1)!.width:node.w/2);
          return <g key={object.id} data-object={object.id} data-state={state.status}>
            {object.form==="bank"&&<path d={`M${node.x+7} ${node.y-5}H${node.x+node.w+5}V${node.y+node.h-5}`} fill="none" stroke="var(--line)"/>}
            <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="9" fill={active?"var(--theme-violet-surface, #efedf3)":"var(--paper)"} stroke={active?"var(--accent)":"var(--line)"} strokeWidth={active?1.8:1} strokeDasharray={pending?"4 4":undefined}/>
            {labels.title.map((line,i)=><text key={i} x={node.x+labels.titleX} y={node.y+labels.titleY+i*17} textAnchor={labels.textAnchor} fill={pending?"var(--muted)":"var(--ink)"} fontSize="15" fontFamily="var(--font-sans)">{line}</text>)}
            {items.length>0&&<g data-entities={state.entityIds.join(" ")}>
              {object.form==="vector"&&<path d={`M${start-5} ${node.y+labels.glyphY-3}h-6v35h6 M${end+5} ${node.y+labels.glyphY-3}h6v35h-6`} fill="none" stroke="var(--accent)"/>}
              {items.map((item,i)=><g key={item.id} data-entity={item.id}><rect x={node.x+glyphs[i].offset+3} y={node.y+labels.glyphY} width={glyphs[i].width-6} height="29" rx={object.form==="tokens"?14:4} fill={active?"var(--theme-violet-line, #e3deea)":"var(--canvas)"} stroke="var(--line)"/><text x={node.x+glyphs[i].offset+glyphs[i].width/2} y={node.y+labels.glyphY+19} textAnchor="middle" fill="var(--ink)" fontSize="13" fontFamily="monospace">{item.label}</text><title>{item.meaning}</title></g>)}
            </g>}
            {labels.detail.map((line,i)=><text key={i} x={node.x+labels.detailX} y={node.y+labels.detailY+i*15} textAnchor={labels.textAnchor} fill="var(--muted)" fontSize="12" fontFamily="var(--font-sans)">{line}</text>)}
          </g>;
        })}
      </svg>
    </div>
    <div className={styles.beat} aria-live={playing?"off":"polite"}><h4>{beat.title}</h4><div className="subject-prose"><SubjectProse text={beat.explanation}/></div>{beat.relationships.length>0&&<ul className={styles.relationships}>{beat.relationships.map(active=>{const edge=mechanism.relationships.find(edge=>edge.id===active.relationshipId)!;return <li key={edge.id}>{mechanism.objects.find(object=>object.id===edge.from)!.label} → {mechanism.objects.find(object=>object.id===edge.to)!.label}: {edge.label}</li>;})}</ul>}</div>
    <div className={styles.controls}><button className="button small" disabled={index===0} onClick={()=>show(index-1)}><ChevronLeft size={14}/>Previous</button><nav aria-label="Mechanism explanation steps">{mechanism.beats.map((step,i)=><button key={i} aria-label={`Show ${step.title}`} aria-current={index===i?"step":undefined} onClick={()=>show(i)}><span aria-hidden="true"/></button>)}</nav><button className="button small" disabled={index===mechanism.beats.length-1} onClick={()=>show(index+1)}>Next<ChevronRight size={14}/></button></div>
    {index===mechanism.beats.length-1&&<div className={`subject-prose ${styles.takeaway}`}><SubjectProse text={mechanism.takeaway}/></div>}
  </section>;
}
