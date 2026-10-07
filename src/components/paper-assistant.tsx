"use client";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, X, MessageSquare, Square, Quote, Copy, Plus, History } from "lucide-react";
import { createPortal } from "react-dom";
import type { Paper } from "@/lib/types";
import { isActiveTurn, targetQuery, type AssistantTarget, type AssistantTurn, type AssistantSource, type Conversation } from "@/lib/assistant-model";
import { AssistantAnswer, type CitationHandlers } from "./assistant-answer";
import { useApp } from "./app-context";
import type { PdfDestination } from "./paper-pdf";
import { PaperLoading } from "./paper-loading";
const PaperPdf=lazy(()=>import("./paper-pdf").then(module=>({default:module.PaperPdf})));
type Selection={text:string;x:number;y:number};
type HistoryPage={items:Conversation[];nextCursor:string|null};
type TurnPage={conversation:Conversation;items:AssistantTurn[];nextCursor:string|null};
async function read<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(init?.method==="POST"?45000:15000),...init});if(!response.ok)throw Error("The assistant could not be reached.");return response.json();}
export function PaperAssistant({paper,children,available=true}:{paper:Paper;children:ReactNode;available?:boolean}){
  return <ReaderAssistant target={{kind:"paper",id:paper.id}} title={paper.title} arxivId={paper.arxivId} available={available}>{children}</ReaderAssistant>;
}
export function ReaderAssistant({target,title,arxivId,children,available=true}:{target:AssistantTarget;title:string;arxivId:string;children:ReactNode;available?:boolean}){
  const {toast}=useApp();
  const targetKey=`${target.kind}:${target.id}`;
  const [open,setOpen]=useState(false),[narrow,setNarrow]=useState(false),[top,setTop]=useState(108);
  const [tab,setTab]=useState<"reading"|"paper">("reading"),[pdfOpened,setPdfOpened]=useState(false),[destination,setDestination]=useState<PdfDestination|null>(null);
  const [conversationId,setConversationId]=useState<string|null>(null),[messages,setMessages]=useState<AssistantTurn[]>([]),[before,setBefore]=useState<string|null>(null);
  const [history,setHistory]=useState<Conversation[]>([]),[historyCursor,setHistoryCursor]=useState<string|null>(null),[historyOpen,setHistoryOpen]=useState(false),[loading,setLoading]=useState(true);
  const [question,setQuestion]=useState(""),[highlight,setHighlight]=useState<Selection|null>(null),[selectionQuestion,setSelectionQuestion]=useState("");
  const [sending,setSending]=useState(false),[error,setError]=useState(""),[uncertain,setUncertain]=useState(false);
  const [source,setSource]=useState<{key:string;top:number;left:number;width:number}|null>(null),[sourceCache,setSourceCache]=useState<Record<string,AssistantSource|null>>({});
  const root=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),conversation=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null);
  const events=useRef<EventSource|null>(null),follow=useRef(true),currentChat=useRef<string|null>(null),loadSequence=useRef(0),submitting=useRef(false);
  const draft=useRef(new Map<string,string>()),scrollPositions=useRef({reading:0,paper:0});
  const pending=useRef<{id:string;conversationId:string;question:string;selection:string;target:AssistantTarget}|null>(null);
  const sourceData=useRef<Record<string,AssistantSource|null>>({}),sourcePending=useRef(new Map<string,Promise<AssistantSource|null>>()),hideTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const running=messages.find(isActiveTurn);
  const scrollReply=useCallback(()=>{if(follow.current)requestAnimationFrame(()=>conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:"instant"}));},[]);
  const loadSource=useCallback((key:string):Promise<AssistantSource|null>=>{
    if(sourceData.current[key])return Promise.resolve(sourceData.current[key]);
    if(sourcePending.current.has(key))return sourcePending.current.get(key)!;
    const [turnId,...parts]=key.split("|");
    const task=read<AssistantSource>(`/api/assistant?id=${encodeURIComponent(turnId)}&sourceId=${encodeURIComponent(parts.join("|"))}`).catch(()=>null).then(value=>{sourceData.current[key]=value;setSourceCache({...sourceData.current});sourcePending.current.delete(key);return value;});
    sourcePending.current.set(key,task);return task;
  },[]);
  const keepSource=useCallback(()=>{if(hideTimer.current)clearTimeout(hideTimer.current);},[]);
  const hideSource=useCallback(()=>{keepSource();hideTimer.current=setTimeout(()=>setSource(null),160);},[keepSource]);
  function show(){if(!available)return;returnFocus.current=document.activeElement as HTMLElement;setOpen(true);setTimeout(()=>input.current?.focus(),0);}
  function close(){setSource(null);setOpen(false);requestAnimationFrame(()=>{if(returnFocus.current?.isConnected)returnFocus.current.focus();else root.current?.querySelector<HTMLButtonElement>(".assistant-launch,.reader-assistant-launch")?.focus();});}
  function switchTab(next:"reading"|"paper"){
    if(next===tab)return;
    if(tab==="reading")scrollPositions.current.reading=window.scrollY;
    setTab(next);setHighlight(null);
    if(next==="paper")setPdfOpened(true);
  }
  useLayoutEffect(()=>{
    const top=tab==="paper"?0:scrollPositions.current.reading;
    window.scrollTo({top,behavior:"instant"});
  },[tab]);
  function watch(id:string,chatId:string){
    events.current?.close();const stream=new EventSource(`/api/assistant?id=${encodeURIComponent(id)}&stream=1`);events.current=stream;
    stream.addEventListener("reply",event=>{
      if(currentChat.current!==chatId)return;
      const reply=JSON.parse((event as MessageEvent).data) as AssistantTurn;if(reply.conversationId!==chatId)return;
      setError("");setMessages(old=>old.some(m=>m.id===reply.id)?old.map(m=>m.id===reply.id?reply:m):[...old,reply]);
      if(!isActiveTurn(reply)){stream.close();if(reply.error)setError(reply.error);void loadHistory();}
    });
    stream.addEventListener("fault",()=>{if(currentChat.current===chatId)setError("Connection interrupted. Reconnecting…");});
    stream.onerror=()=>{if(currentChat.current===chatId&&stream.readyState!==EventSource.CLOSED)setError("Reconnecting to your reply…");};
  }
  async function loadHistory(cursor?:string){
    const params=targetQuery(target);if(cursor)params.set("cursor",cursor);
    const data=await read<HistoryPage>(`/api/assistant?${params}`);
    setHistory(old=>cursor?[...old,...data.items.filter(item=>!old.some(c=>c.id===item.id))]:data.items);setHistoryCursor(data.nextCursor);return data;
  }
  async function selectChat(id:string|null){
    if(submitting.current||uncertain)return;
    draft.current.set(currentChat.current||"new",question);
    const sequence=++loadSequence.current;events.current?.close();currentChat.current=id;setConversationId(id);setMessages([]);setBefore(null);setError("");setHistoryOpen(false);setHighlight(null);setSource(null);setQuestion(draft.current.get(id||"new")||"");follow.current=true;
    if(!id){setLoading(false);return;}
    setLoading(true);
    try{const page=await read<TurnPage|null>(`/api/assistant?conversationId=${encodeURIComponent(id)}`);
      if(sequence!==loadSequence.current)return;
      if(!page||page.conversation.target.kind!==target.kind||page.conversation.target.id!==target.id)throw Error("Chat not found.");
      setMessages(page.items);setBefore(page.nextCursor);const job=page.items.find(isActiveTurn);if(job)watch(job.id,id);
    }catch{if(sequence===loadSequence.current)setError("Could not load this chat. Reopen it from History to try again.");}
    finally{if(sequence===loadSequence.current)setLoading(false);}
  }
  useEffect(()=>{
    let alive=true;
    loadHistory().then(data=>{if(alive)void selectChat(data.items[0]?.id||null);}).catch(()=>{if(alive){setLoading(false);setError("Could not load chat history. Open History to retry.");}});
    return()=>{alive=false;loadSequence.current++;events.current?.close();if(hideTimer.current)clearTimeout(hideTimer.current);};
    // The parent keys this workspace by canonical target identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[targetKey]);
  useEffect(()=>{
    const query=matchMedia("(max-width: 999px)");const measure=()=>{setNarrow(query.matches);const bottom=document.querySelector(".site-header")?.getBoundingClientRect().bottom||0;setTop(Math.max(0,bottom)+16);};
    measure();query.addEventListener("change",measure);window.addEventListener("scroll",measure,{passive:true});window.addEventListener("resize",measure);
    const observer=new ResizeObserver(measure);const header=document.querySelector(".site-header");if(header)observer.observe(header);
    return()=>{query.removeEventListener("change",measure);window.removeEventListener("scroll",measure);window.removeEventListener("resize",measure);observer.disconnect();};
  },[]);
  useEffect(()=>{if(open&&follow.current)scrollReply();},[messages,open,scrollReply]);
  useEffect(()=>{
    if(!open)return;const keys=messages.flatMap(m=>[...m.answer.matchAll(/\[source:([^\]]+)\]|\[notecard\]/g)].map(match=>`${m.id}|${match[1]||"notecard"}`));
    void Promise.all([...new Set(keys)].slice(-24).map(loadSource));
  },[open,messages,loadSource]);
  function captureSelection():Selection|null{
    const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
    const range=selection.getRangeAt(0),parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
    if(!parent?.closest("[data-assistant-content]")||!root.current?.contains(parent)||parent.closest("button,textarea,input,.paper-quiz,.subject-quiz"))return null;
    const clone=range.cloneContents();clone.querySelectorAll(".katex").forEach(el=>{const tex=el.querySelector('annotation[encoding="application/x-tex"]')?.textContent;if(tex)el.replaceWith(document.createTextNode(` $${tex}$ `));else el.querySelectorAll(".katex-mathml").forEach(node=>node.remove());});
    const text=(clone.textContent||selection.toString()).trim().slice(0,6000);if(text.length<3)return null;
    const rect=range.getBoundingClientRect();return {text,x:Math.max(12,Math.min(innerWidth-352,rect.left)),y:Math.max(12,Math.min(innerHeight-180,rect.bottom+8))};
  }
  function dismissSelection(){window.getSelection()?.removeAllRanges();setHighlight(null);setSelectionQuestion("");}
  useEffect(()=>{
    if(!available)return;
    const select=(event:Event)=>{if((event.target as Element)?.closest?.(".selection-popover"))return;const value=captureSelection();if(value){setHighlight(value);setSelectionQuestion("");}else if(!(event.target as Element)?.closest?.(".paper-assistant"))setHighlight(null);};
    const keys=(event:KeyboardEvent)=>{
      if(event.key==="Tab"&&root.current)root.current.dataset.keyboardNavigation="true";
      const editable=(event.target as Element)?.closest("input,textarea,[contenteditable='true']");
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="e"&&!editable){const selected=captureSelection();if(selected){event.preventDefault();if(!running&&!loading&&!submitting.current&&!uncertain){show();void send("Explain this selection",selected.text);}return;}}
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="j"){event.preventDefault();if(open)close();else show();}
      if(event.defaultPrevented)return;
      if(event.key==="Escape"){if(highlight||captureSelection()){event.preventDefault();dismissSelection();return;}if(source){setSource(null);return;}if(historyOpen){setHistoryOpen(false);return;}if(open)close();}
      if(open&&narrow&&event.key==="Tab"){
        const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>(".paper-assistant button:not(:disabled),.paper-assistant textarea,.paper-assistant a,.assistant-table-scroll")||[]).filter(node=>node.offsetParent!==null);
        if(source)nodes.push(...document.querySelectorAll<HTMLElement>(".assistant-source-preview button,.assistant-source-preview a"));
        if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0]?.focus();}
      }
    };
    const scrolled=(event:Event)=>{if(!(event.target as Element)?.closest?.(".selection-popover"))setHighlight(null);};
    document.addEventListener("scroll",scrolled,true);
    document.addEventListener("mouseup",select);document.addEventListener("touchend",select);document.addEventListener("keyup",select);document.addEventListener("keydown",keys);
    return()=>{document.removeEventListener("scroll",scrolled,true);document.removeEventListener("mouseup",select);document.removeEventListener("touchend",select);document.removeEventListener("keyup",select);document.removeEventListener("keydown",keys);};
  });
  async function accepted(reply:AssistantTurn){
    setMessages(old=>old.map(m=>m.id===reply.id?reply:m));pending.current=null;setUncertain(false);setError("");if(isActiveTurn(reply))watch(reply.id,reply.conversationId);await loadHistory().catch(()=>{});
  }
  async function reconcile(){
    const request=pending.current;if(!request)return;
    try{const saved=await read<AssistantTurn|null>(`/api/assistant?id=${request.id}`);if(saved){await accepted(saved);return;}
      setUncertain(false);setMessages(old=>old.filter(m=>m.id!==request.id));setQuestion(request.selection?"":request.question);
      if(request.selection){setHighlight({text:request.selection,x:Math.max(12,innerWidth-760),y:Math.max(12,innerHeight-240)});setSelectionQuestion(request.question);}
      setError("This question was not found in the chat. You can send it again.");
      // Keep the same request ID for a deliberate retry after an uncertain write.
    }catch{setUncertain(true);setError("Could not confirm whether this question was saved. Check again before sending.");}
  }
  async function send(value=question,selection=""){
    if(!value.trim()||running||submitting.current||loading||uncertain)return;
    submitting.current=true;setSending(true);setError("");follow.current=true;
    const chatId=currentChat.current||crypto.randomUUID();currentChat.current=chatId;setConversationId(chatId);
    const previous=pending.current;
    const request={id:previous&&previous.question===value.trim()&&previous.selection===selection&&previous.conversationId===chatId?previous.id:crypto.randomUUID(),conversationId:chatId,target,question:value.trim(),selection};
    pending.current=request;draft.current.delete(chatId);draft.current.delete("new");const at=new Date().toISOString();
    const optimistic:AssistantTurn={...request,status:"queued",answer:"",createdAt:at,updatedAt:at,evidenceDigest:"",sources:[]};
    setMessages(old=>[...old.filter(m=>m.id!==request.id),optimistic]);setQuestion("");setHighlight(null);setSelectionQuestion("");window.getSelection()?.removeAllRanges();
    try{await accepted(await read<AssistantTurn>("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ask",...request})}));}
    catch{setUncertain(true);await reconcile();}
    finally{submitting.current=false;setSending(false);}
  }
  async function cancel(){if(!running)return;try{await read("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel",id:running.id})});}catch{setError("Could not stop the reply. Try again.");}}
  async function navigateCitation(key:string){
    setSource(null);const selected=await loadSource(key);if(!selected){setError("This source could not be loaded. Try the citation again.");return;}
    if(selected.kind==="lesson"||selected.kind==="notecard"||selected.id==="notecard"){
      switchTab("reading");requestAnimationFrame(()=>{if(selected.sectionId)document.getElementById(selected.sectionId)?.scrollIntoView({block:"start",behavior:"smooth"});else window.scrollTo({top:0,behavior:"smooth"});});
    }else{setDestination({key,source:selected});switchTab("paper");}
  }
  const citations=useMemo(()=>new Map(messages.map(turn=>[turn.id,{
    current:source?.key.startsWith(`${turn.id}|`)?source.key.slice(turn.id.length+1):null,
    keep:keepSource,hide:hideSource,
    show:(id:string,anchor:HTMLButtonElement)=>{keepSource();const rect=anchor.getBoundingClientRect(),rail=anchor.closest(".paper-assistant")!.getBoundingClientRect(),width=Math.min(360,innerWidth-32),left=rail.left>=width+24?rail.left-width-12:Math.max(16,Math.min(innerWidth-width-16,rect.left));const key=`${turn.id}|${id}`;setSource({key,width,left,top:Math.max(16,Math.min(innerHeight-340,rect.top-24))});void loadSource(key);},
    navigate:(id:string)=>void navigateCitation(`${turn.id}|${id}`),
  } satisfies CitationHandlers])),[messages,source,keepSource,hideSource,loadSource,tab]);
  const busy=sending||loading||uncertain;
  const assistantControl=target.kind==="subject"&&available&&!open?<button className="reader-assistant-launch" onClick={show} aria-label="Ask this lesson"><MessageSquare size={15}/><span>{tab==="paper"?"Ask":"Ask this lesson"}</span>{tab==="reading"&&<kbd>⌘ J</kbd>}</button>:null;
  const viewControls=<nav className="reader-view-tabs" aria-label="Reading view"><div className="reader-view-switch"><button aria-pressed={tab==="reading"} onClick={()=>switchTab("reading")}>{target.kind==="subject"?"Lesson":"Analysis"}</button><button aria-pressed={tab==="paper"} onClick={()=>switchTab("paper")}>Paper</button></div>{tab==="reading"&&assistantControl}</nav>;
  return <div ref={root} onPointerDown={()=>{if(root.current)root.current.dataset.keyboardNavigation="false";}} data-reader-view={tab} className={`reader-workspace ${open?"assistant-open":""}`}>
    <div className="reader-main" inert={open&&narrow?true:undefined}>
      {tab==="reading"&&viewControls}
      <div data-assistant-content hidden={tab!=="reading"}>{children}</div>
      {pdfOpened&&<div className="reader-pdf-view" data-assistant-content hidden={tab!=="paper"}><Suspense fallback={<section className="paper-pdf" aria-label={`Original paper: ${title}`}><div className="pdf-toolbar">{viewControls}{assistantControl&&<div className="pdf-toolbar-actions">{assistantControl}</div>}</div><div className="pdf-pages"><PaperLoading/></div></section>}><PaperPdf target={target} title={title} arxivId={arxivId} destination={destination} viewControls={viewControls} toolbarActions={assistantControl}/></Suspense></div>}
    </div>
    {target.kind==="paper"&&available&&!open&&<button className="assistant-launch button" onClick={show}><MessageSquare size={17}/>Ask this paper<kbd>⌘ J</kbd></button>}
    {available&&highlight&&<form className="selection-popover" style={{left:highlight.x,top:highlight.y}} onSubmit={event=>{event.preventDefault();show();void send(selectionQuestion,highlight.text);}} aria-label="Ask about selected text">
      <button type="button" className="icon-button selection-close" aria-label="Dismiss selection" onClick={dismissSelection}><X size={14}/></button>
      <textarea aria-label="Question about selected text" placeholder="What would you like to understand?" value={selectionQuestion} maxLength={3000} onChange={event=>setSelectionQuestion(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();show();void send(selectionQuestion,highlight.text);}}}/>
      <div><button type="submit" className="button small" disabled={!selectionQuestion.trim()||busy||!!running}>Ask AI<ArrowUp size={14}/></button><button type="button" className="text-button" disabled={busy||!!running} onMouseDown={event=>event.preventDefault()} onClick={()=>{show();void send("Explain this selection",highlight.text);}}>Quick explain<kbd>⌘ E</kbd></button></div>
    </form>}
    {available&&open&&<aside className="paper-assistant" role="dialog" aria-modal={narrow||undefined} aria-label="Reading assistant" style={narrow?undefined:{top:`${top}px`}}>
      <div className="assistant-resize-edge" aria-hidden="true" onPointerDown={event=>{if(narrow)return;event.preventDefault();const panel=event.currentTarget.parentElement!,workspace=panel.parentElement!,startX=event.clientX,startWidth=panel.getBoundingClientRect().width;const resize=(move:PointerEvent)=>workspace.style.setProperty("--assistant-width",`${Math.max(320,Math.min(innerWidth/2-16,startWidth+startX-move.clientX))}px`);const stop=()=>{window.removeEventListener("pointermove",resize);window.removeEventListener("pointerup",stop);};window.addEventListener("pointermove",resize);window.addEventListener("pointerup",stop);}}/>
      <div className="assistant-heading"><span>Read with Afterimage</span><div><button className="text-button" title="New chat" aria-label="New chat" disabled={sending||uncertain} onClick={()=>void selectChat(null)}><Plus size={14}/>New chat</button><button className="text-button" title="History" aria-label="Chat history" aria-expanded={historyOpen} disabled={sending||uncertain} onClick={()=>{setHistoryOpen(!historyOpen);void loadHistory().catch(()=>setError("Could not load chat history. Try again."));}}><History size={14}/>History</button><button className="icon-button" aria-label="Close assistant" onClick={close}><X size={18}/></button></div></div>
      {historyOpen?<div className="assistant-history"><h3>Chats about this {target.kind==="paper"?"paper":"lesson"}</h3>{error&&<p className="assistant-error" role="status">{error}</p>}{!history.length&&!error&&<p>No saved chats yet.</p>}{history.map(item=><button key={item.id} aria-current={item.id===conversationId?"true":undefined} onClick={()=>void selectChat(item.id)}><span>{item.title}</span><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></button>)}{historyCursor&&<button onClick={()=>void loadHistory(historyCursor).catch(()=>setError("Could not load older chats."))}>Older chats</button>}</div>:<>
        <div className="assistant-conversation" ref={conversation} onScroll={()=>{setSource(null);const el=conversation.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
          {before&&<button className="text-button" onClick={async()=>{const chat=currentChat.current;try{const data=await read<TurnPage>(`/api/assistant?conversationId=${encodeURIComponent(chat!)}&before=${encodeURIComponent(before)}`);if(currentChat.current!==chat)return;follow.current=false;const el=conversation.current,height=el?.scrollHeight||0;setMessages(old=>[...data.items,...old]);setBefore(data.nextCursor);requestAnimationFrame(()=>{if(el)el.scrollTop+=el.scrollHeight-height;});}catch{setError("Could not load earlier messages.");}}}>Earlier messages</button>}
          {loading?<p className="assistant-status" role="status">Loading chat…</p>:!messages.length&&<div className="assistant-welcome"><Quote size={23}/><h3>Stay with the idea.</h3><p>Ask a question, or select a passage to explore it.</p></div>}
          {messages.map(message=><section className="assistant-turn" key={message.id}><div className="assistant-question">{message.selection&&<blockquote>{message.selection}</blockquote>}<p>{message.question}</p></div><div className="assistant-answer" aria-busy={isActiveTurn(message)}><AssistantAnswer text={message.answer} status={message.status} sources={message.sources.map(s=>s.id)} labels={Object.fromEntries(message.sources.map(s=>[s.id,s.label]))} citation={citations.get(message.id)!} onReveal={scrollReply}/>{!message.answer&&<p className="assistant-status" role="status">{message.status==="queued"?(sending?"Saving your question…":"Waiting for your assistant…"):message.status==="running"?"Reading the source…":message.error||"Reply stopped."}</p>}</div>{message.answer&&!isActiveTurn(message)&&<div className="assistant-answer-actions"><button className="text-button" onClick={()=>navigator.clipboard.writeText(message.answer).then(()=>toast("Copied.")).catch(()=>toast("Could not copy."))}><Copy size={12}/>Copy</button>{message.status!=="complete"&&<span>{message.status==="cancelled"?"Stopped":"Incomplete"}</span>}</div>}</section>)}
        </div>
        <form className="assistant-composer" onSubmit={event=>{event.preventDefault();void send();}}>{error&&<p className="assistant-error" role="status">{error}{uncertain&&<button type="button" className="text-button" onClick={()=>void reconcile()}>Check again</button>}</p>}<div className="assistant-input-well"><textarea ref={input} value={question} onChange={event=>setQuestion(event.target.value)} maxLength={3000} aria-label="Ask a question" placeholder={`Ask about this ${target.kind==="paper"?"paper":"lesson"}…`} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}/><div className="assistant-input-bottom"><span/>{running?<button type="button" className="assistant-send" aria-label="Stop reply" disabled={sending||uncertain} onClick={()=>void cancel()}><Square size={14}/></button>:<button type="submit" className="assistant-send" disabled={!question.trim()||busy} aria-label="Send question"><ArrowUp size={17}/></button>}</div></div></form>
      </>}
    </aside>}
    {open&&source&&createPortal(<div id="assistant-source-preview" className="assistant-source-preview" role="dialog" aria-label="Source context" style={{top:source.top,left:source.left,width:source.width}} onMouseEnter={keepSource} onMouseLeave={hideSource} onFocus={keepSource} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))hideSource();}}><button className="icon-button" aria-label="Close source preview" onClick={()=>setSource(null)}><X size={15}/></button>{sourceCache[source.key]?<><h3>{sourceCache[source.key]!.label}</h3><div className="assistant-source-excerpt">{sourceCache[source.key]!.excerpt}</div><button className="text-button" onClick={()=>void navigateCitation(source.key)}>Open cited section<ArrowUp size={13}/></button></>:<p role="status">{Object.hasOwn(sourceCache,source.key)?"Could not load this excerpt.":"Loading source…"}</p>}</div>,document.body)}
  </div>;
}
