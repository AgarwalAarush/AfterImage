"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Download } from "lucide-react";
import { SubjectProse as Prose } from "./subject-prose";
import { SubjectExperiment } from "./subject-experiment";
import { ReaderQuiz } from "./reader-quiz";
import { SubjectMechanismWalkthrough } from "./subject-mechanism";
import type { PublishedSubjectMechanism } from "@/lib/subject-mechanism";
import { download } from "@/lib/download";
import type { PublishedLesson, SubjectEntry } from "@/lib/subjects";
import "katex/dist/katex.min.css";

const QuizText=({text}:{text:string})=><Prose text={text} inline/>;

const sectionHeading=(title:string)=>title.replace(/^\s*\d+[.)]\s+/, "");

export function SubjectReader({entry,lesson,mechanism=null}:{entry:SubjectEntry;lesson:PublishedLesson;mechanism?:PublishedSubjectMechanism|null}){
  const [read,setRead]=useState(false),[answers,setAnswers]=useState<Record<number,number>>({}),[checked,setChecked]=useState<Record<number,boolean>>({});
  const progressKey=`afterimage-subject:${entry.id}:${lesson.review.contentDigest}`;
  useEffect(()=>{
    try {const saved=JSON.parse(localStorage.getItem(progressKey)||"{}");setRead(saved.read===true);setAnswers(saved.answers||{});setChecked(saved.checked||{});}catch{}
  },[progressKey]);
  function persist(next:{read:boolean;answers:Record<number,number>;checked:Record<number,boolean>}){try{localStorage.setItem(progressKey,JSON.stringify(next));}catch{}}
  const words=lesson.sections.reduce((sum,section)=>sum+section.markdown.split(/\s+/).length,0);
  function exportLesson(){
    const text=`# ${lesson.title}\n\n${lesson.summary}\n\n`+lesson.sections.map(section=>`## ${section.title}\n\n${section.markdown}\n\n`+(section.figureId?`Interactive experiment: ${lesson.figures.find(figure=>figure.id===section.figureId)?.title}. Available in the AfterImage reader; this Markdown export does not include playback.\n\n`:"")).join("")+"## Sources\n\n"+lesson.sources.map(source=>`- [${source.label}](${source.url})`).join("\n")+"\n";
    download(entry.id+".md",text,"text/markdown");
  }
  return <div className="subject-reader-page">
    <div className="subject-reader-top"><Link href="/subjects"><ArrowLeft size={15}/>Subjects</Link><div><a className="text-button" href={entry.primaryUrl} target="_blank" rel="noreferrer">Original paper<ArrowUpRight size={14}/></a><button className="text-button" onClick={exportLesson}><Download size={14}/>Markdown</button></div></div>
    <div className="subject-reader-layout"><aside className="subject-outline"><span className="eyebrow">{entry.topic}</span><nav aria-label="Lesson contents">{lesson.sections.map((section,index)=><a href={`#${section.id}`} key={section.id}><span className="subject-outline-number">{String(index+1).padStart(2,"0")}</span><span className="subject-outline-title"><Prose text={sectionHeading(section.title)} inline/></span></a>)}<a href="#subject-quiz"><span className="subject-outline-number">↗</span>Test your understanding</a><a href="#subject-sources"><span className="subject-outline-number">↗</span>Research sources</a></nav><button className={`button small ${read?"":"primary"}`} aria-pressed={read} onClick={()=>{setRead(!read);persist({read:!read,answers,checked});}}>{read?<Check size={14}/>:<ArrowRight size={14}/>} {read?"Read":"Mark as read"}</button></aside>
      <article className="subject-article"><header className="subject-article-header"><span className="eyebrow">ORIGINAL AFTERIMAGE LESSON · {Math.max(1,Math.round(words/220))} MIN READ</span><h1><Prose text={lesson.title} inline/></h1><p><Prose text={lesson.summary} inline/></p><div className="subject-prerequisites"><span className="subject-prerequisite-label">Useful background</span>{lesson.prerequisites.map(text=><div className="subject-prerequisite-chip" key={text}><Prose text={text} inline/></div>)}</div></header>
        <div className="subject-objectives"><h2>What you’ll be able to explain</h2><ul>{lesson.objectives.map(objective=><li key={objective}><Prose text={objective}/></li>)}</ul></div>
        {lesson.sections.map(section=><section id={section.id} key={section.id} className="subject-section"><h2><Prose text={sectionHeading(section.title)} inline/></h2><div className="document-markdown subject-prose"><Prose text={section.markdown} sectionTitle={section.title}/></div>{mechanism?.sectionId===section.id&&<SubjectMechanismWalkthrough mechanism={mechanism}/>} {section.figureId&&<SubjectExperiment figure={lesson.figures.find(figure=>figure.id===section.figureId)!}/>}<div className="subject-section-sources">{section.sourceIds.map(id=>{const source=lesson.sources.find(source=>source.id===id);return source?<a key={id} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={11}/></a>:null;})}</div></section>)}
        <ReaderQuiz
          key={progressKey}
          id="subject-quiz"
          aria-label="Lesson quiz"
          Text={QuizText}
          questions={lesson.quiz.map((question,index)=>({
            ...question,
            id:String(index),
            source:lesson.sources.find(source=>source.id===question.sourceIds[0]),
          }))}
          answers={answers}
          checked={checked}
          onSelect={(id,choice)=>{
            const next={...answers,[Number(id)]:choice};
            setAnswers(next);persist({read,answers:next,checked});
          }}
          onCheck={id=>{
            const next={...checked,[Number(id)]:true};
            setChecked(next);persist({read,answers,checked:next});
          }}
          onRetry={id=>{
            const next={...checked};delete next[Number(id)];
            setChecked(next);persist({read,answers,checked:next});
          }}
        />
        <section id="subject-sources" className="subject-sources"><h2>Return to the research.</h2><p>Follow the paper sections behind the explanation, equations, and reported results.</p><ul>{lesson.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={13}/></a></li>)}</ul></section>

      </article></div>
  </div>;
}
