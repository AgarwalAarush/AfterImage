"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Search, X } from "lucide-react";
import { subjectTopics, topicDescriptions, type SubjectListing } from "@/lib/subjects";

export function Subjects({entries}:{entries:SubjectListing[]}){
  const [topic,setTopic]=useState("All subjects"),[query,setQuery]=useState("");
  const visible=entries.filter(entry=>(topic==="All subjects"||entry.topic===topic)&&`${entry.title} ${entry.arxivId} ${entry.summary}`.toLowerCase().includes(query.toLowerCase()));
  const ready=entries.filter(entry=>entry.status==="available").length;
  return <div className="page subjects-page">
    <div className="page-intro"><span className="eyebrow">THE IDEAS BEHIND THE PAPERS</span><h1>Understand the ideas.</h1><p>Original lessons, grounded in research. Explore the mechanism, then try it yourself.</p></div>
    <div className="subjects-toolbar"><label className="document-search"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search concepts, lessons, or papers" aria-label="Search subjects"/>{query&&<button aria-label="Clear subject search" onClick={()=>setQuery("")}><X size={15}/></button>}</label><span>{ready} readable · {entries.length} topics cataloged</span></div>
    <div className="subjects-workspace"><aside className="subjects-topics" aria-label="Filter subjects">{["All subjects",...subjectTopics].map(name=><button key={name} aria-pressed={topic===name} className={topic===name?"selected":""} onClick={()=>setTopic(name)}><span>{name}</span><span>{name==="All subjects"?entries.length:entries.filter(entry=>entry.topic===name).length}</span></button>)}<p>Learn a concept in context, with the original research close at hand.</p></aside>
      <section className="subjects-results" aria-label="Subject lessons"><div className="subjects-results-heading"><h2>{topic}</h2><span>{visible.length} {visible.length===1?"lesson":"lessons"}</span></div>{topic!=="All subjects"&&<p className="subjects-description">{topicDescriptions[topic as typeof subjectTopics[number]]}</p>}
        {visible.length?<div className="subject-grid">{visible.map((entry,index)=><article className="subject-card" key={entry.id}>
          <div className="subject-card-motif" aria-hidden="true"><svg viewBox="0 0 320 110"><path d={index%3===0?"M34 84 Q82 14 132 70 T280 20":index%3===1?"M35 60H100M100 60L175 26M100 60L175 86M175 26L275 50M175 86L275 50":"M40 86H80V35H120V65H160V25H200V55H250"} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity=".55"/>{Array.from({length:8},(_,i)=><circle key={i} cx={38+i*34} cy={30+((i*23+index*13)%55)} r={3+(i%3)} fill="var(--accent)" opacity={.15+i*.065}/>)}</svg></div>
          <div className="subject-card-copy"><span className="eyebrow">{entry.topic}</span><h3>{entry.status==="available"?<Link href={`/subjects/${entry.id}`} prefetch={false}>{entry.title}</Link>:entry.title}</h3><p>{entry.summary}</p><div className="subject-card-bottom">{entry.status==="available"?<><span>{Math.max(1,Math.round(entry.words/220))} min · interactive</span><Link href={`/subjects/${entry.id}`} prefetch={false}>Read lesson<ArrowRight size={14}/></Link></>:<><span>Not yet available</span><a href={entry.primaryUrl} target="_blank" rel="noreferrer">Paper<ArrowUpRight size={14}/></a></>}</div></div>
        </article>)}</div>:<div className="document-empty"><h2>No matching lessons.</h2><p>Try a different concept or paper identifier.</p><button className="text-button" onClick={()=>{setQuery("");setTopic("All subjects");}}>Clear filters</button></div>}
      </section></div>
    <p className="subjects-attribution">Topic coverage inspired by <a href="https://intuitivepapers.ai/library/" target="_blank" rel="noreferrer">intuitivepapers.ai ↗</a>. AfterImage lessons and experiments are original, based on the cited primary research.</p>
  </div>;
}
