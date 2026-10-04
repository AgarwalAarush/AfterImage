"use client";
import { useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode } from "react";
import { useApp } from "./app-context";

type Theme = "light" | "dark";
type Command = "hide" | "short" | "long" | "undo" | "stacked" | "collapse" | "expand" | "first" | "next" | "previous" | "diagram" | "focus-undo";
type Rect = {x:number;y:number;width:number;height:number};
type Sample = {rect:Rect;fontFamily:string;fontSize:string;fontWeight:string;lineHeight:string;color:string;background:string};
export type WorkspaceReviewSnapshot = {
  at:string;bindings:Record<string,string>;viewport:{width:number;height:number;scrollX:number;scrollY:number};
  theme:string;fontsReady:boolean;navigationExpanded:boolean;selectedBeat:string|null;playing:string|null;
  core:Record<string,Sample>;diagramTexts:{text:string;rect:Rect;fontFamily:string;fontSize:string;fontWeight:string}[];
  notices:{text:string;rect:Rect;buttons:{text:string;label:string|null;disabled:boolean}[]}[];
  focused:{tag:string;label:string|null;text:string};undoCount:number;events:{at:string;kind:string;detail:string}[];
};
type Snapshot = WorkspaceReviewSnapshot;
export type WorkspaceReviewObservation = {label:"baseline"|"comparison";previewScale:number;before:Snapshot|null;after:Snapshot;differences:string[]|null};
export type WorkspaceReviewAudit = {version:1;kind:"workspace-overlay-observations";syntheticNotices:true;requiresIndependentVisualReview:true;capturedAt:string;reviewerNotes:string;audits:WorkspaceReviewObservation[]};
const channel = "afterimage-workspace-review-command";
const longText = "This is a development review notice with deliberately long text. A paper was removed from this synthetic shortlist, and you can undo that choice. This message exercises wrapping, contrast and the available space beside the reader without changing its content or starting any research work.";
const buttonStyle:CSSProperties={padding:"6px 10px",border:"1px solid var(--line)",borderRadius:6,background:"var(--paper)",color:"var(--ink)",font:"500 12px var(--font-sans)",cursor:"pointer"};
const round = (value:number) => Math.round(value*100)/100;
function rect(element:Element, doc:Document):Rect {
  const r=element.getBoundingClientRect(),view=doc.defaultView!;
  return {x:round(r.x+view.scrollX),y:round(r.y+view.scrollY),width:round(r.width),height:round(r.height)};
}
function diagram(doc:Document) {return [...doc.querySelectorAll("svg")].find(svg=>svg.querySelector("[data-object]"));}
function snapshot(doc:Document):Snapshot {
  const view=doc.defaultView!,svg=diagram(doc),mechanism=svg?.closest("section");
  if(!svg||!mechanism)throw Error("The canonical mechanism has not rendered.");
  const sample=(element:Element):Sample=>{const style=view.getComputedStyle(element);return {rect:rect(element,doc),fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,color:style.color,background:style.backgroundColor};};
  const targets:{[key:string]:Element|null|undefined}={main:doc.querySelector("main"),reader:doc.querySelector(".subject-reader-page"),article:doc.querySelector(".subject-article"),mechanism,diagram:svg,controls:mechanism.querySelector('[aria-label="Mechanism explanation steps"]')};
  const core:Record<string,Sample>={};for(const [name,element] of Object.entries(targets)){if(!element)throw Error(`Missing review target ${name}`);core[name]=sample(element);}
  const focused=doc.activeElement;
  return {at:new Date().toISOString(),bindings:JSON.parse(doc.documentElement.dataset.workspaceReviewBindings || "{}"),
    viewport:{width:view.innerWidth,height:view.innerHeight,scrollX:view.scrollX,scrollY:view.scrollY},theme:doc.documentElement.dataset.theme || "unknown",fontsReady:doc.fonts.status === "loaded",
    navigationExpanded:doc.querySelector(".app-shell")?.getAttribute("data-navigation-expanded") === "true",selectedBeat:mechanism.querySelector('[aria-current="step"]')?.getAttribute("aria-label") || null,
    playing:mechanism.querySelector('button[aria-label$="mechanism walkthrough"]')?.getAttribute("aria-pressed") || null,core,
    diagramTexts:[...svg.querySelectorAll("text")].map(element=>{const style=view.getComputedStyle(element);return {text:element.textContent || "",rect:rect(element,doc),fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight};}),
    notices:[...doc.querySelectorAll(".toast-stack .toast")].map(element=>({text:element.textContent || "",rect:rect(element,doc),buttons:[...element.querySelectorAll("button")].map(button=>({text:button.textContent || "",label:button.getAttribute("aria-label"),disabled:button.disabled}))})),
    focused:{tag:focused?.tagName || "",label:focused?.getAttribute("aria-label") || null,text:(focused?.textContent || "").slice(0,120)},undoCount:Number(doc.documentElement.dataset.workspaceReviewUndo || "0"),events:JSON.parse(doc.documentElement.dataset.workspaceReviewEvents || "[]")};
}
function compare(before:Snapshot,after:Snapshot) {
  const differences:string[]=[];
  for(const field of ["theme","fontsReady","navigationExpanded","selectedBeat","playing"] as const)if(before[field]!==after[field])differences.push(field);
  if(before.viewport.width!==after.viewport.width||before.viewport.height!==after.viewport.height)differences.push("viewport");
  for(const [name,value] of Object.entries(before.core))if(JSON.stringify(value)!==JSON.stringify(after.core[name]))differences.push(`core.${name}`);
  if(JSON.stringify(before.diagramTexts)!==JSON.stringify(after.diagramTexts))differences.push("diagramTexts");
  if(JSON.stringify(before.bindings)!==JSON.stringify(after.bindings))differences.push("bindings");
  return differences;
}
async function settled(doc:Document) {await doc.fonts.ready;await new Promise(resolve=>setTimeout(resolve,350));await new Promise<void>(resolve=>doc.defaultView!.requestAnimationFrame(()=>doc.defaultView!.requestAnimationFrame(()=>resolve())));}

/** Development controls mount beside the actual reader without adding layout nodes. */
export function WorkspaceReviewFrame({theme,bindings,children}:{theme:Theme;bindings:Record<string,string>;children:ReactNode}) {
  const {toast}=useApp();
  useEffect(()=>{
    const root=document.documentElement;
    root.dataset.workspaceReviewBindings=JSON.stringify(bindings);root.dataset.workspaceReviewUndo="0";
    const events:{at:string;kind:string;detail:string}[]=[];
    const record=(kind:string,detail:string)=>{events.push({at:new Date().toISOString(),kind,detail});root.dataset.workspaceReviewEvents=JSON.stringify(events.slice(-100));};
    const onInteraction=(event:Event)=>{const target=event.target;if(target instanceof Element && target.closest(".toast-stack"))record(event.type,target.tagName+":"+(target.getAttribute("aria-label") || target.textContent || "").slice(0,100));};
    for(const event of ["focusin","focusout","pointerover","pointerout"])document.addEventListener(event,onInteraction);
    const hide=()=>{toast("");document.querySelector<HTMLButtonElement>('.toast-stack button[aria-label="Dismiss notification"]')?.click();};
    const action={label:"Undo",run:()=>{record("action","undo invoked");root.dataset.workspaceReviewUndo=String(Number(root.dataset.workspaceReviewUndo || "0")+1);toast("Review Undo complete. No paper or Library state changed.");}};
    const execute=(command:Command)=>{
      record("command",command);
      const navigation=document.querySelector<HTMLButtonElement>(".sidebar-toggle"),walkthrough=diagram(document)?.closest("section");
      if(command==="hide")hide();
      else if(command==="short")toast("Copied. Development review only.");
      else if(command==="long")toast(longText);
      else if(command==="undo")toast("Recommendation dismissed. Development review only.",action);
      else if(command==="stacked"){toast(longText,action);setTimeout(()=>toast("Another status notice. The earlier Undo remains available."),0);}
      else if(command==="collapse"||command==="expand"){if(navigation?.getAttribute("aria-expanded") !== String(command==="expand"))navigation?.click();}
      else if(command==="first")walkthrough?.querySelector<HTMLButtonElement>('[aria-label="Mechanism explanation steps"] button')?.click();
      else if(command==="next"||command==="previous"){
        const buttons=[...(walkthrough?.querySelectorAll<HTMLButtonElement>('[aria-label="Mechanism explanation steps"] button') || [])],index=buttons.findIndex(button=>button.getAttribute("aria-current")==="step");
        buttons[Math.max(0,Math.min(buttons.length-1,index+(command==="next"?1:-1)))]?.click();
      } else if(command==="diagram")walkthrough?.scrollIntoView({block:"start",behavior:"instant"});
      else if(command==="focus-undo")document.querySelector<HTMLButtonElement>(".toast-stack .toast .text-button")?.focus();
    };
    const onCommand=(event:Event)=>{if(event instanceof CustomEvent)execute(event.detail as Command);};
    window.addEventListener(channel,onCommand);
    const timer=setTimeout(()=>{
      document.querySelector<HTMLInputElement>(`.theme-control input[value="${theme}"]`)?.click();
      execute("collapse");execute("first");root.dataset.workspaceReview="ready";
    },0);
    return()=>{clearTimeout(timer);window.removeEventListener(channel,onCommand);delete root.dataset.workspaceReview;delete root.dataset.workspaceReviewBindings;delete root.dataset.workspaceReviewUndo;delete root.dataset.workspaceReviewEvents;for(const event of ["focusin","focusout","pointerover","pointerout"])document.removeEventListener(event,onInteraction);};
  },[theme,bindings,toast]);
  return <>{children}</>;
}

/** Same-origin iframe supplies exact CSS viewport sizes without browser emulation. */
export function WorkspaceReview() {
  const [width,setWidth]=useState<900|1440>(1440),[theme,setTheme]=useState<Theme>("light"),[fit,setFit]=useState(true),[scale,setScale]=useState(1),[status,setStatus]=useState("Loading the development reader…");
  const frame=useRef<HTMLIFrameElement>(null),toolbar=useRef<HTMLDivElement>(null),container=useRef<HTMLDivElement>(null),baseline=useRef<Snapshot|null>(null);
  const audits=useRef<WorkspaceReviewObservation[]>([]);
  const [reviewerNotes,setReviewerNotes]=useState("");
  const [count,setCount]=useState(0);
  useEffect(()=>{
    const resize=()=>setScale(fit?Math.max(.2,Math.min(1,(window.innerWidth-32)/width,(window.innerHeight-(toolbar.current?.getBoundingClientRect().height || 160)-40)/900)):1);
    resize();const observer=new ResizeObserver(resize);if(toolbar.current)observer.observe(toolbar.current);window.addEventListener("resize",resize);return()=>{observer.disconnect();window.removeEventListener("resize",resize);};
  },[width,fit]);
  function doc() {const value=frame.current?.contentDocument;if(!value||value.documentElement.dataset.workspaceReview!=="ready")throw Error("The review iframe is not ready yet.");return value;}
  const command=(value:Command)=>{try{const target=doc().defaultView!;target.dispatchEvent(new (target as Window & typeof globalThis).CustomEvent(channel,{detail:value}));setStatus(`${value} applied to the actual reader controls.`);}catch(error){setStatus((error as Error).message);}};
  const capture=useCallback(async(isBaseline:boolean)=>{
    try{const document=frame.current?.contentDocument;if(!document||document.documentElement.dataset.workspaceReview!=="ready")throw Error("The review iframe is not ready yet.");await settled(document);const after=snapshot(document);
      if(after.viewport.width!==width||after.viewport.height!==900||after.theme!==theme||!after.fontsReady)throw Error("Viewport, theme or fonts do not match the requested review view.");
      if(isBaseline&&after.notices.length)throw Error("Hide notices before capturing a baseline.");
      if(isBaseline)baseline.current=after;
      const differences=isBaseline?null:baseline.current?compare(baseline.current,after):null;
      if(!isBaseline&&!baseline.current)throw Error("Capture a hidden-notice baseline first.");
      audits.current.push({label:isBaseline?"baseline":"comparison",previewScale:scale,before:isBaseline?null:baseline.current,after,differences});setCount(audits.current.length);
      setStatus(isBaseline?`Baseline saved: ${width} × 900, ${theme}.`:differences?.length?`Measured differences: ${differences.join(", ")}`:`Core measurements unchanged; ${after.notices.length} notices visible. Visual review remains separate.`);
    }catch(error){setStatus((error as Error).message);}
  },[width,theme,scale]);
  function downloadAudit() {
    const audit:WorkspaceReviewAudit={version:1,kind:"workspace-overlay-observations",syntheticNotices:true,requiresIndependentVisualReview:true,capturedAt:new Date().toISOString(),reviewerNotes,audits:audits.current};
    const blob=new Blob([JSON.stringify(audit,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="workspace-overlay-audit.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  const controls:{label:string;command:Command}[]=[{label:"Collapse navigation",command:"collapse"},{label:"Expand navigation",command:"expand"},{label:"First beat / pause",command:"first"},{label:"Previous beat",command:"previous"},{label:"Next beat",command:"next"},{label:"Show diagram",command:"diagram"},{label:"Hide notices",command:"hide"},{label:"Short notice",command:"short"},{label:"Long notice",command:"long"},{label:"Undo notice",command:"undo"},{label:"Stacked notices",command:"stacked"},{label:"Focus Undo",command:"focus-undo"}];
  return <div ref={container} style={{position:"fixed",inset:0,zIndex:1000,overflow:"auto",background:"var(--canvas)",padding:16,color:"var(--ink)"}}>
    <div ref={toolbar} style={{display:"grid",gap:8,paddingBottom:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:16}}>Workspace overlay review · development</strong><span style={{fontSize:12}}>Actual iframe: {width} × 900 · {theme} · preview {Math.round(scale*100)}%</span></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{([1440,900] as const).map(value=><button style={buttonStyle} key={value} aria-pressed={width===value} onClick={()=>{setWidth(value);baseline.current=null;}}>{value} × 900</button>)}{(["light","dark"] as const).map(value=><button style={buttonStyle} key={value} aria-pressed={theme===value} onClick={()=>{setTheme(value);baseline.current=null;}}>{value=== "light"?"Light review":"Dark review"}</button>)}<button style={buttonStyle} aria-pressed={fit} onClick={()=>setFit(value=>!value)}>{fit?"Show actual size":"Fit preview"}</button>{controls.map(control=><button style={buttonStyle} key={control.command} onClick={()=>command(control.command)}>{control.label}</button>)}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button style={buttonStyle} onClick={()=>void capture(true)}>Capture hidden baseline</button><button style={buttonStyle} onClick={()=>void capture(false)}>Compare current view</button><button style={buttonStyle} disabled={!count} onClick={downloadAudit}>Download audit ({count})</button><span role="status" style={{fontSize:12,alignSelf:"center"}}>{status}</span></div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>Independent review notes<input aria-label="Independent review notes" value={reviewerNotes} onChange={event=>setReviewerNotes(event.target.value)} maxLength={4000} placeholder="Record visual and interaction findings; these measurements do not grant approval." style={{flex:1,minWidth:240,padding:"5px 8px",fontSize:12}}/></label>
      <p style={{fontSize:11,margin:0}}>Use the isolated synthetic database. Native Dia screenshots and an independent visual review are still required. The fit preview scales only the outer iframe; its internal viewport stays exact.</p>
    </div>
    <div style={{width:width*scale,height:900*scale,position:"relative",border:"1px solid var(--line)",boxSizing:"content-box"}}>
      <iframe ref={frame} key={`${width}-${theme}`} title="Actual Subjects workspace review" src={`/subjects/review/workspace/frame?theme=${theme}`} width={width} height={900} onLoad={()=>setStatus("Reader loaded. Select First beat / pause, then Show diagram before a baseline.")} style={{width,height:900,border:0,display:"block",transform:`scale(${scale})`,transformOrigin:"top left"}}/>
    </div>
  </div>;
}
