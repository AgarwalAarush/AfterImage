"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Download, ExternalLink, ChevronUp, ChevronDown, X } from "lucide-react";
import { targetQuery, type AssistantSource, type AssistantTarget } from "@/lib/assistant-model";
import { locatePdfSource, normalizePdfText, type PdfMatch, type PdfTextPage } from "@/lib/pdf-location";
import { findPdfTextMatches, normalizePdfSearchText, pdfSearchOriginalRange, type PdfSearchMatch } from "@/lib/pdf-search";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
export type PdfDestination={key:string;source:AssistantSource};
type PdfModule=typeof import("pdfjs-dist");
type IndexedPdfPage=PdfTextPage&{searchText:string};
let runtime:Promise<PdfModule>|undefined;
const emptySearchMatches:PdfSearchMatch[]=[];
function pdfRuntime(){return runtime??=import("pdfjs-dist").then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();return pdf;});}
// Scroll only the PDF pane; Element.scrollIntoView also moves the outer reader.
function scrollPdfTo(element:Element|undefined|null,center=false){
  const pane=element?.closest(".pdf-pages");if(!element||!pane)return;
  pane.scrollTo({top:pane.scrollTop+element.getBoundingClientRect().top-pane.getBoundingClientRect().top-(center?pane.clientHeight/2:0),behavior:"instant"});
}
function PdfPage({document,page,scale,match,searchMatches,activeSearch,highlightAll,onVisible}:{document:PDFDocumentProxy;page:number;scale:number;match:PdfMatch|null;searchMatches:PdfSearchMatch[];activeSearch:PdfSearchMatch|null;highlightAll:boolean;onVisible:(page:number)=>void}){
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
    if(!ready||!text.current)return;
    const spans=[...text.current.querySelectorAll("span")];
    spans.forEach(span=>{span.classList.remove("pdf-match","pdf-search-hit","pdf-search-current");if(span.querySelector("mark"))span.replaceChildren(globalThis.document.createTextNode(span.textContent||""));});
    const normalized=spans.map(span=>normalizePdfSearchText(span.textContent||""));
    if(searchMatches.length){
      let offset=0;
      spans.forEach((span,index)=>{
        const end=offset+normalized[index].length,raw=span.textContent||"";
        const hits=searchMatches.filter(hit=>hit.page===page&&offset<hit.end&&end>hit.start&&(highlightAll||hit===activeSearch));
        let cursor=0;
        const nodes:Node[]=[];
        for(const hit of hits){
          const [startAt,endAt]=pdfSearchOriginalRange(raw,Math.max(0,hit.start-offset),Math.min(normalized[index].length,hit.end-offset));
          if(startAt<cursor)continue;
          nodes.push(globalThis.document.createTextNode(raw.slice(cursor,startAt)));
          const mark=globalThis.document.createElement("mark");mark.className=hit===activeSearch?"pdf-search-current":"pdf-search-hit";mark.textContent=raw.slice(startAt,endAt);nodes.push(mark);cursor=endAt;
        }
        if(hits.length){nodes.push(globalThis.document.createTextNode(raw.slice(cursor)));span.replaceChildren(...nodes);}
        offset=end+(normalized[index]?1:0);
      });
      if(activeSearch?.page===page)scrollPdfTo(text.current.querySelector(".pdf-search-current"),true);
      return;
    }
    if(match?.page!==page)return;
    const joined=normalized.map(value=>normalizePdfText(value)).join(" "),start=joined.indexOf(match.needle);if(start<0)return;
    let offset=0;spans.forEach((span,index)=>{const length=normalizePdfText(normalized[index]).length;if(offset<start+match.needle.length&&offset+length>start)span.classList.add("pdf-match");offset+=length+1;});
    scrollPdfTo(text.current.querySelector(".pdf-match"),true);
  },[ready,match,page,searchMatches,activeSearch,highlightAll]);
  return <div ref={container} id={`pdf-page-${page}`} className={`pdf-page ${ready?"":"pdf-page-placeholder"}`} style={{width:dimensions.width*scale,height:dimensions.height*scale,"--scale-factor":scale,"--total-scale-factor":scale,"--user-unit":1} as CSSProperties} aria-label={`Page ${page}`}>
    {!ready&&<span>Page {page}</span>}<canvas ref={canvas} aria-hidden="true"/><div ref={text} className="textLayer"/>
  </div>;
}
export function PaperPdf({target,title,arxivId,destination,viewControls,toolbarActions}:{target:AssistantTarget;title:string;arxivId:string;destination:PdfDestination|null;viewControls?:ReactNode;toolbarActions?:ReactNode}){
  const [attempt,setAttempt]=useState(0),[fitWidth,setFitWidth]=useState(true);
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(""),[status,setStatus]=useState("Loading original paper…"),[scale,setScale]=useState(1),[page,setPage]=useState(1),[search,setSearch]=useState("");
  const [match,setMatch]=useState<PdfMatch|null>(null),[download,setDownload]=useState(""),[digest,setDigest]=useState("");
  const pages=useRef<Promise<IndexedPdfPage[]>|null>(null),locations=useRef(new Map<string,PdfMatch|null>()),pane=useRef<HTMLDivElement>(null);
  const [findOpen,setFindOpen]=useState(false),[highlightAll,setHighlightAll]=useState(true),[matchCase,setMatchCase]=useState(false),[wholeWords,setWholeWords]=useState(false);
  const [searchMatches,setSearchMatches]=useState<PdfSearchMatch[]>([]),[searchIndex,setSearchIndex]=useState(0),[searchStatus,setSearchStatus]=useState("");
  const viewer=useRef<HTMLElement>(null),findInput=useRef<HTMLInputElement>(null),findReturnFocus=useRef<HTMLElement|null>(null);
  const activeSearch=findOpen?searchMatches[searchIndex]||null:null;
  useEffect(()=>{
    if(findOpen){findInput.current?.focus();findInput.current?.select();}
  },[findOpen]);
  function closeFind(){setFindOpen(false);requestAnimationFrame(()=>{if(findReturnFocus.current?.isConnected)findReturnFocus.current.focus();else viewer.current?.querySelector<HTMLButtonElement>(".reader-view-switch button[aria-pressed='true']")?.focus();});}
  useEffect(()=>{
    const keys=(event:KeyboardEvent)=>{
      if(viewer.current?.closest("[hidden]"))return;
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="f"){
        event.preventDefault();findReturnFocus.current=globalThis.document.activeElement as HTMLElement;setFindOpen(true);findInput.current?.focus();findInput.current?.select();
      }else if(event.key==="Escape"&&findOpen){event.preventDefault();event.stopPropagation();closeFind();}
    };
    globalThis.document.addEventListener("keydown",keys,true);
    return()=>globalThis.document.removeEventListener("keydown",keys,true);
  },[findOpen]);
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
  useEffect(()=>{
    if(!document||!fitWidth||!pane.current)return;
    let alive=true;
    const fit=async()=>{const first=await document.getPage(1);if(alive&&pane.current?.clientWidth)setScale(Math.max(.35,Math.min(2.5,(pane.current.clientWidth-32)/first.getViewport({scale:1}).width)));};
    const observer=new ResizeObserver(()=>void fit());observer.observe(pane.current);void fit();
    return()=>{alive=false;observer.disconnect();};
  },[document,fitWidth]);
  function textPages(){
    if(!document)return Promise.resolve([]);
    return pages.current??=(async()=>{const result:IndexedPdfPage[]=[];for(let index=1;index<=document.numPages;index++){const page=await document.getPage(index),content=await page.getTextContent();result.push({page:index,text:content.items.map(item=>"str" in item?item.str+(item.hasEOL?"\n":" "):"").join(""),searchText:content.items.map(item=>"str" in item?normalizePdfSearchText(item.str):"").filter(Boolean).join(" ")});}return result;})();
  }
  function goTo(next:number){if(!document)return;const value=Math.max(1,Math.min(document.numPages,next));setPage(value);scrollPdfTo(pane.current?.querySelector(`#pdf-page-${value}`));}
  useEffect(()=>{
    if(!destination||!document)return;let alive=true;setStatus("Finding the cited passage…");setMatch(null);
    void (async()=>{const key=`${digest}:${destination.key}`,cached=locations.current.get(key);const found=cached===undefined?locatePdfSource(await textPages(),destination.source):cached;locations.current.set(key,found);if(!alive)return;
      if(found){setMatch(found);goTo(found.page);setStatus(`${destination.source.label} · page ${found.page}`);}else setStatus("Could not locate this passage confidently in this PDF. Open the original section below.");
    })().catch(()=>{if(alive)setStatus("The paper text could not be indexed. Open the original section below.");});return()=>{alive=false;};
    // Match against this exact fetched PDF, never a previous document's locations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[destination,document,digest]);
  useEffect(()=>{
    setSearchMatches([]);setSearchIndex(0);setSearchStatus("");
    if(!findOpen||!search.trim())return;
    if(!document){setSearchStatus("Search is available when the PDF loads.");return;}
    let alive=true;setSearchStatus("Searching…");
    const timer=setTimeout(()=>{
      void textPages().then(all=>{
        if(!alive)return;
        const matches=findPdfTextMatches(all.map(({page,searchText})=>({page,text:searchText})),search,{matchCase,wholeWords});
        setSearchMatches(matches);setSearchIndex(0);setSearchStatus(matches.length?"":"No results");
        if(matches.length)goTo(matches[0].page);
      }).catch(()=>{if(alive)setSearchStatus("Search is unavailable for this PDF.");});
    },150);
    return()=>{alive=false;clearTimeout(timer);};
    // Indexed text is cached for the current document; options do not refetch it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[document,findOpen,search,matchCase,wholeWords]);
  function stepSearch(direction:number){
    if(!searchMatches.length)return;
    const next=(searchIndex+direction+searchMatches.length)%searchMatches.length;
    setSearchIndex(next);goTo(searchMatches[next].page);
  }
  return <section ref={viewer} className="paper-pdf" aria-label={`Original paper: ${title}`}>
    <div className="pdf-toolbar">{viewControls}<div className="pdf-reading-controls"><div className="pdf-controls">
      <div className="pdf-control-group pdf-page-navigation">
        <button className="icon-button" aria-label="Previous page" title="Previous page" disabled={!document||page<=1} onClick={()=>goTo(page-1)}><ChevronLeft size={17}/></button>
        <div className="pdf-page-counter"><input aria-label="Page number" type="number" style={{width:`calc(${String(page).length}ch + 2px)`}} min={1} max={document?.numPages||1} value={page} onChange={event=>{const next=Number(event.target.value);if(next>0)goTo(next);}}/><span>/ {document?.numPages||"—"}</span></div>
        <button className="icon-button" aria-label="Next page" title="Next page" disabled={!document||page===document.numPages} onClick={()=>goTo(page+1)}><ChevronRight size={17}/></button>
      </div>
      <div className="pdf-control-group pdf-zoom-controls">
        <button className="icon-button" aria-label="Zoom out" title="Zoom out" disabled={scale<=.35} onClick={()=>{setFitWidth(false);setScale(value=>Math.max(.35,value-.15));}}><Minus size={17}/></button>
        <button className="text-button" aria-label="Fit paper width" title="Fit paper width" onClick={()=>setFitWidth(true)}>{Math.round(scale*100)}%</button>
        <button className="icon-button" aria-label="Zoom in" title="Zoom in" disabled={scale>=2.5} onClick={()=>{setFitWidth(false);setScale(value=>Math.min(2.5,value+.15));}}><Plus size={17}/></button>
      </div>
      <div className="pdf-control-group pdf-source-actions">
        {download&&<a href={download} download={`${arxivId.replaceAll("/","-")}.pdf`} aria-label="Download paper" title="Download paper"><Download size={17}/></a>}
        <a href={`https://arxiv.org/abs/${arxivId}`} target="_blank" rel="noreferrer" aria-label="Open original paper" title="Open original paper"><ExternalLink size={17}/></a>
      </div>
    </div></div>{toolbarActions&&<div className="pdf-toolbar-actions">{toolbarActions}</div>}</div>
    {findOpen&&<div className="pdf-find-panel" role="search" aria-label="Find in document">
      <form onSubmit={event=>{event.preventDefault();stepSearch(1);}}>
        <input ref={findInput} type="search" aria-label="Find in document" placeholder="Find in document…" value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&event.shiftKey){event.preventDefault();stepSearch(-1);}}}/>
        <span className="pdf-find-count" aria-live="polite">{searchMatches.length?`${searchIndex+1} / ${searchMatches.length}`:""}</span>
        <button type="button" className="icon-button" aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!searchMatches.length} onClick={()=>stepSearch(-1)}><ChevronUp size={18}/></button>
        <button type="submit" className="icon-button" aria-label="Next match" title="Next match (Enter)" disabled={!searchMatches.length}><ChevronDown size={18}/></button>
        <button type="button" className="icon-button pdf-find-close" aria-label="Close find" title="Close (Escape)" onClick={closeFind}><X size={18}/></button>
      </form>
      <div className="pdf-find-options">
        <label><input type="checkbox" checked={highlightAll} onChange={event=>setHighlightAll(event.target.checked)}/>Highlight all</label>
        <label><input type="checkbox" checked={matchCase} onChange={event=>setMatchCase(event.target.checked)}/>Match case</label>
        <label><input type="checkbox" checked={wholeWords} onChange={event=>setWholeWords(event.target.checked)}/>Whole words</label>
      </div>
      {searchStatus&&<p className="pdf-find-status" role="status">{searchStatus}</p>}
    </div>}
    {(status||error)&&<p className="pdf-status" role="status">{error||status}</p>}
    {error&&<button className="button small pdf-retry" onClick={()=>setAttempt(value=>value+1)}>Retry PDF</button>}
    {destination&&!match&&/^https:\/\/arxiv\.org\//.test(destination.source.url)&&<a className="text-button" href={destination.source.url} target="_blank" rel="noreferrer">Open original section<ExternalLink size={13}/></a>}
    <div className="pdf-pages" ref={pane}>{document&&Array.from({length:document.numPages},(_,index)=><PdfPage key={index} document={document} page={index+1} scale={scale} match={match} searchMatches={findOpen?searchMatches:emptySearchMatches} activeSearch={activeSearch} highlightAll={highlightAll} onVisible={setPage}/>)}</div>
  </section>;
}
