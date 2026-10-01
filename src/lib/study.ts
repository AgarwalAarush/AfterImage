import { z } from "zod";
import type { Source } from "./types";
import { illustrationSchema, validateIllustration, validateIllustrationSources } from "./scene-illustration";
import { diagramText } from "./scene";
import { illustrationSvg } from "./scene-illustration-svg";
const short=z.string().min(1).max(28);
const axis=z.string().min(1).max(36);
const point=z.object({x:z.number().finite().min(-1e9).max(1e9),y:z.number().finite().min(-1e9).max(1e9)});
const base={id:z.string().regex(/^[a-z0-9-]+$/).max(40),title:z.string().min(1).max(100),placement:z.enum(["mechanism","evidence"]),caption:z.string().min(50).max(900),sourceId:z.string(),provenance:z.enum(["reported","illustrative"])};
export const figureSchema=z.discriminatedUnion("kind",[
  z.object({...base,kind:z.literal("illustration"),illustration:illustrationSchema}),
  z.object({...base,kind:z.literal("bars"),unit:short,reference:z.object({value:z.number().finite().min(0).max(1e9),label:short}).nullish(),series:z.array(z.object({label:short,value:z.number().finite().min(0).max(1e9),note:z.string().max(100)})).min(2).max(6)}),
  z.object({...base,kind:z.literal("network"),layers:z.array(z.object({label:short,nodes:z.array(z.string().min(1).max(12)).min(1).max(4)})).min(2).max(4),states:z.array(z.object({label:short,explanation:z.string().min(20).max(450),edges:z.array(z.object({fromLayer:z.number().int().min(0).max(2),from:z.number().int().min(0).max(3),to:z.number().int().min(0).max(3),weight:z.number().finite().min(-1000).max(1000),active:z.boolean()})).min(1).max(12)})).min(1).max(3)}),
  z.object({...base,kind:z.literal("matrix"),rows:z.array(short).min(2).max(5),columns:z.array(short).min(2).max(5),unit:short,values:z.array(z.array(z.number().finite().min(-1e6).max(1e6)).min(2).max(5)).min(2).max(5)}),
  z.object({...base,kind:z.literal("heatmap"),rows:z.array(z.string().min(1).max(14)).min(2).max(8),columns:z.array(z.string().min(1).max(14)).min(2).max(8),unit:short,normalization:z.enum(["row-normalized","unnormalized"]),values:z.array(z.array(z.number().finite().min(0).max(1e6)).min(2).max(8)).min(2).max(8)}),
  z.object({...base,kind:z.literal("tree"),nodes:z.array(z.object({id:z.string().regex(/^[a-z0-9-]+$/).max(24),parentId:z.string().nullable(),token:z.string().min(1).max(12),score:z.number().finite().min(-1e6).max(1e6),status:z.enum(["accepted","candidate","rejected"])})).min(3).max(15),scoreUnit:short}),
  z.object({...base,kind:z.literal("timeline"),events:z.array(z.object({label:z.string().min(1).max(22),detail:z.string().min(1).max(72),phase:z.enum(["input","compute","decision","output"])})).min(3).max(7)}),
  z.object({...base,kind:z.literal("curve"),xLabel:axis,yLabel:axis,series:z.array(z.object({label:z.string().min(1).max(22),points:z.array(point).min(2).max(12)})).min(1).max(3)}),
  z.object({...base,kind:z.literal("landscape"),xLabel:axis,yLabel:axis,zLabel:axis,values:z.array(z.array(z.number().finite().min(-1e9).max(1e9)).min(3).max(7)).min(3).max(7),path:z.array(z.object({row:z.number().int().min(0).max(6),column:z.number().int().min(0).max(6),label:z.string().min(1).max(12)})).min(2).max(7)}),
]);
export const studySchema=z.object({
  figures:z.array(figureSchema).min(1).max(3),
  quiz:z.array(z.object({id:z.string().regex(/^[a-z0-9-]+$/),question:z.string().min(15).max(300),options:z.array(z.object({text:z.string().min(1).max(300),explanation:z.string().min(20).max(700)})).length(3),answer:z.number().int().min(0).max(2),sourceId:z.string()})).min(2).max(4),
});
export type StudyPack=z.infer<typeof studySchema>;
export type StudyFigure=z.infer<typeof figureSchema>;
function numericValues(f:StudyFigure):number[]{
  if(f.kind==="bars")return f.series.map(s=>s.value);
  if(f.kind==="matrix"||f.kind==="heatmap"||f.kind==="landscape")return f.values.flat();
  if(f.kind==="network")return f.states.flatMap(s=>s.edges.map(e=>e.weight));
  if(f.kind==="tree")return f.nodes.map(n=>n.score);
  if(f.kind==="curve")return f.series.flatMap(s=>s.points.flatMap(p=>[p.x,p.y]));
  return [];
}
export function validateStudy(pack:StudyPack,sources:Source[]){
  studySchema.parse(pack);const ids=new Set(sources.map(s=>s.id));const figureIds=new Set<string>();
  for(const f of pack.figures){
    if(!ids.has(f.sourceId))throw new Error("Figure cites an unknown source");
    if(f.kind==="illustration"){
      validateIllustration(f.illustration);validateIllustrationSources(f.illustration,sources);
      if(f.provenance==="reported"&&f.illustration.panels.some(panel=>panel.illustrative))throw new Error("Reported study illustration contains illustrative panels");
    }
    if(figureIds.has(f.id))throw new Error("Duplicate figure identifier");figureIds.add(f.id);
    if((f.kind==="matrix"||f.kind==="heatmap")&&(f.values.length!==f.rows.length||f.values.some(r=>r.length!==f.columns.length)))throw new Error("Matrix dimensions disagree");
    if(f.kind==="heatmap"&&f.normalization==="row-normalized"&&f.values.some(row=>Math.abs(row.reduce((a,b)=>a+b,0)-1)>.015))throw new Error("A row-normalized heatmap row does not sum to one");
    if(f.kind==="network")for(const state of f.states){const seen=new Set<string>();for(const e of state.edges){
      const key=`${e.fromLayer}:${e.from}:${e.to}`;
      if(seen.has(key)||!f.layers[e.fromLayer]?.nodes[e.from]||!f.layers[e.fromLayer+1]?.nodes[e.to])throw new Error("Invalid network edge");seen.add(key);
    }}
    if(f.kind==="bars"&&f.series.every(s=>s.value===0))throw new Error("Empty quantitative comparison");
    if(f.kind==="tree"){
      const nodeIds=new Set(f.nodes.map(n=>n.id)),roots=f.nodes.filter(n=>n.parentId===null);
      if(nodeIds.size!==f.nodes.length||roots.length!==1)throw new Error("Token tree needs unique nodes and one root");
      for(const n of f.nodes){if(n.parentId!==null&&!nodeIds.has(n.parentId))throw new Error("Token tree parent is missing");let p=n,depth=0,seen=new Set([n.id]);while(p.parentId!==null){if(seen.has(p.parentId)||++depth>4)throw new Error("Token tree has a cycle or exceeds four levels");seen.add(p.parentId);p=f.nodes.find(x=>x.id===p.parentId)!;}}
      if(f.nodes.some(n=>f.nodes.filter(x=>x.parentId===n.id).length>4))throw new Error("Token tree exceeds four children per node");
    }
    if(f.kind==="curve")for(const s of f.series)for(let i=1;i<s.points.length;i++)if(s.points[i].x<=s.points[i-1].x)throw new Error("Curve x values must increase strictly");
    if(f.kind==="landscape"){
      const columns=f.values[0]?.length;if(!columns||f.values.some(row=>row.length!==columns))throw new Error("Loss landscape grid dimensions disagree");
      if(f.path.some(p=>p.row>=f.values.length||p.column>=columns))throw new Error("Loss landscape path leaves the grid");
    }
    if(f.provenance==="reported"){
      const excerpt=sources.find(s=>s.id===f.sourceId)!.excerpt;
      const numbers=excerpt.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number)||[];
      if(numericValues(f).some(value=>!numbers.includes(value)))throw new Error("A reported figure value is absent from its cited source. Use an exact supporting excerpt, or label invented values as illustrative.");
    }
  }
  const quizIds=new Set<string>();
  for(const q of pack.quiz){if(!ids.has(q.sourceId))throw new Error("Quiz cites an unknown source");if(quizIds.has(q.id))throw new Error("Duplicate quiz identifier");quizIds.add(q.id);if(new Set(q.options.map(o=>o.text.trim().toLowerCase())).size!==3)throw new Error("Quiz choices must differ");}
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
const text=(x:number,y:number,value:string,size=13,anchor="start",fill="#555a54")=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono" font-size="${size}" fill="${fill}">${diagramText(value)}</text>`;
const num=(n:number)=>Number(n.toPrecision(4)).toString();
const color=(t:number)=>{const v=Math.max(0,Math.min(1,t)),a=[245,243,248],b=[119,96,170];return `rgb(${a.map((n,i)=>Math.round(n+(b[i]-n)*v)).join(",")})`;};
function lines(s:string,max:number){const words=s.split(/\s+/).flatMap(word=>word.length>max?Array.from({length:Math.ceil(word.length/max)},(_,i)=>word.slice(i*max,(i+1)*max)):[word]),out:string[]=[];for(const word of words){if(!out.length||out[out.length-1].length+word.length+1>max)out.push(word);else out[out.length-1]+=" "+word;}return out;}
function contourPaths(values:number[][],left:number,top:number,width:number,height:number){
  const rows=values.length,cols=values[0].length,flat=values.flat(),min=Math.min(...flat),max=Math.max(...flat),range=max-min||1,dx=width/(cols-1),dy=height/(rows-1);let out="";
  for(let band=1;band<5;band++){const level=min+range*band/5;
    for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){
      const corners=[{x:left+c*dx,y:top+r*dy,v:values[r][c]},{x:left+(c+1)*dx,y:top+r*dy,v:values[r][c+1]},{x:left+(c+1)*dx,y:top+(r+1)*dy,v:values[r+1][c+1]},{x:left+c*dx,y:top+(r+1)*dy,v:values[r+1][c]}],hits:{x:number;y:number}[]=[];
      for(const [a,b] of [[0,1],[1,2],[2,3],[3,0]] as const){const p=corners[a],q=corners[b];if((p.v<level&&q.v>=level)||(q.v<level&&p.v>=level)){const t=(level-p.v)/(q.v-p.v);hits.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}
      if(hits.length===2)out+=`<path d="M${hits[0].x} ${hits[0].y} L${hits[1].x} ${hits[1].y}" stroke="#ffffff" stroke-opacity=".74" stroke-width="1.1" fill="none"/>`;
      else if(hits.length===4)out+=`<path d="M${hits[0].x} ${hits[0].y} L${hits[1].x} ${hits[1].y} M${hits[2].x} ${hits[2].y} L${hits[3].x} ${hits[3].y}" stroke="#ffffff" stroke-opacity=".74" stroke-width="1.1" fill="none"/>`;
    }
  }
  return out;
}
export function barAxisMax(figure: Extract<StudyFigure, {kind: "bars"}>) {
  const largest = Math.max(...figure.series.map(s => s.value),figure.reference?.value||0);
  // Percentages have a known endpoint; other units keep their actual common
  // endpoint visible so a full-width bar cannot imply a different scale.
  return /%|percent/i.test(figure.unit) && largest <= 100 ? 100 : Math.max(largest, 1);
}
/** Deterministic charts/networks: models provide semantics and numbers, never arbitrary SVG or coordinates. */
export function studySvg(f:StudyFigure,mobile=false,state=0){
  if(f.kind==="illustration")return illustrationSvg({layout:"explanatory-v3",title:f.title,description:f.caption,footnote:"",nodes:[],edges:[],illustration:f.illustration},mobile,"#7761bb");
  const w=mobile?350:760;let h=300,body="";
  if(f.kind==="bars"){
    const top=36,row=mobile?90:68;h=top+f.series.length*row+32;const left=mobile?16:170,right=w-32,extent=right-left,max=barAxisMax(f);
    body+=text(left,18,`0 · ${f.unit}`,12)+text(right,18,num(max),12,"end");
    const reference=f.reference || (/speedup|ratio|×|\bx\b/i.test(f.unit)?{value:1,label:"1× parity (no speedup)"}:/%.*of|percent.*of/i.test(f.unit)?{value:100,label:"100% parity"}:null);
    if(reference)body+=text(left,top-2,`Tick = ${reference.label}`,12);
    f.series.forEach((s,i)=>{const y=top+i*row;const bw=extent*s.value/max;
      body+=text(mobile?left:20,y+15,s.label,13);
      const by=mobile?y+25:y+24;
      body+=`<rect x="${left}" y="${by}" width="${extent}" height="12" rx="3" fill="#eeedf0"/><rect x="${left}" y="${by}" width="${bw}" height="12" rx="3" fill="#8c79b2"/>`;
      if(reference&&reference.value<=max){const parity=left+extent*reference.value/max;body+=`<path d="M${parity} ${by-3} V${by+15}" stroke="#555a54" stroke-width="1.5"/>`;}
      body+=text(right,y+15,num(s.value),13,"end","#353832");
      lines(s.note,mobile?35:65).forEach((line,j)=>body+=text(left,by+30+j*16,line,12));
    });
  }else if(f.kind==="matrix"){
    const max=Math.max(...f.values.flat().map(Math.abs),1);
    if(mobile){
      // Recompose each row as a readable labelled list rather than squeezing a grid.
      body+=text(16,22,f.unit,13);let y=54;
      f.rows.forEach((label,r)=>{
        for(const line of lines(label,36)){body+=text(16,y,line,14,"start","#353832");y+=20;}
        f.columns.forEach((column,c)=>{
          const wrapped=lines(column,27),height=Math.max(36,wrapped.length*18+14),v=f.values[r][c];
          body+=`<rect x="16" y="${y}" width="318" height="${height}" rx="4" fill="${v<0?"#c28b59":"#8c79b2"}" fill-opacity="${.08+.35*Math.abs(v)/max}"/>`;
          wrapped.forEach((line,j)=>body+=text(26,y+22+j*18,line,13));body+=text(324,y+22,num(v),14,"end","#353832");y+=height+5;
        });y+=24;
      });h=y;
    }else{
      const left=160,top=85,cw=(w-left-16)/f.columns.length,ch=62;h=top+ch*f.rows.length+30;
      body+=text(left,18,f.unit,13);
      f.columns.forEach((c,i)=>lines(c,Math.floor(cw/8)).forEach((line,j)=>body+=text(left+(i+.5)*cw,42+j*16,line,13,"middle")));
      f.rows.forEach((r,i)=>{lines(r,17).forEach((line,j)=>body+=text(left-12,top+i*ch+ch/2+j*16,line,13,"end"));
        f.values[i].forEach((v,k)=>{body+=`<rect x="${left+k*cw+2}" y="${top+i*ch+2}" width="${cw-4}" height="${ch-4}" rx="4" fill="${v<0?"#c28b59":"#8c79b2"}" fill-opacity="${.08+.35*Math.abs(v)/max}"/>`;body+=text(left+(k+.5)*cw,top+i*ch+ch/2+5,num(v),15,"middle","#353832");});
      });
    }
  }else if(f.kind==="heatmap"){
    const observed=Math.max(...f.values.flat(),1e-9),max=/%|percent/i.test(f.unit)&&observed<=100?100:f.normalization==="row-normalized"?1:observed;
    const legend=(y:number)=>`<rect x="16" y="${y}" width="80" height="8" rx="3.5" fill="url(#heat-${f.id}-${mobile})"/><defs><linearGradient id="heat-${f.id}-${mobile}"><stop stop-color="#f5f3f8"/><stop offset="1" stop-color="#7760aa"/></linearGradient></defs>`+text(108,y+8,`0 → ${num(max)}`,13);
    if(mobile){
      let y=24;
      lines(`${f.unit} · ${f.normalization}`,38).forEach(line=>{body+=text(16,y,line,13);y+=20;});y+=20;
      f.rows.forEach((label,r)=>{
        body+=text(16,y,label,14,"start","#353832");y+=18;
        f.values[r].forEach((value,c)=>{
          const dark=value/max>.62,tone=dark?"#ffffff":"#353832";
          body+=`<rect x="16" y="${y}" width="${w-32}" height="34" rx="4" fill="${color(value/max)}"/>`+text(26,y+22,f.columns[c],13,"start",tone)+text(w-26,y+22,num(value),14,"end",tone);y+=40;
        });y+=24;
      });body+=legend(y);h=y+32;
    }else{
      const left=150,cw=(w-left-18)/f.columns.length,ch=58,limit=Math.max(3,Math.floor((cw-8)/7.8));
      const headers=f.columns.map(label=>lines(label,limit)),top=60+Math.max(...headers.map(label=>label.length))*19;
      body+=text(16,22,`${f.unit} · ${f.normalization}`,13);
      headers.forEach((labels,c)=>labels.forEach((label,i)=>body+=text(left+(c+.5)*cw,52+i*19,label,13,"middle")));
      f.rows.forEach((label,r)=>{
        body+=text(left-12,top+(r+.5)*ch+5,label,13,"end");
        f.values[r].forEach((value,c)=>{body+=`<rect x="${left+c*cw+1}" y="${top+r*ch+1}" width="${cw-2}" height="${ch-2}" rx="3" fill="${color(value/max)}"/>`+text(left+(c+.5)*cw,top+(r+.5)*ch+5,num(value),14,"middle",value/max>.62?"#ffffff":"#353832");});
      });const bottom=top+ch*f.rows.length+24;body+=legend(bottom);h=bottom+32;
    }
  }else if(f.kind==="tree"){
    const byId=new Map(f.nodes.map(n=>[n.id,n])),depth=new Map<string,number>();const level=(id:string):number=>{if(depth.has(id))return depth.get(id)!;const n=byId.get(id)!;const d=n.parentId===null?0:level(n.parentId)+1;depth.set(id,d);return d;};f.nodes.forEach(n=>level(n.id));
    const levels=Array.from({length:Math.max(...depth.values())+1},(_,d)=>f.nodes.filter(n=>depth.get(n.id)===d));h=mobile?levels.length*142+66:Math.max(320,Math.max(...levels.map(x=>x.length))*92+90);
    const pos=(n:(typeof f.nodes)[number])=>{const d=depth.get(n.id)!,same=levels[d],i=same.indexOf(n);return mobile?{x:36+(w-72)*(i+.5)/same.length,y:58+d*140}:{x:55+d*(w-110)/Math.max(1,levels.length-1),y:42+(h-82)*(i+.5)/same.length};};
    for(const n of f.nodes)if(n.parentId){const a=pos(byId.get(n.parentId)!),b=pos(n),tone=n.status==="accepted"?"#728d7e":n.status==="rejected"?"#b7b5b2":"#8c79b2";body+=`<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="${tone}" stroke-width="${n.status==="accepted"?2.4:1.2}" ${n.status==="rejected"?'stroke-dasharray="4 5"':''} fill="none"/>`;}
    for(const n of f.nodes){const p=pos(n),tone=n.status==="accepted"?"#728d7e":n.status==="rejected"?"#b7b5b2":"#8c79b2";body+=`<g data-concept="${esc(n.id)}"><circle cx="${p.x}" cy="${p.y}" r="18" fill="white" stroke="${tone}" stroke-width="${n.status==="accepted"?2.4:1.3}"/>${text(p.x,p.y+4,n.token,mobile?9:11,"middle","#353832")}${text(p.x,p.y+34,num(n.score),mobile?8:10,"middle")}</g>`;}
    body+=text(16,h-28,f.scoreUnit,9)+text(16,h-10,"GREEN accepted · PURPLE candidate · DASHED rejected",mobile?8:9);
  }else if(f.kind==="timeline"){
    const tones={input:"#62606b",compute:"#7761a1",decision:"#936326",output:"#4f7160"};
    let y=36;const positions:number[]=[];
    f.events.forEach(e=>{positions.push(y);y+=Math.max(96,lines(e.detail,mobile?32:78).length*19+55);});h=y+20;
    body+=`<defs><marker id="time-${f.id}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#77737e"/></marker></defs>`;
    for(let i=0;i<positions.length-1;i++)body+=`<path d="M30 ${positions[i]+10} V${positions[i+1]-12}" stroke="#aaa6b0" marker-end="url(#time-${f.id})" fill="none"/>`;
    f.events.forEach((e,i)=>{const cy=positions[i],tone=tones[e.phase];body+=`<circle cx="30" cy="${cy}" r="7" fill="white" stroke="${tone}" stroke-width="2"/>`+text(52,cy,e.label,14,"start","#353832")+text(w-18,cy,e.phase.toUpperCase(),12,"end",tone);lines(e.detail,mobile?32:78).forEach((line,j)=>body+=text(52,cy+25+j*19,line,13));});
  }else if(f.kind==="curve"){
    h=mobile?300:350;const left=mobile?50:70,right=w-24,top=38,bottom=h-54,points=f.series.flatMap(s=>s.points),xs=points.map(p=>p.x),ys=points.map(p=>p.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),xr=xmax-xmin||1,yr=ymax-ymin||1,map=(p:{x:number;y:number})=>({x:left+(p.x-xmin)/xr*(right-left),y:bottom-(p.y-ymin)/yr*(bottom-top)}),palette=["#8c79b2","#728d7e","#b38652"];
    body+=`<path d="M${left} ${top} V${bottom} H${right}" stroke="#aaa8ac" fill="none"/>`+text(left,bottom+32,`${num(xmin)}  ${f.xLabel}`,9)+text(right,bottom+32,num(xmax),9,"end")+text(left-9,top+4,num(ymax),9,"end")+text(left-9,bottom,num(ymin),9,"end")+text(left,18,f.yLabel,9);
    f.series.forEach((s,i)=>{const pts=s.points.map(map),d=pts.map((p,j)=>`${j?"L":"M"}${p.x} ${p.y}`).join(" "),tone=palette[i];body+=`<path d="${d}" stroke="${tone}" stroke-width="2" fill="none"/>`;pts.forEach(p=>body+=`<circle cx="${p.x}" cy="${p.y}" r="3" fill="white" stroke="${tone}" stroke-width="1.5"/>`);body+=`<line x1="${left+i*(mobile?98:150)}" y1="${h-12}" x2="${left+16+i*(mobile?98:150)}" y2="${h-12}" stroke="${tone}" stroke-width="2"/>`+text(left+22+i*(mobile?98:150),h-8,s.label,mobile?8:10);});
  }else if(f.kind==="landscape"){
    const rows=f.values.length,cols=f.values[0].length,left=mobile?44:100,top=42,size=Math.min(mobile?250:430,w-left-40),cw=size/cols,ch=size/rows,flat=f.values.flat(),min=Math.min(...flat),max=Math.max(...flat),range=max-min||1;h=top+size+54;
    f.values.forEach((row,r)=>row.forEach((value,c)=>body+=`<rect x="${left+c*cw}" y="${top+r*ch}" width="${cw+.5}" height="${ch+.5}" fill="${color(1-(value-min)/range)}"/>`));body+=contourPaths(f.values,left+cw/2,top+ch/2,size-cw,size-ch);
    const path=f.path.map(p=>({x:left+(p.column+.5)*cw,y:top+(p.row+.5)*ch}));body+=`<path d="${path.map((p,i)=>`${i?"L":"M"}${p.x} ${p.y}`).join(" ")}" stroke="#b38652" stroke-width="2.2" fill="none"/>`;path.forEach((p,i)=>{body+=`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="#b38652" stroke-width="2"/>`+text(p.x+8,p.y-8,f.path[i].label,mobile?8:10);});body+=text(left,20,f.zLabel,9)+text(left+size/2,h-12,f.xLabel,9,"middle")+`<text x="16" y="${top+size/2}" transform="rotate(-90 16 ${top+size/2})" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#555a54">${esc(f.yLabel)}</text>`;
  }else{
    const selected=f.states[state]||f.states[0];const graphHeight=mobile?f.layers.length*160+30:400;h=graphHeight+42+Math.ceil(selected.edges.length/(mobile?1:2))*26;
    body+=text(16,18,selected.label,12);
    body+=`<defs><marker id="arrow-${f.id}-${mobile}-${state}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1 1 L6 3.5 L1 6" fill="none" stroke="#8c79b2" stroke-width="1.2"/></marker></defs>`;
    const point=(l:number,n:number)=>mobile?{x:60+(w-120)*(n+.5)/f.layers[l].nodes.length,y:90+l*155}:{x:55+l*(w-110)/(f.layers.length-1),y:100+(260*(n+.5)/f.layers[l].nodes.length)};
    // Edges behind neurons; weights live in a separate ledger, so crossings never cover labels.
    for(const e of selected.edges){const a=point(e.fromLayer,e.from),b=point(e.fromLayer+1,e.to),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);a.x+=dx/len*19;a.y+=dy/len*19;b.x-=dx/len*23;b.y-=dy/len*23;body+=`<path marker-end="url(#arrow-${f.id}-${mobile}-${state})" d="M${a.x},${a.y} L${b.x},${b.y}" stroke="${e.active?(e.weight<0?"#b38652":"#8c79b2"):"#dcdce0"}" stroke-width="${e.active?2:1}" ${e.active?'': 'stroke-dasharray="4 5"'} fill="none"/>`;}
    f.layers.forEach((l,i)=>{body+=text(mobile?16:point(i,0).x,mobile?55+i*155:55,l.label,12,mobile?"start":"middle");l.nodes.forEach((n,k)=>{const p=point(i,k);body+=`<circle cx="${p.x}" cy="${p.y}" r="18" stroke="#8c79b2" stroke-width="1.5" fill="white"/>`;body+=`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#8c79b2"/>`;lines(n,mobile?8:12).forEach((line,j)=>body+=text(p.x,(mobile?p.y+39:p.y+35)+j*13,line,11,"middle"));});});
    body+=text(16,graphHeight+12,"CONNECTION WEIGHTS",10);
    selected.edges.forEach((e,i)=>{const x=mobile?16:16+(i%2)*370,y=graphHeight+38+Math.floor(i/(mobile?1:2))*26;body+=text(x,y,`${f.layers[e.fromLayer].nodes[e.from]} → ${f.layers[e.fromLayer+1].nodes[e.to]}: ${num(e.weight)}${e.active?"":" (off)"}`,mobile?10:11);});
  }
  const titleId=`study-${f.id}-${mobile?"mobile":"desktop"}-title`,descId=`study-${f.id}-${mobile?"mobile":"desktop"}-desc`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${titleId} ${descId}"><title id="${titleId}">${esc(f.title)}</title><desc id="${descId}">${esc(f.caption)}</desc><g data-concept="${esc(f.id)}">${body}</g></svg>`;
}
export const studyPrompt=`Create a visual study supplement to a research notecard, grounded in SOURCE DATA. Provide 1-3 complementary figures and 2-4 multiple-choice questions. Choose the representation for its teaching purpose:
- illustration: concrete object-based explanations using the SAME semantic panel vocabulary as the opening diagram, especially new views of allocation, routing, symbolic operands or a branching mechanism. Provide illustration.takeaway and 1-3 panels, each with title, caption, illustrative and sourceIds. allocation has arrangement:lanes or diagonal, unit and 2-4 groups {label,capacity:1-6,items:0-6 identities of <=4 characters}. matrix has axis labels, rows/columns, string values and explicit selected cells; schematic has data-bearing glyph nodes and directed labelled edges. A schematic is bounded to two objects per dependency layer; use allocation for parallel expert regions. Keep simplifications explicit and preserve identities across related panels. memory has two regions, each with 1-6 objects {id,label,shape,rows:1-6,columns:1-6,residency:stored|transient|absent}, up to twelve local/cross-region transfers {from,to,label}, and repeat. Optional coverage:{leftLabel,rightLabel,left,right,order:left-major|right-major} shows all Cartesian block-pair visits, not a stored matrix. It shows tiled memory traffic without full matrix materialization; symbolic grid dimensions are illustrative, not measured capacities. state-trace panels contain initial:{state,h,z,observation}, two branches {mode:replay|imagination,steps:1-2 [{state,h,z,action,observation}]}, with symbols <=5 characters. Each action is incoming from the previous state; replay observations are present, imagined observations are null. One shared start and source-supported recurrent/stochastic state components make the distinction visible. tree panels have 3-15 individual nodes {id,parentId,token:max4,status:accepted|candidate|rejected}, prefixLabel and verificationLabel (nullable), and optional targetToken for an appended target fallback shown separately from proposals. They preserve one shared prefix and one connected accepted path, with at most four children and four edges of depth. Prefer this semantic panel when probabilities are unnecessary, rather than inventing tree scores. Show a complementary detail rather than copying the opening.
- bars: a few comparable scalar measurements under the same conditions;
- matrix: signed tensor values, arithmetic, similarities, or assignments;
- heatmap: a spatial pattern such as attention, routing probability, or activation intensity (row-normalized rows must sum to 1 within 0.015);
- network: actual weighted neural or routing connections, optionally under controlled switchable states;
- tree: branching token candidates or search paths with one root, at most four levels, and accepted/candidate/rejected status;
- timeline: ordered system, training, or inference events when sequence is the central lesson;
- curve: latency, loss, scaling, or quality as a function of a strictly increasing x variable;
- landscape: a scalar field or loss surface represented by a 3-7 by 3-7 sampled grid and a discrete optimization path.
Do NOT manufacture benchmark values, choose a decorative network, or substitute a timeline for a causal mechanism. Each figure must teach a different precise idea and must not duplicate the opening diagram. It is fine to use one well-supported figure. Numeric worked examples must use provenance=illustrative and explicitly say the values are invented teaching values. Every reported numeric value in any figure must appear exactly in its cited source excerpt. Captions explain how to read the figure, units, what changes and stays fixed, conditions/baselines, and simplifications.
For networks, edges connect adjacent layers by zero-based indices; weights can be negative and inactive edges are dashed. Node labels are <=12 characters, unique within a layer, and values appear in a separate ledger. For trees, parentId creates the topology; scores must share scoreUnit and status expresses the branch outcome. For curves, keep every series under the same x/y definitions and order points by strictly increasing x. For landscapes, grid rows/columns carry the y/x parameters and the path uses zero-based row/column indices. Matrix labels <=12 characters. Matrix values must be rectangular: exactly one cell per column in every row. Never split a phrase into extra array cells to satisfy a short-string bound. Illustration matrices are for atomic quantities, masks or selections, not prose treatment/purpose tables; explain qualitative treatment maps in captions or the notecard. Prefer a sourced coefficient comparison or an explicitly illustrative two-hot percentage-weight example when that teaches the stabilization mechanism. Bar values are nonnegative and share a single unit and comparable condition; labels <=22 characters, notes <=55 characters; bars always start at zero and the renderer labels the common endpoint. Use reference:{value,label} for a meaningful parity/control threshold (1 for speedup, 100 for percent of baseline). The reference is labelled and drawn on every bar. For speedup evidence prefer percent runtime reduction (computed only from explicit runtimes) or a reported ratio with a clearly identified 1x parity reference; do not treat the entire ratio as the improvement. Percentage units use a fixed 0–100 scale.
Cite supplied sourceIds for every figure and quiz question. Quiz questions test mechanism, interpretation, or a common misconception. Give three plausible distinct options with exactly one correct answer; the explanation for EVERY option must explain why it is right or wrong using the source. Cover both computation and evidence limitations. No raw LaTeX in SVG labels. Inline $...$ math is permitted in quiz text and captions. Never invent evidence to fill the schema.`;

/** Shuffle once per question ID; keep the correct answer and every explanation together. */
export function arrangeQuiz(pack:StudyPack):StudyPack {
  return {...pack,quiz:pack.quiz.map(q=>{
    let seed=2166136261;for(const c of q.id){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619)>>>0;}
    const order=[0,1,2];for(let i=2;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    return {...q,options:order.map(i=>q.options[i]),answer:order.indexOf(q.answer)};
  })};
}
