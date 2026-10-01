"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, X, MessageSquare, Square, Quote, Copy } from "lucide-react";
import type { Paper } from "@/lib/types";
import type { AssistantRequest } from "@/lib/assistant";
import { useApp } from "./app";
import { createPortal } from "react-dom";
import { AssistantAnswer, type CitationHandlers } from "./assistant-answer";
import type { Source } from "@/lib/types";

type Reply=Omit<AssistantRequest,"leaseToken"|"leaseUntil">;
const active=(r:Reply)=>r.status==="running"||r.status==="queued";
export function PaperAssistant({paper,children,available=true}:{paper:Paper;children:ReactNode;available?:boolean}){
  const {toast}=useApp();
  const [narrow,setNarrow]=useState(false);
  const [pastTopBar,setPastTopBar]=useState(false);
  const [open,setOpen]=useState(false),[question,setQuestion]=useState(""),[selection,setSelection]=useState(""),[highlight,setHighlight]=useState<{text:string;x:number;y:number}|null>(null);
  const [messages,setMessages]=useState<Reply[]>([]),[sending,setSending]=useState(false),[error,setError]=useState(""),[source,setSource]=useState<{id:string;top:number;left:number;width:number}|null>(null),[sourceCache,setSourceCache]=useState<Record<string,Source|null>>({});
  const root=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),conversation=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null),follow=useRef(true),events=useRef<EventSource|null>(null);
  const running=messages.find(active);
  const submitting=useRef(false),sourceData=useRef<Record<string,Source|null>>(Object.create(null)),sourcePending=useRef(new Set<string>()),hideTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const sourceIds=useMemo(()=>paper.sources.map(s=>s.id),[paper.sources]);
  const scrollReply=useCallback(()=>{if(follow.current)requestAnimationFrame(()=>conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:"instant"}));},[]);
  const loadSources=useCallback(async(ids:string[])=>{
    const missing=ids.filter(id=>id!=="notecard"&&!Object.hasOwn(sourceData.current,id)&&!sourcePending.current.has(id));
    if(!missing.length)return;
    missing.forEach(id=>sourcePending.current.add(id));
    try{
      for(let offset=0;offset<missing.length;offset+=24){
      const batch=missing.slice(offset,offset+24);
      const params=new URLSearchParams({paperId:paper.id});batch.forEach(id=>params.append("sourceIds",id));
      const r=await fetch(`/api/assistant?${params}`);if(!r.ok)throw Error();
      const data=await r.json() as Source[];
      batch.forEach(id=>{sourceData.current[id]=data.find(s=>s.id===id)||null;});
      }
    }catch{missing.forEach(id=>{sourceData.current[id]=null;});}
    finally{missing.forEach(id=>sourcePending.current.delete(id));setSourceCache({...sourceData.current});}
  },[paper.id]);
  const keepSource=useCallback(()=>{if(hideTimer.current)clearTimeout(hideTimer.current);},[]);
  const hideSource=useCallback(()=>{if(hideTimer.current)clearTimeout(hideTimer.current);hideTimer.current=setTimeout(()=>setSource(null),160);},[]);
  const showSource=useCallback((id:string,anchor:HTMLButtonElement)=>{
    keepSource();
    if(sourceData.current[id]===null){delete sourceData.current[id];setSourceCache({...sourceData.current});}
    const rail=anchor.closest(".paper-assistant")!.getBoundingClientRect(),rect=anchor.getBoundingClientRect();
    const space=rail.left-24;
    const width=Math.min(360,window.innerWidth-32,space>=240?space:window.innerWidth-32);
    const left=space>=240?rail.left-width-12:Math.max(16,Math.min(window.innerWidth-width-16,rect.left));
    const top=Math.max(16,Math.min(window.innerHeight-340,rect.top-24));
    setSource({id,top,left,width});void loadSources([id]);
  },[keepSource,loadSources]);
  const citation=useMemo<CitationHandlers>(()=>({show:showSource,hide:hideSource,keep:keepSource,current:source?.id||null}),[showSource,hideSource,keepSource,source?.id]);
  useEffect(()=>{
    if(!open)return;
    const ids=[...new Set(messages.flatMap(m=>[...m.answer.matchAll(/\[source:([^\]]+)\]/g)].map(match=>match[1])))].filter(id=>sourceIds.includes(id));
    void loadSources(ids);
  },[open,messages,sourceIds,loadSources]);
  useEffect(()=>()=>{if(hideTimer.current)clearTimeout(hideTimer.current);},[]);
  function show(){if(!available)return;returnFocus.current=document.activeElement as HTMLElement;setOpen(true);setTimeout(()=>input.current?.focus(),0);}
  function close(){setSource(null);setOpen(false);returnFocus.current?.focus();}
  function watch(id:string){
    events.current?.close();const stream=new EventSource(`/api/assistant?id=${encodeURIComponent(id)}`);events.current=stream;
    stream.addEventListener("reply",ev=>{const reply=JSON.parse((ev as MessageEvent).data) as Reply;setError("");setMessages(old=>old.some(m=>m.id===reply.id)?old.map(m=>m.id===reply.id?reply:m):[...old,reply]);if(!active(reply)){stream.close();if(reply.error)setError(reply.error);}});
    stream.addEventListener("fault",()=>setError("Connection interrupted. Reconnecting…"));
    stream.onerror=()=>{if(stream.readyState!==EventSource.CLOSED)setError("Reconnecting to your reply…");};
  }
  useEffect(()=>{const query=matchMedia("(max-width: 999px)");const change=()=>setNarrow(query.matches);change();query.addEventListener("change",change);return()=>query.removeEventListener("change",change);},[]);
  useEffect(()=>{const check=()=>setPastTopBar(window.scrollY>88);check();window.addEventListener("scroll",check,{passive:true});return()=>window.removeEventListener("scroll",check);},[]);
  useEffect(()=>{
    if(!available){setOpen(false);setHighlight(null);return;}
    let ignore=false;
    fetch(`/api/assistant?paperId=${encodeURIComponent(paper.id)}`).then(r=>{if(!r.ok)throw Error();return r.json();}).then((data:Reply[])=>{if(ignore)return;setMessages(old=>[...data,...old.filter(m=>!data.some(r=>r.id===m.id))]);const job=data.find(active);if(job)watch(job.id);}).catch(()=>{if(!ignore)setError("Could not load conversation history. You can still ask a question.");});
    return()=>{ignore=true;events.current?.close();};
  },[available,paper.id]);
  useEffect(()=>{
    if(open&&messages.length&&follow.current)conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:"instant"});
  },[messages,open]);
  useEffect(()=>{
    if(!available)return;
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
      if(e.key==="Escape"){setHighlight(null);if(source){setSource(null);return;}if(open)close();}
      if(open&&innerWidth<1000&&e.key==="Tab"){
        const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>(".paper-assistant button:not(:disabled), .paper-assistant textarea, .paper-assistant a, .assistant-table-scroll")||[]).filter(n=>n.offsetParent!==null);
        if(source)nodes.push(...document.querySelectorAll<HTMLElement>(".assistant-source-preview button,.assistant-source-preview a"));
        const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener("touchend",select);document.addEventListener("mouseup",select);document.addEventListener("keyup",select);document.addEventListener("keydown",keys);
    return()=>{document.removeEventListener("touchend",select);document.removeEventListener("mouseup",select);document.removeEventListener("keyup",select);document.removeEventListener("keydown",keys);};
  },[available,open,source]);
  async function send(value=question){
    if(!value.trim()||running||submitting.current)return;
    submitting.current=true;setSending(true);setError("");follow.current=true;
    const id=crypto.randomUUID(),at=new Date().toISOString();
    const pending:Reply={id,paperId:paper.id,question:value.trim(),selection,status:"queued",answer:"",createdAt:at,updatedAt:at};
    setMessages(old=>[...old,pending]);setQuestion("");setSelection("");
    try{
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ask",id,paperId:paper.id,question:pending.question,selection:pending.selection})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not send your question.");
      setMessages(old=>old.map(m=>m.id===id?data:m));watch(id);
    }catch(e){
      const message=(e as Error).message;setError(message);
      setMessages(old=>old.map(m=>m.id===id?{...m,status:"failed",error:message}:m));
      setQuestion(current=>current||pending.question);setSelection(current=>current||pending.selection);
    }finally{submitting.current=false;setSending(false);}
  }
  async function cancel(){if(!running)return;try{const r=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel",id:running.id})});if(!r.ok)throw Error();}catch{setError("Could not stop the reply. Try again.");}}
  return <div ref={root} className={`reader-workspace ${open?"assistant-open":""}`}>
    <div inert={open&&narrow?true:undefined}>{children}</div>
    {available&&!open&&<button className="assistant-launch button" onClick={show}><MessageSquare size={17}/>Ask this paper <kbd>⌘ J</kbd></button>}
    {available&&highlight&&<button className="selection-ask" style={{left:highlight.x,top:highlight.y}} onMouseDown={e=>e.preventDefault()} onClick={()=>{setSelection(highlight.text);setHighlight(null);show();window.getSelection()?.removeAllRanges();}}><MessageSquare size={14}/>Ask about this</button>}
    {available&&open&&<aside className="paper-assistant" role="dialog" aria-modal={narrow||undefined} aria-label="Paper assistant" style={narrow?undefined:{top:pastTopBar?"16px":"92px"}}>
      <div className="assistant-resize-edge" aria-hidden="true" onPointerDown={e=>{if(narrow)return;e.preventDefault();const panel=e.currentTarget.parentElement!,workspace=panel.parentElement!,startX=e.clientX,startWidth=panel.getBoundingClientRect().width;const resize=(move:PointerEvent)=>{const next=Math.max(320,Math.min(window.innerWidth/2-16,startWidth+startX-move.clientX));workspace.style.setProperty("--assistant-width",`${next}px`);};const stop=()=>{window.removeEventListener("pointermove",resize);window.removeEventListener("pointerup",stop);};window.addEventListener("pointermove",resize);window.addEventListener("pointerup",stop);}} />
      <div className="assistant-heading"><span className="eyebrow">READ WITH AFTERIMAGE</span><button className="icon-button" aria-label="Close assistant" onClick={close}><X size={18}/></button></div>
      <form className="assistant-composer" onSubmit={e=>{e.preventDefault();void send();}}>
        {selection&&<div className="assistant-selection"><Quote size={13}/><span>{selection}</span><button type="button" className="icon-button" aria-label="Remove selected passage" onClick={()=>setSelection("")}><X size={14}/></button></div>}
        {error&&<p className="assistant-error" role="status">{error}</p>}
        <div className="assistant-input-well"><textarea ref={input} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={3000} aria-label="Ask about this paper" placeholder={selection?"What would you like to understand?":"Ask about the paper, math, or evidence…"} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><div className="assistant-input-bottom"><span>{selection?"PASSAGE SELECTED":"PAPER IN CONTEXT"}</span>{running?<button type="button" className="assistant-send" aria-label="Stop reply" disabled={sending} onClick={cancel}><Square size={14}/></button>:<button type="submit" className="assistant-send" disabled={!question.trim()||sending} aria-label="Send question"><ArrowUp size={17}/></button>}</div></div>
      </form>
      <div className="assistant-conversation" ref={conversation} onScroll={()=>{setSource(null);const el=conversation.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
        {!messages.length&&<div className="assistant-welcome"><Quote size={25}/><h3>Stay with the idea.</h3><div className="assistant-starters">{["Explain the main mechanism step by step","Walk me through a concrete example","What does this paper leave unresolved?"].map(q=><button key={q} disabled={sending} onClick={()=>send(q)}>{q}<ArrowUp size={13}/></button>)}</div></div>}
        {messages.map(m=><section className="assistant-turn" key={m.id}>
          <div className="assistant-question">{m.selection&&<blockquote>{m.selection}</blockquote>}<p>{m.question}</p></div>
          <div className="assistant-answer" aria-busy={active(m)}><AssistantAnswer text={m.answer} status={m.status} sources={sourceIds} citation={citation} onReveal={scrollReply}/>{!m.answer&&<p className="assistant-status" role="status">{m.status==="queued"?"Waiting for your assistant…":m.status==="running"?"Reading the paper…":m.error||"Reply stopped."}</p>}</div>
          {m.answer&&!active(m)&&<div className="assistant-answer-actions"><button className="text-button" onClick={()=>navigator.clipboard.writeText(m.answer).then(()=>toast("Copied.")).catch(()=>toast("Could not copy."))}><Copy size={12}/>Copy</button>{m.status!=="complete"&&<span>{m.status==="cancelled"?"Stopped":"Incomplete"}</span>}</div>}
        </section>)}
        {messages.length>0&&messages[messages.length-1].answer&&messages[messages.length-1].status==="complete"&&<div className="assistant-followups"><span className="eyebrow">FOLLOW UP</span><div className="assistant-starters">{["Make that more concrete","What evidence supports this?","How does this compare with the prior approach?"].map(q=><button key={q} disabled={sending} onClick={()=>send(q)}>{q}<ArrowUp size={13}/></button>)}</div></div>}
      </div>

    </aside>}
    {open&&source&&createPortal(<div id="assistant-source-preview" className="assistant-source-preview" role="dialog" aria-label="Source context" style={{top:source.top,left:source.left,width:source.width}} onMouseEnter={keepSource} onMouseLeave={hideSource} onFocus={keepSource} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))hideSource();}}>
      <button className="icon-button" aria-label="Close source preview" onClick={()=>setSource(null)}><X size={15}/></button>
      <span className="eyebrow">SOURCE CONTEXT</span>
      {source.id==="notecard"?<><h3>Afterimage notecard</h3><p>This citation refers to the explanation on this page. It is an editorial or AI-generated interpretation, not a quotation from the original paper.</p></>:sourceCache[source.id]?<><h3>{sourceCache[source.id]!.label}</h3><div className="assistant-source-excerpt">{sourceCache[source.id]!.excerpt}</div>{/^https?:\/\//i.test(sourceCache[source.id]!.url)&&<a href={sourceCache[source.id]!.url} target="_blank" rel="noreferrer">Open original source ↗</a>}</>:<p role="status">{Object.hasOwn(sourceCache,source.id)?"Could not load this excerpt.":"Loading source…"}</p>}
    </div>,document.body)}
  </div>;
}
