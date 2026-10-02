"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Download, ExternalLink, Search } from "lucide-react";
import { targetQuery, type AssistantSource, type AssistantTarget } from "@/lib/assistant-model";
import { locatePdfSource, normalizePdfText, type PdfMatch, type PdfTextPage } from "@/lib/pdf-location";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
export type PdfDestination={key:string;source:AssistantSource};
type PdfModule=typeof import("pdfjs-dist");
let runtime:Promise<PdfModule>|undefined;
function pdfRuntime(){return runtime??=import("pdfjs-dist").then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();return pdf;});}
function PdfPage({document,page,scale,match,onVisible}:{document:PDFDocumentProxy;page:number;scale:number;match:PdfMatch|null;onVisible:(page:number)=>void}){
  const container=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),text=useRef<HTMLDivElement>(null);
  const [dimensions,setDimensions]=useState({width:612,height:792}),[visible,setVisible]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{let alive=true;void document.getPage(page).then(pdfPage=>{if(alive){const viewport=pdfPage.getViewport({scale:1});setDimensions({width:viewport.width,height:viewport.height});}});return()=>{alive=false;};},[document,page]);
  useEffect(()=>{const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)setVisible(true);if(entry.intersectionRatio>.35)onVisible(page);}},{root:container.current?.closest(".pdf-pages"),rootMargin:"300px 0px",threshold:[0,.35,.7]});if(container.current)observer.observe(container.current);return()=>observer.disconnect();},[page,onVisible]);
  useEffect(()=>{
    if(!visible)return;let alive=true,renderTask:ReturnType<PDFPageProxy["render"]>|undefined,textLayer:InstanceType<PdfModule["TextLayer"]>|undefined;
    setReady(false);
    void (async()=>{const [pdf,pdfPage]=await Promise.all([pdfRuntime(),document.getPage(page)]);if(!alive||!canvas.current||!text.current)return;
      const viewport=pdfPage.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2),context=canvas.current.getContext("2d")!;
      canvas.current.width=Math.floor(viewport.width*ratio);canvas.current.height=Math.floor(viewport.height*ratio);
      renderTask=pdfPage.render({canvas:canvas.current,canvasContext:context,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:undefined});
      const content=await pdfPage.getTextContent();if(!alive)return;text.current.replaceChildren();
      textLayer=new pdf.TextLayer({textContentSource:content,container:text.current,viewport});await Promise.all([renderTask.promise,textLayer.render()]);if(alive)setReady(true);
    })().catch(error=>{if(alive&&error?.name!=="RenderingCancelledException")setReady(false);});
    return()=>{alive=false;renderTask?.cancel();textLayer?.cancel();};
  },[document,page,scale,visible]);
  useEffect(()=>{
    if(!ready||!text.current)return;const spans=[...text.current.querySelectorAll("span")];spans.forEach(span=>span.classList.remove("pdf-match"));
    if(match?.page!==page)return;
    const normalized=spans.map(span=>normalizePdfText(span.textContent||""));const joined=normalized.join(" "),start=joined.indexOf(match.needle);if(start<0)return;
    let offset=0;spans.forEach((span,index)=>{if(offset<start+match.needle.length&&offset+normalized[index].length>start)span.classList.add("pdf-match");offset+=normalized[index].length+1;});
    text.current.querySelector(".pdf-match")?.scrollIntoView({block:"center",behavior:"instant"});
  },[ready,match,page]);
  return <div ref={container} id={`pdf-page-${page}`} className={`pdf-page ${ready?"":"pdf-page-placeholder"}`} style={{width:dimensions.width*scale,height:dimensions.height*scale,"--scale-factor":scale,"--total-scale-factor":scale,"--user-unit":1} as CSSProperties} aria-label={`Page ${page}`}>
    {!ready&&<span>Page {page}</span>}<canvas ref={canvas} aria-hidden="true"/><div ref={text} className="textLayer"/>
  </div>;
}
export function PaperPdf({target,title,arxivId,destination}:{target:AssistantTarget;title:string;arxivId:string;destination:PdfDestination|null}){
  const [attempt,setAttempt]=useState(0);
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(""),[status,setStatus]=useState("Loading original paper…"),[scale,setScale]=useState(1),[page,setPage]=useState(1),[search,setSearch]=useState("");
  const [match,setMatch]=useState<PdfMatch|null>(null),[download,setDownload]=useState(""),[digest,setDigest]=useState("");
  const pages=useRef<Promise<PdfTextPage[]>|null>(null),locations=useRef(new Map<string,PdfMatch|null>()),pane=useRef<HTMLDivElement>(null);
  const targetKey=`${target.kind}:${target.id}`;
  useEffect(()=>{
    setError("");setStatus("Loading original paper…");setDocument(null);setDownload("");setMatch(null);
    const controller=new AbortController();let blobUrl="",task:ReturnType<PdfModule["getDocument"]>|undefined,alive=true;
    void (async()=>{
      const response=await fetch(`/api/reader/pdf?${targetQuery(target)}`,{signal:controller.signal});if(!response.ok)throw Error("The PDF could not be loaded. Retry loading the PDF or open the original source.");
      const bytes=await response.arrayBuffer();if(!alive)return;setDigest(response.headers.get("X-Paper-Digest")||"");
      blobUrl=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));setDownload(blobUrl);
      const pdf=await pdfRuntime();if(!alive)return;task=pdf.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,cMapUrl:"/api/reader/assets/cmaps/",cMapPacked:true,standardFontDataUrl:"/api/reader/assets/standard_fonts/",wasmUrl:"/api/reader/assets/wasm/"});const doc=await task.promise;if(!alive)return;
      setDocument(doc);setStatus("");const first=await doc.getPage(1),width=first.getViewport({scale:1}).width;setScale(Math.max(.35,Math.min(1.5,((pane.current?.clientWidth||width)-32)/width)));
    })().catch(error=>{if(alive){setError(error.message||"The PDF could not be opened.");setStatus("");}});
    return()=>{alive=false;controller.abort();void task?.destroy();if(blobUrl)URL.revokeObjectURL(blobUrl);pages.current=null;};
    // Canonical identity is stable for the life of this viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[targetKey,attempt]);
  function textPages(){
    if(!document)return Promise.resolve([]);
    return pages.current??=(async()=>{const result:PdfTextPage[]=[];for(let index=1;index<=document.numPages;index++){const page=await document.getPage(index),content=await page.getTextContent();result.push({page:index,text:content.items.map(item=>"str" in item?item.str+(item.hasEOL?"\n":" "):"").join("")});}return result;})();
  }
  function goTo(next:number){if(!document)return;const value=Math.max(1,Math.min(document.numPages,next));setPage(value);pane.current?.querySelector(`#pdf-page-${value}`)?.scrollIntoView({block:"start",behavior:"instant"});}
  useEffect(()=>{
    if(!destination||!document)return;let alive=true;setStatus("Finding the cited passage…");setMatch(null);
    void (async()=>{const key=`${digest}:${destination.key}`,cached=locations.current.get(key);const found=cached===undefined?locatePdfSource(await textPages(),destination.source):cached;locations.current.set(key,found);if(!alive)return;
      if(found){setMatch(found);goTo(found.page);setStatus(`${destination.source.label} · page ${found.page}`);}else setStatus("Could not locate this passage confidently in this PDF. Open the original section below.");
    })().catch(()=>{if(alive)setStatus("The paper text could not be indexed. Open the original section below.");});return()=>{alive=false;};
    // Match against this exact fetched PDF, never a previous document's locations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[destination,document,digest]);
  async function find(){if(!search.trim())return;setStatus("Searching paper…");try{const needle=normalizePdfText(search),all=await textPages(),matches=all.filter(p=>normalizePdfText(p.text).includes(needle));const found=matches.find(p=>p.page>page)||matches[0];if(found){setMatch({page:found.page,needle,method:"passage"});goTo(found.page);setStatus(`${matches.length} matching page${matches.length===1?"":"s"}. Search again for the next match.`);}else setStatus("No matching text found.");}catch{setStatus("Search is unavailable for this PDF.");}}
  return <section className="paper-pdf" aria-label={`Original paper: ${title}`}><div className="pdf-toolbar"><button className="icon-button" aria-label="Previous page" disabled={!document||page<=1} onClick={()=>goTo(page-1)}><ChevronLeft size={16}/></button><input aria-label="Page number" type="number" min={1} max={document?.numPages||1} value={page} onChange={event=>{const next=Number(event.target.value);if(next>0)goTo(next);}}/><span>/ {document?.numPages||"—"}</span><button className="icon-button" aria-label="Next page" disabled={!document||page===document.numPages} onClick={()=>goTo(page+1)}><ChevronRight size={16}/></button><button className="icon-button" aria-label="Zoom out" disabled={scale<=.35} onClick={()=>setScale(value=>Math.max(.35,value-.15))}><Minus size={16}/></button><span>{Math.round(scale*100)}%</span><button className="icon-button" aria-label="Zoom in" disabled={scale>=2.5} onClick={()=>setScale(value=>Math.min(2.5,value+.15))}><Plus size={16}/></button><form onSubmit={event=>{event.preventDefault();void find();}}><input type="search" aria-label="Search paper" placeholder="Find in paper" value={search} onChange={event=>setSearch(event.target.value)}/><button className="icon-button" aria-label="Find next" disabled={!document}><Search size={15}/></button></form>{download&&<a href={download} download={`${arxivId.replaceAll("/","-")}.pdf`} aria-label="Download paper"><Download size={16}/></a>}<a href={`https://arxiv.org/abs/${arxivId}`} target="_blank" rel="noreferrer" aria-label="Open original paper"><ExternalLink size={16}/></a></div>{(status||error)&&<p className="pdf-status" role="status">{error||status}</p>}{error&&<button className="button small" onClick={()=>setAttempt(value=>value+1)}>Retry PDF</button>}{destination&&!match&&/^https:\/\/arxiv\.org\//.test(destination.source.url)&&<a className="text-button" href={destination.source.url} target="_blank" rel="noreferrer">Open original section<ExternalLink size={13}/></a>}<div className="pdf-pages" ref={pane}>{document&&Array.from({length:document.numPages},(_,index)=><PdfPage key={index} document={document} page={index+1} scale={scale} match={match} onVisible={setPage}/>)}</div></section>;
}
