"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { SubjectProse } from "./subject-prose";
import { experimentControls, experimentState, experimentPlotDomains, onlineAttention } from "@/lib/subject-experiments";
import type { SubjectFigure } from "@/lib/subjects";
import type { ExperimentResult } from "@/lib/subject-experiments";
import { NoiseShellDrawing, NoiseShellExperiment, StreamingAttentionDrawing, StreamingAttentionExperiment } from "./subject-mechanism-experiments";
import { stableSubjectSvg } from "./subject-svg-presentation";
import { RollingWindowDrawing, RollingWindowTable } from "./subject-rolling-window";
import { PairedScalingDrawing, PairedScalingTable } from "./subject-paired-scaling";
import { VolumeRenderingDrawing, VolumeRenderingTable } from "./subject-volume-rendering";
import { SubjectRange } from "./subject-range";
import { rangeExplorationPhase, rangeExplorationValue, subjectParameterValue } from "@/lib/subject-range";

const ink="var(--ink)", muted="var(--muted)", accent="var(--accent)", line="var(--line)", paper="var(--paper)";
const curveKinds=new Set<SubjectFigure["kind"]>(["optimizer","state","ode","latent","guidance"]);

/** Native-size geometry is derived from the computed example, never generated lesson markup. */
export function ExperimentDrawing({kind,result,width,value,dimension}:{kind:SubjectFigure["kind"];result:ExperimentResult;width:number;value:number;dimension:number}){
  return stableSubjectSvg(drawExperiment({kind,result,width,value,dimension}));
}
function drawExperiment({kind,result,width,value,dimension}:{kind:SubjectFigure["kind"];result:ExperimentResult;width:number;value:number;dimension:number}){
  if(kind==="rolling-window")return <RollingWindowDrawing width={width} query={value}/>;
  if(kind==="paired-scaling")return <PairedScalingDrawing width={width} alpha={value}/>;
  if(kind==="volume-rendering")return <VolumeRenderingDrawing width={width} density={value}/>;
  if(kind==="noise-shells")return <NoiseShellDrawing width={width} sigma={value} yaw={.6} pitch={.35} shells="both"/>;
  if(kind==="streaming-attention")return <StreamingAttentionDrawing width={width} tileWidth={value} order="reverse" visited={onlineAttention(value,"reverse").steps.length-1}/>;
  const count=result.values.length, hasSelection=result.selected.length>0;
  if(kind==="attention"){
    const qx=50,kx=width-70;
    return <>
      <text x={qx} y="87" textAnchor="middle" fontSize="13" fill={muted}>Query</text>
      <circle cx={qx} cy="132" r="25" fill={paper} stroke={accent}/><text x={qx} y="137" textAnchor="middle" fontSize="15" fill={ink}>Q</text>
      {result.values.map((weight,i)=>{const y=44+i*57;return <g key={i}>
        <path d={`M ${qx+25} 132 C ${width*.45} 132, ${width*.55} ${y}, ${kx-38} ${y}`} fill="none" stroke={accent} strokeWidth={1+weight*8} opacity={.25+.75*weight}/>
        <rect x={kx-38} y={y-18} width="76" height="36" rx="6" fill={paper} stroke={line}/>
        <text x={kx} y={y+5} textAnchor="middle" fontSize="14" fill={ink}>{result.labels[i]} · {weight.toFixed(2)}</text>
        <text x={kx} y={y-26} textAnchor="middle" fontSize="12" fill={muted}>score {2-i}</text>
      </g>;})}
      <text x={width/2} y="263" textAnchor="middle" fontSize="12" fill={muted}>Connection width follows the softmax weight</text>
    </>;
  }
  if(kind==="graph"){
    const positions=[width*.17,width*.5,width*.83],names=["A","B","C"];
    return <>
      {positions.slice(1).map((x,i)=><line key={i} x1={positions[i]+31} x2={x-31} y1="124" y2="124" stroke={accent} strokeWidth="2"/>)}
      {result.values.map((feature,i)=><g key={i}>
        <text x={positions[i]} y="71" textAnchor="middle" fontSize="14" fill={muted}>Node {names[i]}</text>
        <circle cx={positions[i]} cy="124" r="31" fill={accent} fillOpacity={.06+.25*feature} stroke={accent}/>
        <text x={positions[i]} y="129" textAnchor="middle" fontSize="15" fill={ink}>{feature.toFixed(3)}</text>
      </g>)}
      <text x={width/2} y="197" textAnchor="middle" fontSize="13" fill={muted}>Each node averages itself and its neighbors</text>
      <text x={width/2} y="224" textAnchor="middle" fontSize="12" fill={muted}>Initial features: A = 1, B = 0, C = 0</text>
    </>;
  }
  if(kind==="search"){
    const leaves=[.125,.375,.625,.875].map(x=>x*width),branches=[width*.25,width*.75];
    return <>
      {branches.map((x,i)=><line key={`root-${i}`} x1={width/2} y1="58" x2={x} y2="99" stroke={line} strokeWidth="2"/>)}
      {leaves.map((x,i)=><line key={`leaf-${i}`} x1={branches[Math.floor(i/2)]} y1="137" x2={x} y2="185" stroke={result.selected.includes(i)?accent:line} strokeWidth="2"/>)}
      <circle cx={width/2} cy="39" r="19" fill={paper} stroke={line}/><text x={width/2} y="44" textAnchor="middle" fontSize="12" fill={ink}>root</text>
      {branches.map((x,i)=><circle key={i} cx={x} cy="118" r="19" fill={paper} stroke={line}/>)}
      {leaves.map((x,i)=>{const selected=result.selected.includes(i);return <g key={i}><circle cx={x} cy="207" r="22" fill={selected?accent:paper} fillOpacity={selected?.12:1} stroke={selected?accent:line} strokeDasharray={selected?undefined:"3 3"}/><text x={x} y="212" textAnchor="middle" fontSize="14" fill={selected?ink:muted}>{selected?result.values[i].toFixed(1):"?"}</text><text x={x} y="257" textAnchor="middle" fontSize="12" fill={muted}>{["A","B","C","D"][i]}</text></g>;})}
    </>;
  }
  const [lower,upper]=experimentPlotDomains[kind]||[0,1];
  const top=46,bottom=218,left=46,right=width-24;
  const y=(n:number)=>bottom-(n-lower)/(upper-lower)*(bottom-top),baseline=y(0);
  const ticks=[lower,...(lower<0?[0]:[]),upper];
  if(curveKinds.has(kind)){
    const numericLabels=result.coordinates??result.labels.map(label=>Number(kind==="guidance"?label.replace(/^x=/,""):label)),first=numericLabels[0],last=numericLabels.at(-1)!;
    const x=(index:number)=>left+(numericLabels[index]-first)/(last-first)*(right-left);
    const points=(values:number[])=>values.map((n,i)=>`${x(i)},${y(n)}`).join(" ");
    const tickCount=width<450?3:5;
    const indices=[...new Set(Array.from({length:tickCount},(_,i)=>Math.round(i*(count-1)/(tickCount-1))))];
    return <>
      {ticks.map(mark=><g key={mark}><line x1={left} x2={right} y1={y(mark)} y2={y(mark)} stroke={line} strokeDasharray="3 5"/><text x={left-10} y={y(mark)+4} textAnchor="end" fontSize="12" fill={muted}>{mark}</text></g>)}
      {!result.reference.length&&<text x={left} y="21" fontSize="12" fill={muted}>{kind==="optimizer"?"Position x":kind==="state"?"State h":"Velocity v"}</text>}
      {result.reference.length>0&&<><line x1={left} x2={left+24} y1="17" y2="17" stroke={muted} strokeDasharray="4 4"/><text x={left+31} y="21" fontSize="12" fill={muted}>{kind==="latent"?"p · standard normal":"exact solution"}</text><line x1={width*.6} x2={width*.6+24} y1="17" y2="17" stroke={accent} strokeWidth="2"/><text x={width*.6+31} y="21" fontSize="12" fill={muted}>{kind==="latent"?"q · posterior":"Euler"}</text><polyline points={points(result.reference)} fill="none" stroke={muted} strokeWidth="2" strokeDasharray="4 4"/></>}
      <polyline points={points(result.values)} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round"/>
      {kind!=="latent"&&result.values.map((n,i)=><circle key={i} cx={x(i)} cy={y(n)} r="3" fill={accent}/>)}
      {indices.map(i=><g key={i}><line x1={x(i)} x2={x(i)} y1={bottom} y2={bottom+5} stroke={line}/><text x={x(i)} y={bottom+22} textAnchor="middle" fontSize="12" fill={muted}>{result.labels[i]}</text></g>)}
      <text x={(left+right)/2} y="267" textAnchor="middle" fontSize="12" fill={muted}>{kind==="latent"?"x":kind==="ode"?"Time t":kind==="guidance"?"Position x":"Update step"}</text>
    </>;
  }
  if(result.grid){
    const matrix=kind==="routing"||kind==="contrastive",columns=matrix?3:kind==="spatial"?7:8,rows=Math.ceil(count/columns);
    const gap=kind==="memory"?5:6,size=Math.min(48,(176-(rows-1)*gap)/rows,(width-(matrix?90:30))/columns-gap);
    const gridWidth=columns*(size+gap)-gap,gridHeight=rows*(size+gap)-gap,gridLeft=(width-gridWidth)/2,gridTop=matrix?46:36;
    return <>
      {matrix&&Array.from({length:columns},(_,i)=><text key={`column-${i}`} x={gridLeft+i*(size+gap)+size/2} y="24" textAnchor="middle" fontSize="12" fill={muted}>{kind==="routing"?`E${i+1}`:`Text ${i+1}`}</text>)}
      {matrix&&Array.from({length:rows},(_,i)=><text key={`row-${i}`} x={gridLeft-12} y={gridTop+i*(size+gap)+size/2+4} textAnchor="end" fontSize="12" fill={muted}>{kind==="routing"?`T${i+1}`:`Image ${i+1}`}</text>)}
      {result.values.map((n,i)=>{
        const selected=result.selected.includes(i),x=gridLeft+(i%columns)*(size+gap),y=gridTop+Math.floor(i/columns)*(size+gap);
        const opacity=kind==="memory"?(n===1?1:n>0?.22:0):kind==="contrastive"?.05+.1*n:hasSelection?(selected?1:.1):Math.max(.06,n);
        return <g key={i}><rect x={x} y={y} width={size} height={size} rx="3" fill={accent} fillOpacity={opacity} stroke={selected?accent:line} strokeDasharray={kind==="memory"&&n===0?"2 3":undefined}/>{count<=16&&<text x={x+size/2} y={y+size/2+(kind==="contrastive"?1:4)} textAnchor="middle" fill={(kind==="memory"&&n===1)||(kind==="routing"&&selected)?paper:ink} fontSize="12">{kind==="memory"?(n===1?i+1:n>0?"·":""):n.toFixed(2)}</text>}{kind==="contrastive"&&<><rect x={x+6} y={y+size-9} width={size-12} height="3" rx="1.5" fill={line}/><rect x={x+6} y={y+size-9} width={(size-12)*n} height="3" rx="1.5" fill={accent}/></>}</g>;
      })}
      {kind==="memory"&&Array.from({length:Math.ceil(result.values.filter(n=>n>0).length/value)},(_,block)=>{
        const start=block*value,end=Math.min(16,start+value),segments=[];
        for(let row=Math.floor(start/columns);row<=Math.floor((end-1)/columns);row++){
          const colStart=Math.max(start,row*columns)%columns,colEnd=Math.min(end,(row+1)*columns)-row*columns;
          segments.push(<path key={`${block}-${row}`} d={`M ${gridLeft+colStart*(size+gap)} ${gridTop+row*(size+gap)-6} v -5 h ${(colEnd-colStart)*(size+gap)-gap} v 5`} fill="none" stroke={accent} strokeWidth="1.5" opacity=".7"/>);
        }return segments;
      })}
      {(kind==="memory"||kind==="patches")&&<g><rect x={width/2-105} y={gridTop+gridHeight+30} width="9" height="9" rx="2" fill={accent} fillOpacity=".85"/><text x={width/2-90} y={gridTop+gridHeight+39} fontSize="12" fill={muted}>{kind==="memory"?"Live":"Visible"}</text><rect x={width/2-35} y={gridTop+gridHeight+30} width="9" height="9" rx="2" fill={accent} fillOpacity={kind==="memory"?.22:.12}/><text x={width/2-20} y={gridTop+gridHeight+39} fontSize="12" fill={muted}>{kind==="memory"?"Padding":"Masked"}</text>{kind==="memory"&&<><rect x={width/2+56} y={gridTop+gridHeight+30} width="9" height="9" rx="2" fill="none" stroke={line} strokeDasharray="2 2"/><text x={width/2+71} y={gridTop+gridHeight+39} fontSize="12" fill={muted}>Free</text></>}</g>}
    </>;
  }
  const step=(right-left)/count,barWidth=Math.min(76,step*.65),tickEvery=Math.ceil(count/(width<450?4:8));
  return <>
    {ticks.map(mark=><g key={mark}><line x1={left} x2={right} y1={y(mark)} y2={y(mark)} stroke={line} strokeDasharray="3 5"/><text x={left-10} y={y(mark)+4} textAnchor="end" fontSize="12" fill={muted}>{mark}</text></g>)}
    {result.values.map((n,i)=>{const center=left+step*(i+.5),reference=result.reference[i],selected=!hasSelection||result.selected.includes(i);return <g key={i}>
      {reference!==undefined&&<rect x={center-barWidth/2-3} y={Math.min(baseline,y(reference))} width={barWidth+6} height={Math.max(1,Math.abs(y(reference)-baseline))} rx="3" fill={muted} opacity=".2"/>}
      <rect x={center-barWidth/2} y={Math.min(baseline,y(n))} width={barWidth} height={Math.max(1,Math.abs(y(n)-baseline))} rx="3" fill={accent} opacity={selected?.85:.18}/>
      {count<=6&&<text x={center} y={n<0?y(n)+18:y(n)-10} textAnchor="middle" fontSize="13" fill={ink}>{n.toFixed(2)}</text>}
      {i%tickEvery===0&&<text x={center} y="251" textAnchor="middle" fontSize="12" fill={muted}>{result.labels[i]||i+1}</text>}
    </g>;})}
    {kind==="noise"&&<><text x={(left+right)/2} y="267" textAnchor="middle" fontSize="12" fill={muted}>Sample radius · {dimension} dimensions</text><text x={left} y="20" fontSize="12" fill={muted}>Samples per bin</text></>}
    {result.reference.length>0&&<><rect x={left} y="14" width="9" height="9" fill={muted} opacity=".2"/><text x={left+16} y="22" fontSize="12" fill={muted}>Original</text><rect x={left+110} y="14" width="9" height="9" fill={accent}/><text x={left+126} y="22" fontSize="12" fill={muted}>{kind==="normalization"?"Standardized":kind==="quantization"?"Rounded":"Retained"}</text></>}
  </>;
}

export function SubjectExperiment({figure}: {figure: SubjectFigure}) {
  if(figure.kind==="streaming-attention")return <StreamingAttentionExperiment figure={figure}/>;
  if(figure.kind==="noise-shells")return <NoiseShellExperiment figure={figure}/>;
  return <BasicSubjectExperiment figure={figure}/>;
}

function BasicSubjectExperiment({figure}: {figure: SubjectFigure}) {
  const control = experimentControls[figure.kind];
  const [rawValue,setRawValue] = useState(control.initial), [dimension,setDimension] = useState(3);
  const value=subjectParameterValue(figure.kind,rawValue);
  const [playing,setPlaying] = useState(false), [visible,setVisible] = useState(false);
  const [canvasWidth,setCanvasWidth]=useState(760);
  const container = useRef<HTMLElement>(null), phase = useRef(rangeExplorationPhase(control.initial,control.min,control.max));
  useEffect(() => {
    const element=container.current;
    if (!element) return;
    const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.2});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const svg=container.current?.querySelector(".subject-experiment-canvas");
    if(!svg)return;
    const observer=new ResizeObserver(entries=>setCanvasWidth(Math.max(280,Math.floor(entries[0].contentRect.width))));
    observer.observe(svg);return ()=>observer.disconnect();
  },[]);
  useEffect(() => {
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
    const change=()=>{if(motion.matches)setPlaying(false);};
    motion.addEventListener("change",change);change();
    return ()=>motion.removeEventListener("change",change);
  },[]);
  useEffect(() => {
    if(!playing||!visible)return;
    let previous=0,frame=0;
    const tick=(now:number)=>{
      if(document.visibilityState!=="visible"){previous=0;frame=requestAnimationFrame(tick);return;}
      if(previous)phase.current+=Math.min(now-previous,100);
      previous=now;
      setRawValue(rangeExplorationValue(phase.current,control.min,control.max));
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[playing,visible,control]);
  const result=useMemo(()=>experimentState(figure.kind,value,dimension),[figure.kind,value,dimension]);
  const hasSelection=result.selected.length>0;
  return <figure className="subject-experiment" ref={container} id={`figure-${figure.id}`}>
    <div className="subject-experiment-heading"><h3>{figure.title}</h3>
      <button className="icon-button" aria-label={playing?"Pause parameter exploration":"Play parameter exploration"} aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>}</button>
    </div>
    <div className="subject-experiment-question"><SubjectProse text={figure.question}/></div>
    <svg viewBox={`0 0 ${canvasWidth} 275`} className={`subject-experiment-canvas ${result.grid?"is-grid":""}`} role="img" aria-label={`${figure.title}. ${result.metric}. ${result.detail}`}>
      <MemoExperimentDrawing kind={figure.kind} result={result} width={canvasWidth} value={value} dimension={dimension}/>
    </svg>
    <div className="subject-experiment-result"><strong>{result.metric}</strong><p>{result.detail}</p></div>
    <div className="subject-experiment-controls">
      <label><span>{control.label}<output>{Number(value.toFixed(2))}</output></span><SubjectRange label={control.label} min={control.min} max={control.max} keyboardStep={control.step} value={rawValue} semanticValue={value} onChange={raw=>{setPlaying(false);setRawValue(raw);phase.current=rangeExplorationPhase(raw,control.min,control.max);}}/></label>
      {figure.kind==="noise"&&<label className="subject-dimension"><span>Dimensions</span><select aria-label="Gaussian dimensions" value={dimension} onChange={event=>{setPlaying(false);setDimension(Number(event.target.value));}}>{[3,16,128].map(d=><option key={d} value={d}>{d}</option>)}</select></label>}
      <button className="text-button" onClick={()=>{setPlaying(false);setRawValue(control.initial);setDimension(3);phase.current=rangeExplorationPhase(control.initial,control.min,control.max);}}><RotateCcw size={13}/>Reset</button>
    </div>
    {figure.kind==="rolling-window"?<RollingWindowTable query={value}/>:figure.kind==="paired-scaling"?<PairedScalingTable alpha={value}/>:figure.kind==="volume-rendering"?<VolumeRenderingTable density={value}/>:<details className="subject-numeric-table"><summary>Inspect the displayed values</summary><table><thead><tr><th>Object / bin</th><th>Value</th><th>Reference</th><th>Selection</th></tr></thead><tbody>{result.values.map((x,i)=><tr key={i}><td>{result.labels[i]||i+1}</td><td>{figure.kind==="search"&&!result.selected.includes(i)?"Unrevealed":x.toFixed(5)}</td><td>{result.reference[i]?.toFixed(5)||"—"}</td><td>{hasSelection?result.selected.includes(i)?"Selected":"Not selected":"—"}</td></tr>)}</tbody></table></details>}
  </figure>;
}
const MemoExperimentDrawing=React.memo(ExperimentDrawing);
