"use client";
import { useEffect, useState } from "react";
import { Check, RotateCcw, ArrowRight, Download } from "lucide-react";
import type { Paper } from "@/lib/types";
import { studySvg, type StudyFigure } from "@/lib/study";
import { InlineText } from "./math";
import { useApp } from "./app";
import { download } from "@/lib/download";
export function StudyFigures({paper,placement}:{paper:Paper;placement:"mechanism"|"evidence"}){
  return <>{paper.study?.figures.filter(f=>f.placement===placement).map(f=><Figure key={f.id} figure={f} paper={paper}/>)}</>;
}
function Figure({figure:f,paper}:{figure:StudyFigure;paper:Paper}){
  const [state,setState]=useState(0);const source=paper.sources.find(s=>s.id===f.sourceId);
  return <figure className="study-figure" id={`figure-${f.id}`} data-concept={f.id}>
    <div className="study-figure-heading"><span className="eyebrow">{f.provenance==="illustrative"?"WORKED VISUAL EXAMPLE":"THE EVIDENCE, VISUALLY"}</span><h3>{f.title}</h3></div>
    {f.kind==="network"&&f.states.length>1&&<div className="figure-switch" role="group" aria-label="Diagram condition">{f.states.map((s,i)=><button key={i} aria-pressed={state===i} onClick={()=>setState(i)}>{s.label}</button>)}</div>}
    <div className="study-drawing"><div className="study-desktop" dangerouslySetInnerHTML={{__html:studySvg(f,false,state)}}/><div className="study-mobile" dangerouslySetInnerHTML={{__html:studySvg(f,true,state)}}/></div>
    {f.kind==="network"&&<><p className="figure-state"><InlineText text={f.states[state].explanation}/></p><details className="weight-ledger"><summary>Inspect the connection weights</summary><ul>{f.states[state].edges.map((e,i)=><li key={i}><span>{f.layers[e.fromLayer].nodes[e.from]} → {f.layers[e.fromLayer+1].nodes[e.to]}</span><code>{e.weight}</code><span>{e.active?"Active":"Inactive"}</span></li>)}</ul></details></>}
    <figcaption><span className="eyebrow">{f.provenance==="illustrative"?"ILLUSTRATIVE · NOT A BENCHMARK":"REPORTED IN THE PAPER"}</span><p><InlineText text={f.caption}/></p><div>{source&&<a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>}<button className="text-button" onClick={()=>download(`${paper.id}-${f.id}.svg`,studySvg(f,false,state),"image/svg+xml")}><Download size={12}/>SVG</button></div></figcaption>
  </figure>;
}
export function PaperQuiz({paper}:{paper:Paper}){
  const {state,act,busy,toast}=useApp();const [answers,setAnswers]=useState<Record<string,number>>({}),[checked,setChecked]=useState<Record<string,boolean>>({}),[index,setIndex]=useState(0);
  const quiz=paper.study?.quiz;const running=state?.jobs.some(j=>j.paperId===paper.id&&j.type==="study"&&["queued","running"].includes(j.status));
  const failure=state?.jobs.filter(j=>j.paperId===paper.id&&j.type==="study").at(-1)?.status === "failed";
  const storageKey=`afterimage-quiz:${paper.id}:${quiz?.map(q=>q.question).join("|")||""}`;
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||"null");if(saved){setAnswers(saved.answers||{});setChecked(saved.checked||{});}else{setAnswers({});setChecked({});}setIndex(0);}catch{}},[storageKey]);
  function persist(a:Record<string,number>,c:Record<string,boolean>){try{localStorage.setItem(storageKey,JSON.stringify({answers:a,checked:c}));}catch{}}
  if(!quiz)return <section className="paper-quiz panel study-empty"><span className="eyebrow">MAKE IT STICK</span><h2>From reading to understanding.</h2><p>Create a few visual examples and a short quiz from this paper’s sources.</p><button className="button" disabled={running||busy||!paper.recall} onClick={()=>act({action:"study",paperId:paper.id}).then(()=>toast("Your visual study guide is queued.")).catch(()=>{})}>{running?"Creating your study guide…":"Create visual study guide"}<ArrowRight size={15}/></button>{failure&&!running&&<p className="notice">The study guide did not finish. Please try again.</p>}</section>;
  const q=quiz[index],choice=answers[q.id],isChecked=checked[q.id],correct=choice===q.answer,source=paper.sources.find(s=>s.id===q.sourceId),count=quiz.filter(q=>checked[q.id]).length;
  return <section className="paper-quiz panel" aria-label="Paper quiz"><div className="quiz-heading"><span className="eyebrow">CHECK YOUR UNDERSTANDING</span><span className="eyebrow">{String(index+1).padStart(2,"0")} / {String(quiz.length).padStart(2,"0")}</span></div><h2><InlineText text={q.question}/></h2><fieldset><legend className="sr-only">{q.question}</legend>{q.options.map((o,i)=><label key={i} className={`quiz-option ${isChecked&&i===q.answer?"correct":""} ${isChecked&&i===choice&&!correct?"incorrect":""}`}><input type="radio" name={`quiz-${q.id}`} checked={choice===i} disabled={!!isChecked} onChange={()=>{const a={...answers,[q.id]:i};setAnswers(a);persist(a,checked);}}/><span><InlineText text={o.text}/></span>{isChecked&&i===q.answer&&<Check size={16}/>}</label>)}</fieldset>
    {isChecked&&<div className="quiz-feedback" role="status"><strong>{correct?"Exactly.":"Not quite. Here’s the distinction."}</strong><p><InlineText text={q.options[choice].explanation}/></p>{!correct&&<p><InlineText text={q.options[q.answer].explanation}/></p>}{source&&<a href={source.url} target="_blank" rel="noreferrer">Revisit the source ↗</a>}</div>}
    <div className="quiz-actions">{!isChecked?<button className="button primary" disabled={choice===undefined} onClick={()=>{const c={...checked,[q.id]:true};setChecked(c);persist(answers,c);}}>Check answer</button>:<button className="text-button" onClick={()=>{const c={...checked};delete c[q.id];setChecked(c);persist(answers,c);}}><RotateCcw size={13}/>Try again</button>}<div>{index>0&&<button className="text-button" onClick={()=>setIndex(index-1)}>Previous</button>}{index<quiz.length-1&&<button className="text-button" onClick={()=>setIndex(index+1)}>Next question<ArrowRight size={14}/></button>}</div></div>{count===quiz.length&&<p className="quiz-score">{quiz.filter(q=>answers[q.id]===q.answer).length} of {quiz.length} correct. Revisit any question to work through the distinction.</p>}
  </section>;
}
