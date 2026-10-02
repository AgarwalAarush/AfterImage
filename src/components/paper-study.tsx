"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import type { Paper } from "@/lib/types";
import { studySvg, type StudyFigure } from "@/lib/study";
import { InlineText } from "./math";
import { useApp } from "./app";
import { themedSvg } from "@/lib/diagram-theme";
import { exportSvg } from "@/lib/export-diagram";
import { ReaderQuiz } from "./reader-quiz";
export function StudyFigures({paper,placement}:{paper:Paper;placement:"mechanism"|"evidence"}){
  return <>{paper.study?.figures.filter(f=>f.placement===placement).map(f=><Figure key={f.id} figure={f} paper={paper}/>)}</>;
}
function Figure({figure:f,paper}:{figure:StudyFigure;paper:Paper}){
  const drawing=useRef<HTMLDivElement>(null);
  const {toast}=useApp();
  const [state,setState]=useState(0);const source=paper.sources.find(s=>s.id===f.sourceId);
  return <figure className="study-figure" id={`figure-${f.id}`} data-concept={f.id}>
    <div className="study-figure-heading"><span className="eyebrow">{f.provenance==="illustrative"?"WORKED VISUAL EXAMPLE":"THE EVIDENCE, VISUALLY"}</span><h3>{f.title}</h3></div>
    {f.kind==="network"&&f.states.length>1&&<div className="figure-switch" role="group" aria-label="Diagram condition">{f.states.map((s,i)=><button key={i} aria-pressed={state===i} onClick={()=>setState(i)}>{s.label}</button>)}</div>}
    <div className="study-drawing" ref={drawing}><div className="study-desktop" dangerouslySetInnerHTML={{__html:themedSvg(studySvg(f,false,state),f.kind==="landscape")}}/><div className="study-mobile" dangerouslySetInnerHTML={{__html:themedSvg(studySvg(f,true,state),f.kind==="landscape")}}/></div>
    {f.kind==="network"&&<><p className="figure-state"><InlineText text={f.states[state].explanation}/></p><details className="weight-ledger"><summary>Inspect the connection weights</summary><ul>{f.states[state].edges.map((e,i)=><li key={i}><span>{f.layers[e.fromLayer].nodes[e.from]} → {f.layers[e.fromLayer+1].nodes[e.to]}</span><code>{e.weight}</code><span>{e.active?"Active":"Inactive"}</span></li>)}</ul></details></>}
    <figcaption><span className="eyebrow">{f.provenance==="illustrative"?"ILLUSTRATIVE · NOT A BENCHMARK":"REPORTED IN THE PAPER"}</span><p><InlineText text={f.caption}/></p><div>{source&&<a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>}<button className="text-button" onClick={()=>{
      const svg=drawing.current?.querySelector<SVGSVGElement>(".study-desktop svg");
      if(svg)exportSvg(svg, `${paper.id}-${f.id}`).catch(()=>toast("The SVG could not be exported. Please try again."));
    }}><Download size={12}/>SVG</button></div></figcaption>
  </figure>;
}
export function PaperQuiz({paper}:{paper:Paper}){
  const {state,act,busy,toast}=useApp();const [answers,setAnswers]=useState<Record<string,number>>({}),[checked,setChecked]=useState<Record<string,boolean>>({});
  const quiz=paper.study?.quiz;const running=state?.jobs.some(j=>j.paperId===paper.id&&j.type==="study"&&["queued","running"].includes(j.status));
  const failure=state?.jobs.filter(j=>j.paperId===paper.id&&j.type==="study").at(-1)?.status === "failed";
  const storageKey=`afterimage-quiz:${paper.id}:${quiz?.map(q=>q.question).join("|")||""}`;
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||"null");if(saved){setAnswers(saved.answers||{});setChecked(saved.checked||{});}else{setAnswers({});setChecked({});}}catch{}},[storageKey]);
  function persist(a:Record<string,number>,c:Record<string,boolean>){try{localStorage.setItem(storageKey,JSON.stringify({answers:a,checked:c}));}catch{}}
  if(!quiz)return <section className="paper-quiz panel study-empty"><span className="eyebrow">MAKE IT STICK</span><h2>From reading to understanding.</h2><p>Create a few visual examples and a short quiz from this paper’s sources.</p><button className="button" disabled={running||busy||!paper.recall} onClick={()=>act({action:"study",paperId:paper.id}).then(()=>toast("Your visual study guide is queued.")).catch(()=>{})}>{running?"Creating your study guide…":"Create visual study guide"}<ArrowRight size={15}/></button>{failure&&!running&&<p className="notice">The study guide did not finish. Please try again.</p>}</section>;
  return <ReaderQuiz key={storageKey} aria-label="Paper quiz" questions={quiz.map(question=>({...question,source:paper.sources.find(source=>source.id===question.sourceId)}))} answers={answers} checked={checked}
    onSelect={(id,choice)=>{const next={...answers,[id]:choice};setAnswers(next);persist(next,checked);}}
    onCheck={id=>{const next={...checked,[id]:true};setChecked(next);persist(answers,next);}}
    onRetry={id=>{const next={...checked};delete next[id];setChecked(next);persist(answers,next);}}/>;
}
