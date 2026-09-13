"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, X, MessageSquare, Square, Quote, Copy, BookmarkPlus } from "lucide-react";
import type { Paper } from "@/lib/types";
import type { AssistantRequest } from "@/lib/assistant";
import { useApp } from "./app";
import { MathText, InlineText } from "./math";

type Reply=Omit<AssistantRequest,"leaseToken"|"leaseUntil">;
const active=(r:Reply)=>r.status==="running"||r.status==="queued";
export function PaperAssistant({paper,children}:{paper:Paper;children:ReactNode}){
  const {state,act,toast}=useApp();
  const [narrow,setNarrow]=useState(false);
  const [pastTopBar,setPastTopBar]=useState(false);
  const [open,setOpen]=useState(false),[question,setQuestion]=useState(""),[selection,setSelection]=useState(""),[highlight,setHighlight]=useState<{text:string;x:number;y:number}|null>(null);
  const [messages,setMessages]=useState<Reply[]>([]),[sending,setSending]=useState(false),[error,setError]=useState(""),[source,setSource]=useState<{label:string;url:string;excerpt:string}|null>(null);
  const root=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),conversation=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null),follow=useRef(true),events=useRef<EventSource|null>(null);
  const running=messages.find(active);
  function show(){returnFocus.current=document.activeElement as HTMLElement;setOpen(true);setTimeout(()=>input.current?.focus(),0);}
  function close(){setOpen(false);returnFocus.current?.focus();}
  function watch(id:string){
    events.current?.close();const stream=new EventSource(`/api/assistant?id=${encodeURIComponent(id)}`);events.current=stream;
    stream.addEventListener("reply",ev=>{const reply=JSON.parse((ev as MessageEvent).data) as Reply;setError("");setMessages(old=>old.some(m=>m.id===reply.id)?old.map(m=>m.id===reply.id?reply:m):[...old,reply]);if(!active(reply)){stream.close();if(reply.error)setError(reply.error);}});
    stream.addEventListener("fault",()=>setError("Connection interrupted. Reconnecting…"));
    stream.onerror=()=>{if(stream.readyState!==EventSource.CLOSED)setError("Reconnecting to your reply…");};
  }
  useEffect(()=>{const query=matchMedia("(max-width: 999px)");const change=()=>setNarrow(query.matches);change();query.addEventListener("change",change);return()=>query.removeEventListener("change",change);},[]);
  useEffect(()=>{const check=()=>setPastTopBar(window.scrollY>88);check();window.addEventListener("scroll",check,{passive:true});return()=>window.removeEventListener("scroll",check);},[]);
  useEffect(()=>{
    let ignore=false;
    fetch(`/api/assistant?paperId=${encodeURIComponent(paper.id)}`).then(r=>{if(!r.ok)throw Error();return r.json();}).then((data:Reply[])=>{if(ignore)return;setMessages(data);const job=data.find(active);if(job)watch(job.id);}).catch(()=>{if(!ignore)setError("Could not load conversation history. You can still ask a question.");});
    return()=>{ignore=true;events.current?.close();};
  },[paper.id]);
  useEffect(()=>{
    if(open&&messages.length&&follow.current)conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:"instant"});
  },[messages,open]);
  useEffect(()=>{
    const select=()=>{
      const s=window.getSelection();if(!s||s.isCollapsed||!s.rangeCount){setHighlight(null);return;}
      const range=s.getRangeAt(0),parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
      if(!parent?.closest(".paper-page")||parent.closest("button,textarea,input,.paper-quiz")){setHighlight(null);return;}
      const clone=range.cloneContents();clone.querySelectorAll(".katex-mathml").forEach(el=>el.remove());
      const text=(clone.textContent||s.toString()).trim().slice(0,6000);if(text.length<3){setHighlight(null);return;}
      const rect=range.getBoundingClientRect();setHighlight({text,x:Math.max(12,Math.min(innerWidth-180,rect.left)),y:Math.max(12,Math.min(innerHeight-55,rect.bottom+8))});
    };
    const keys=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="j"){e.preventDefault();if(open)close();else show();}
      if(e.key==="Escape"){setHighlight(null);setSource(null);if(open)close();}
      if(open&&innerWidth<1000&&e.key==="Tab"){
        const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>(".paper-assistant button:not(:disabled), .paper-assistant textarea, .paper-assistant a")||[]).filter(n=>n.offsetParent!==null);
        const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener("touchend",select);document.addEventListener("mouseup",select);document.addEventListener("keyup",select);document.addEventListener("keydown",keys);
    return()=>{document.removeEventListener("touchend",select);document.removeEventListener("mouseup",select);document.removeEventListener("keyup",select);document.removeEventListener("keydown",keys);};
  },[open]);
  async function send(value=question){
    if(!value.trim()||running||sending)return;setSending(true);setError("");follow.current=true;
    const id=crypto.randomUUID();
    try{
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ask",id,paperId:paper.id,question:value,selection})});const data=await response.json();if(!response.ok)throw new Error(data.error);
      setMessages(old=>[...old,data]);setQuestion("");setSelection("");watch(id);
    }catch(e){setError((e as Error).message);}finally{setSending(false);}
  }
  async function cancel(){if(!running)return;try{const r=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel",id:running.id})});if(!r.ok)throw Error();}catch{setError("Could not stop the reply. Try again.");}}
  async function cite(id:string){
    if(id==="notecard"){setSource({label:"Afterimage notecard",url:"",excerpt:"This citation refers to the explanation on this page. It is an editorial or AI-generated interpretation, not a quotation from the original paper."});return;}
    try{const r=await fetch(`/api/assistant?paperId=${encodeURIComponent(paper.id)}&sourceId=${encodeURIComponent(id)}`);if(!r.ok)throw Error();setSource(await r.json());}catch{toast("Could not open that source.");}
  }
  async function save(reply:Reply){
    const old=state?.entries[paper.id]?.takeaway||"";const next=`${old}${old?"\n\n":""}Q: ${reply.question}\n${reply.answer}`;
    if(next.length>8000){toast("Your notes are full. Copy this answer instead.");return;}
    await act({action:"entry",paperId:paper.id,patch:{takeaway:next}}).then(()=>toast("Saved to this paper’s notes and Markdown export.")).catch(()=>{});
  }
  return <div ref={root} className={`reader-workspace ${open?"assistant-open":""}`}>
    <div inert={open&&narrow?true:undefined}>{children}</div>
    {!open&&<button className="assistant-launch button" onClick={show}><MessageSquare size={17}/>Ask this paper <kbd>⌘ J</kbd></button>}
    {highlight&&<button className="selection-ask" style={{left:highlight.x,top:highlight.y}} onMouseDown={e=>e.preventDefault()} onClick={()=>{setSelection(highlight.text);setHighlight(null);show();window.getSelection()?.removeAllRanges();}}><MessageSquare size={14}/>Ask about this</button>}
    {open&&<aside className="paper-assistant" role="dialog" aria-modal={narrow||undefined} aria-label="Paper assistant" style={narrow?undefined:{top:pastTopBar?"16px":"92px"}}>
      <div className="assistant-heading"><div><span className="eyebrow">READ WITH AFTERIMAGE</span><h2>Ask this paper</h2></div><button className="icon-button" aria-label="Close assistant" onClick={close}><X size={18}/></button></div>
      <p className="assistant-paper-name">{paper.title}</p>
      <div className="assistant-context"><span className="status-dot"/> {messages.length?`${messages.length} question${messages.length===1?"":"s"}`:"Ask a question"}</div>
      <form className="assistant-composer" onSubmit={e=>{e.preventDefault();void send();}}>
        {selection&&<div className="assistant-selection"><Quote size={13}/><span>{selection}</span><button type="button" className="icon-button" aria-label="Remove selected passage" onClick={()=>setSelection("")}><X size={14}/></button></div>}
        {error&&<p className="assistant-error" role="status">{error}</p>}
        <div className="assistant-input-well"><textarea ref={input} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={3000} aria-label="Ask about this paper" placeholder={selection?"What would you like to understand?":"Ask about the paper, math, or evidence…"} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><div className="assistant-input-bottom"><span>{selection?"PASSAGE SELECTED":"PAPER IN CONTEXT"}</span>{running?<button type="button" className="assistant-send" aria-label="Stop reply" onClick={cancel}><Square size={14}/></button>:<button type="submit" className="assistant-send" disabled={!question.trim()||sending} aria-label="Send question"><ArrowUp size={17}/></button>}</div></div>
      </form>
      <div className="assistant-conversation" ref={conversation} onScroll={()=>{const el=conversation.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
        {!messages.length&&<div className="assistant-welcome"><Quote size={25}/><h3>Stay with the idea.</h3><div className="assistant-starters">{["Explain the main mechanism step by step","Walk me through a concrete example","What does this paper leave unresolved?"].map(q=><button key={q} disabled={sending} onClick={()=>send(q)}>{q}<ArrowUp size={13}/></button>)}</div></div>}
        {messages.map(m=><section className="assistant-turn" key={m.id}>
          <div className="assistant-question">{m.selection&&<blockquote>{m.selection}</blockquote>}<p>{m.question}</p></div>
          <div className="assistant-answer" aria-busy={active(m)}>{m.answer?<Answer text={m.answer} cite={cite} sources={paper.sources.map(s=>s.id)}/>:<p className="assistant-status" role="status">{m.status==="queued"?"Waiting for your assistant…":m.status==="running"?"Reading the paper…":m.error||"Reply stopped."}</p>}{active(m)&&m.answer&&<span className="stream-cursor" aria-label="Generating"/>}</div>
          {m.answer&&!active(m)&&<div className="assistant-answer-actions"><button className="text-button" onClick={()=>navigator.clipboard.writeText(m.answer).then(()=>toast("Copied.")).catch(()=>toast("Could not copy."))}><Copy size={12}/>Copy</button><button className="text-button" onClick={()=>save(m)}><BookmarkPlus size={12}/>Save note</button>{m.status!=="complete"&&<span>{m.status==="cancelled"?"Stopped":"Incomplete"}</span>}</div>}
        </section>)}
      </div>
      {source&&<div className="assistant-source"><button className="icon-button" aria-label="Close source" onClick={()=>setSource(null)}><X size={15}/></button><span className="eyebrow">SOURCE CONTEXT</span><h3>{source.label}</h3><p>{source.excerpt}</p>{source.url&&<a href={source.url} target="_blank" rel="noreferrer">Open original source ↗</a>}</div>}
    </aside>}
  </div>;
}
function Answer({text,cite,sources}:{text:string;cite:(id:string)=>void;sources:string[]}){
  function inline(value:string):ReactNode{return value.split(/(\[source:[^\]]+\]|\[notecard\]|\*\*[^*]+\*\*)/g).map((part,i)=>{
    const id=part==="[notecard]"?"notecard":part.match(/^\[source:([^\]]+)\]$/)?.[1];
    if(id)return sources.includes(id)||id==="notecard"?<button className="assistant-citation" key={i} onClick={()=>cite(id)}>{id==="notecard"?"notecard":`source ${sources.indexOf(id)+1}`}</button>:<span key={i}>[unverified citation]</span>;
    return part.startsWith("**")?<strong key={i}><InlineText text={part.slice(2,-2)}/></strong>:<InlineText key={i} text={part}/>;
  });}
  return <>{text.split(/(\$\$[\s\S]*?\$\$)/).map((block,i)=>block.startsWith("$$")?<MathText key={i} latex={block.slice(2,-2)} display/>:block.split(/\n\s*\n/).filter(Boolean).map((p,j)=>/^#{1,4} /.test(p)?<h3 key={`${i}-${j}`}>{inline(p.replace(/^#{1,4} /,""))}</h3>: /^(?:[-*]|\d+\.) /.test(p) ? <ul key={`${i}-${j}`}>{p.split(/\n(?=(?:[-*]|\d+\.) )/).map((line,k)=><li key={k}>{inline(line.replace(/^(?:[-*]|\d+\.) /,""))}</li>)}</ul> :<p key={`${i}-${j}`}>{inline(p)}</p>))}</>;
}
