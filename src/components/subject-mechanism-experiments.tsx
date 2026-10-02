"use client";
import React, { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { onlineAttention, projectShellPoint, rmsShellDirections, shellCanvasHeight, streamingScores, streamingValues } from "@/lib/subject-experiments";
import type { SubjectFigure } from "@/lib/subjects";
import { SubjectProse } from "./subject-prose";
import { stableSubjectSvg } from "./subject-svg-presentation";
import { SubjectRange } from "./subject-range";
import { subjectParameterValue } from "@/lib/subject-range";

const ink="var(--ink)",muted="var(--muted)",accent="var(--accent)",line="var(--line)",paper="var(--paper)",innerColor="var(--theme-green, #758d70)";
function useCanvasWidth(container:RefObject<HTMLElement|null>){
  const [width,setWidth]=useState(660);
  useEffect(()=>{const svg=container.current?.querySelector("svg.subject-experiment-canvas");if(!svg)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(280,Math.floor(entries[0].contentRect.width))));observer.observe(svg);return ()=>observer.disconnect();},[container]);
  return width;
}
/** Elapsed time advances only while visible. An explicit pause survives hiding and scrolling. */
function useExperimentClock(container:RefObject<HTMLElement|null>,playing:boolean,setPlaying:(playing:boolean)=>void,onDelta:(milliseconds:number)=>void){
  const [visible,setVisible]=useState(false),callback=useRef(onDelta);
  useEffect(()=>{callback.current=onDelta;},[onDelta]);
  useEffect(()=>{const element=container.current;if(!element)return;const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.2});observer.observe(element);return ()=>observer.disconnect();},[container]);
  useEffect(()=>{const motion=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>{if(motion.matches)setPlaying(false);};motion.addEventListener("change",change);change();return ()=>motion.removeEventListener("change",change);},[setPlaying]);
  useEffect(()=>{
    if(!playing||!visible)return;
    let previous=0,frame=0;
    const tick=(now:number)=>{
      if(document.visibilityState!=="visible"){previous=0;frame=requestAnimationFrame(tick);return;}
      if(previous)callback.current(Math.min(now-previous,100));previous=now;
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
  },[playing,visible]);
}

export function StreamingAttentionDrawing({width,tileWidth,order,visited}:{width:number;tileWidth:number;order:"forward"|"reverse";visited:number}){
  return stableSubjectSvg(drawStreamingAttention({width,tileWidth,order,visited}));
}
function drawStreamingAttention({width,tileWidth,order,visited}:{width:number;tileWidth:number;order:"forward"|"reverse";visited:number}){
  const computation=onlineAttention(tileWidth,order),index=Math.max(0,Math.min(computation.steps.length-1,visited)),state=computation.steps[index];
  const tileCount=computation.steps.length-1,slot=(width-32)/4,boxWidth=slot-8;
  const status=index===tileCount?"Final output":index?"Partial output":"Output";
  const cards=[{label:"Maximum m",value:state.max},{label:"Normalizer ℓ",value:state.normalizer},{label:"Weighted sum u",value:state.accumulator},{label:status,value:state.output}];
  return <>
    {computation.steps.slice(1).map((step,tile)=>{
      const positions=step.indices.map(i=>16+i*slot),left=Math.min(...positions),right=Math.max(...positions)+boxWidth;
      return <g key={tile}><path d={`M ${left} 25 v -7 H ${right} v 7`} fill="none" stroke={tile<index?accent:line} strokeWidth="1.5"/><text x={(left+right)/2} y="11" textAnchor="middle" fontSize="11" fill={muted}>Tile {tile+1}</text></g>;
    })}
    {streamingScores.map((score,i)=>{
      const active=state.indices.includes(i),seen=state.visited.includes(i),x=16+i*slot;
      return <g key={i} data-key={`key-${i}`}><rect x={x} y="32" width={boxWidth} height="73" rx="5" fill={active?accent:paper} fillOpacity={active?.1:1} stroke={active?accent:line} opacity={seen?1:.6}/><text x={x+boxWidth/2} y="51" textAnchor="middle" fontSize="12" fill={ink}>K{i+1}</text><text x={x+boxWidth/2} y="73" textAnchor="middle" fontSize="12" fill={muted}>s = {score}</text><text x={x+boxWidth/2} y="93" textAnchor="middle" fontSize="12" fill={muted}>v = {streamingValues[i]}</text></g>;
    })}
    <text x={width/2} y="132" textAnchor="middle" fontSize="13" fill={muted}>{index===0?"Initial empty state":`After tile ${index} of ${tileCount} · ${state.visited.length} keys accumulated`}</text>
    {cards.map((card,i)=>{const x=16+i*slot;return <g key={card.label}><rect x={x} y="153" width={boxWidth} height="64" rx="5" fill={paper} stroke={i===3?accent:line}/><text x={x+boxWidth/2} y="173" textAnchor="middle" fontSize={width<450?10:12} fill={muted}>{width<450?["m","ℓ","u",index===tileCount?"Final u / ℓ":"u / ℓ"][i]:card.label}</text><text x={x+boxWidth/2} y="201" textAnchor="middle" fontSize={width<450?14:16} fill={ink}>{card.value===null?"—":card.value.toFixed(3)}</text></g>;})}
    <text x={width/2} y="253" textAnchor="middle" fontSize="12" fill={muted}>{index===0?"No scores have been accumulated.":width<450?`Rescale × ${state.rescale.toFixed(3)} · then add the tile`:`Rescale carried ℓ and u by ${state.rescale.toFixed(3)}, then add this tile.`}</text>
  </>;
}

export function StreamingAttentionExperiment({figure}:{figure:SubjectFigure}){
  const container=useRef<HTMLElement>(null),elapsed=useRef(0),width=useCanvasWidth(container);
  const [rawTileWidth,setRawTileWidth]=useState(2),[order,setOrder]=useState<"forward"|"reverse">("reverse"),[visited,setVisited]=useState(2),[playing,setPlaying]=useState(false);
  const tileWidth=subjectParameterValue("streaming-attention",rawTileWidth);
  const computation=useMemo(()=>onlineAttention(tileWidth,order),[tileWidth,order]),last=computation.steps.length-1,state=computation.steps[Math.min(visited,last)];
  useExperimentClock(container,playing,setPlaying,delta=>{elapsed.current+=delta;const hold=visited===last?2600:1700;if(elapsed.current>=hold){elapsed.current=0;setVisited(current=>current>=last?0:current+1);}});
  const stop=()=>{setPlaying(false);elapsed.current=0;};
  const changeWidth=(raw:number)=>{stop();setRawTileWidth(raw);setVisited(onlineAttention(subjectParameterValue("streaming-attention",raw),order).steps.length-1);};
  const changeOrder=(next:"forward"|"reverse")=>{stop();setOrder(next);setVisited(last);};
  return <figure className="subject-experiment" id={`figure-${figure.id}`} ref={container}>
    <div className="subject-experiment-heading"><h3>{figure.title}</h3><button className="icon-button" aria-label={playing?"Pause tile sequence":"Play tile sequence"} aria-pressed={playing} onClick={()=>{if(!playing&&visited===last){setVisited(0);elapsed.current=0;}setPlaying(!playing);}}>{playing?<Pause size={17}/>:<Play size={17}/>}</button></div>
    <div className="subject-experiment-question"><SubjectProse text={figure.question}/></div>
    <svg className="subject-experiment-canvas subject-experiment-live-canvas" viewBox={`0 0 ${width} 275`} role="img" aria-label={`Online softmax. ${visited} of ${last} tiles accumulated. Maximum ${state.max??"unset"}, normalizer ${state.normalizer.toFixed(3)}, weighted sum ${state.accumulator.toFixed(3)}, output ${state.output?.toFixed(4)??"not yet available"}.`}><StreamingAttentionDrawing width={width} tileWidth={tileWidth} order={order} visited={visited}/></svg>
    <svg className="subject-experiment-canvas subject-experiment-print-poster" viewBox={`0 0 ${width} 275`} aria-hidden="true"><StreamingAttentionDrawing width={width} tileWidth={tileWidth} order={order} visited={last}/></svg>
    <div className="subject-experiment-result subject-experiment-live-result"><strong>{visited===last?"Exact attention output":"Current partial output"}: {state.output?.toFixed(4)??"—"}</strong><p>Dense reference: {computation.denseOutput.toFixed(4)}. At the final tile, every partition and visit order reaches this value.</p></div>
    <div className="subject-experiment-result subject-experiment-print-poster"><strong>Exact attention output: {computation.denseOutput.toFixed(4)}</strong><p>The complete online calculation equals the dense reference.</p></div>
    <div className="subject-experiment-controls"><label><span>Scores per tile<output>{tileWidth}</output></span><SubjectRange label="Scores per tile" min={1} max={4} keyboardStep={1} value={rawTileWidth} semanticValue={tileWidth} onChange={changeWidth}/></label><button className="text-button" aria-label="Reset tile sequence" onClick={()=>{stop();setRawTileWidth(2);setOrder("reverse");setVisited(0);}}><RotateCcw size={13}/>Reset</button></div>
    <div className="subject-experiment-secondary"><div className="subject-experiment-options" aria-label="Tile visit order">{(["forward","reverse"] as const).map(next=><button key={next} aria-pressed={order===next} onClick={()=>changeOrder(next)}>{next==="forward"?"K₁ → K₄":"K₄ → K₁"}</button>)}</div><div className="subject-experiment-steps"><button className="icon-button" aria-label="Previous tile" disabled={visited===0} onClick={()=>{stop();setVisited(visited-1);}}><ChevronLeft size={17}/></button><span>{visited} / {last} tiles</span><button className="icon-button" aria-label="Next tile" disabled={visited===last} onClick={()=>{stop();setVisited(visited+1);}}><ChevronRight size={17}/></button></div></div>
    <details className="subject-numeric-table"><summary>Inspect every tile update</summary><table><thead><tr><th>Tile</th><th>Keys</th><th>m</th><th>Rescale</th><th>ℓ</th><th>u</th><th>u / ℓ</th></tr></thead><tbody>{computation.steps.slice(1).map((step,i)=><tr key={i}><td>{i+1}</td><td>{step.indices.map(index=>`K${index+1}`).join(", ")}</td><td>{step.max?.toFixed(5)}</td><td>{step.rescale.toFixed(5)}</td><td>{step.normalizer.toFixed(5)}</td><td>{step.accumulator.toFixed(5)}</td><td>{step.output?.toFixed(5)}</td></tr>)}</tbody></table></details>
  </figure>;
}

const directions=rmsShellDirections();
export type ShellVisibility="both"|"inner"|"outer";
export function NoiseShellDrawing({width,sigma,yaw,pitch,shells}:{width:number;sigma:number;yaw:number;pitch:number;shells:ShellVisibility}){
  return stableSubjectSvg(drawNoiseShells({width,sigma,yaw,pitch,shells}));
}
function drawNoiseShells({width,sigma,yaw,pitch,shells}:{width:number;sigma:number;yaw:number;pitch:number;shells:ShellVisibility}){
  const outerRadius=Math.sqrt(3),innerRadius=sigma*outerRadius,height=shellCanvasHeight(width),centerY=(height+70)/2;
  const spheres=(["outer","inner"] as const).filter(shell=>shells==="both"||shells===shell);
  const points=spheres.flatMap(shell=>directions.map((direction,i)=>{
    const radius=shell==="outer"?outerRadius:innerRadius,point=projectShellPoint(direction.map(coordinate=>coordinate*radius) as [number,number,number],yaw,pitch,width);
    return {...point,id:`${shell}-${i}`,shell};
  })).sort((a,b)=>a.depth-b.depth);
  return <>
    <text x="18" y="23" fontSize="12" fill={muted}>Ideal RMS spheres · D = 3, d = 0</text>
    <circle cx="24" cy="46" r="3" fill={innerColor}/><text x="36" y="50" fontSize="12" fill={muted}>Inner σ = {sigma.toFixed(2)} · radius {innerRadius.toFixed(2)}</text>
    <circle cx="24" cy="70" r="3" fill={accent}/><text x="36" y="74" fontSize="12" fill={muted}>Outer σ = 1.00 · radius {outerRadius.toFixed(2)}</text>
    {(["x","y","z"] as const).map((axis,i)=>{const point:[number,number,number]=[0,0,0];point[i]=1.95;const projected=projectShellPoint(point,yaw,pitch,width);return <g key={axis}><line x1={width/2} y1={centerY} x2={projected.x} y2={projected.y} stroke={line}/><text x={projected.x+7} y={Math.max(102,projected.y+4)} fontSize="12" fill={muted}>{axis}</text></g>;})}
    {points.map(point=><circle key={point.id} data-point={point.id} cx={point.x} cy={point.y} r={point.shell==="inner"?2.2:1.8} fill={point.shell==="inner"?innerColor:accent} opacity={.13+.7*(point.depth+outerRadius)/(2*outerRadius)}/>)}
    <circle cx={width/2} cy={centerY} r="3.5" fill={ink}/>
    <circle cx={width/2} cy={centerY} r="9" fill="none" stroke={ink} strokeOpacity=".4"/>
    <text x="18" y={height-15} fontSize="12" fill={muted}>Data point at the origin</text><text x={width-18} y={height-15} textAnchor="end" fontSize="12" fill={muted} className="subject-shell-interaction-hint">Drag to rotate</text>
  </>;
}

export function NoiseShellExperiment({figure}:{figure:SubjectFigure}){
  const container=useRef<HTMLElement>(null),drag=useRef<{x:number;y:number}|null>(null),width=useCanvasWidth(container);
  const height=shellCanvasHeight(width);
  const [sigma,setSigma]=useState(.4),[pose,setPose]=useState({yaw:.6,pitch:.35}),[shells,setShells]=useState<ShellVisibility>("both"),[playing,setPlaying]=useState(false);
  useExperimentClock(container,playing,setPlaying,delta=>setPose(previous=>({...previous,yaw:previous.yaw+delta*.00025})));
  const reset=()=>{setPlaying(false);setSigma(.4);setPose({yaw:.6,pitch:.35});setShells("both");};
  return <figure className="subject-experiment" id={`figure-${figure.id}`} ref={container}>
    <div className="subject-experiment-heading"><h3>{figure.title}</h3><button className="icon-button" aria-label={playing?"Pause sphere rotation":"Play sphere rotation"} aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>}</button></div>
    <div className="subject-experiment-question"><SubjectProse text={figure.question}/></div>
    <svg className="subject-experiment-canvas subject-shell-canvas" style={{height}} viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0} aria-label={`${shells==="both"?"Two ideal RMS spheres":shells==="inner"?"Inner RMS sphere":"Outer RMS sphere"}. Inner radius ${(sigma*Math.sqrt(3)).toFixed(2)}, outer radius ${Math.sqrt(3).toFixed(2)}. Drag to rotate, or use arrow keys.`}
      onPointerDown={event=>{if(event.button!==0)return;setPlaying(false);drag.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(!drag.current)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;drag.current={x:event.clientX,y:event.clientY};setPose(previous=>({yaw:previous.yaw+dx*.008,pitch:Math.max(-1.4,Math.min(1.4,previous.pitch+dy*.008))}));}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
      onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;event.preventDefault();setPlaying(false);setPose(previous=>({yaw:previous.yaw+(event.key==="ArrowRight"?.12:event.key==="ArrowLeft"?-.12:0),pitch:Math.max(-1.4,Math.min(1.4,previous.pitch+(event.key==="ArrowDown"?.12:event.key==="ArrowUp"?-.12:0)))}));}}>
      <NoiseShellDrawing width={width} sigma={sigma} yaw={pose.yaw} pitch={pose.pitch} shells={shells}/>
    </svg>
    <div className="subject-experiment-controls"><label><span>Inner noise σ<output>{sigma.toFixed(2)}</output></span><SubjectRange label="Inner noise σ" min={.1} max={.8} keyboardStep={.01} value={sigma} semanticValue={sigma} valueText={sigma.toFixed(2)} onChange={value=>{setPlaying(false);setSigma(value);}}/></label><button className="text-button" onClick={reset}><RotateCcw size={13}/>Reset</button></div>
    <div className="subject-experiment-options" aria-label="Visible noise shells">{(["both","inner","outer"] as const).map(option=><button key={option} aria-pressed={shells===option} onClick={()=>setShells(option)}>{option==="both"?"Both shells":option==="inner"?"Inner only":"Outer only"}</button>)}</div>
  </figure>;
}
