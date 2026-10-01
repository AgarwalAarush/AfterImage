import type { IllustrationPanel } from "./scene-illustration";
import type { Scene, SceneNode } from "./types";
import { diagramText } from "./scene";
import { routePlacedEdges, wrapDiagramText } from "./scene-layout";

/** Region membership is residency; matrix area and anchored arrows encode shape and traffic. */
export function memorySvg(panel: Extract<IllustrationPanel,{kind:"memory"}>, width:number, marker:string, prefix:string){
  const text=(x:number,y:number,value:string,size=14,anchor="start",fill="#34332f")=>`<text x="${x}" y="${y}" font-family="IBM Plex Mono, monospace" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${diagramText(value)}</text>`;
  const canvas=Math.ceil(width/10)*10,mobile=width<400,cols=mobile?1:width>=650?4:2,nodeW=mobile?200:width>=650?180:160,step=width>=650?Math.floor((canvas-60)/4/10)*10:220,cell=20;
  const nodes:(SceneNode & {anchor?:{x:number;y:number;w:number;h:number}})[]=[],frames:string[]=[],drawings:string[]=[];
  let y=80;
  for(const [ri,region] of panel.regions.entries()){
    const tone=ri===0?"#638eae":"#7761bb",start=y;let rowY=y+80;
    const header:SceneNode={id:`header-${ri}`,label:region.label,detail:"",kind:"box",emphasis:false,x:20,y:start+10,w:Math.min(240,Math.ceil(region.label.length*10/10)*10),h:40};nodes.push(header);
    frames.push(text(20,start+36,region.label,16,"start",tone));
    for(let r=0;r<Math.ceil(region.objects.length/cols);r++){
      const objects=region.objects.slice(r*cols,(r+1)*cols),rowNodes:typeof nodes=[];
      objects.forEach((object,c)=>{
        const x=(mobile?60:30)+c*step,cx=x+nodeW/2,labels=wrapDiagramText(object.label,Math.floor(nodeW/8.4)),shapes=wrapDiagramText(object.shape,Math.floor(nodeW/7.8)),gw=object.columns*cell,gh=object.rows*cell;
        const gy=rowY+labels.length*20+20,gx=cx-gw/2,h=Math.ceil((labels.length*20+20+gh+shapes.length*20+55)/10)*10;
        const node={id:object.id,label:object.label,detail:"",kind:"matrix" as const,emphasis:false,x,y:rowY-20,w:nodeW,h,anchor:{x:gx,y:gy,w:gw,h:gh}};rowNodes.push(node);
        let drawing=labels.map((line,i)=>text(cx,rowY+i*20,line,14,"middle")).join("");
        for(let row=0;row<object.rows;row++)for(let column=0;column<object.columns;column++)drawing+=`<rect data-memory-cell="${object.id}:${row},${column}" x="${gx+column*cell}" y="${gy+row*cell}" width="18" height="18" fill="${object.residency==="absent"?"white":tone+"22"}" stroke="${object.residency==="absent"?"#c9c6ce":tone+"80"}" ${object.residency==="absent"?'stroke-dasharray="2 2"':''}/>`;
        if(object.residency==="absent")drawing+=`<path d="M${gx-2} ${gy-2} L${gx+gw} ${gy+gh} M${gx+gw} ${gy-2} L${gx-2} ${gy+gh}" stroke="#a36e4c" stroke-width="1.8"/>`;
        shapes.forEach((line,i)=>drawing+=text(cx,gy+gh+22+i*20,line,13,"middle"));
        drawing+=text(cx,gy+gh+23+shapes.length*20,object.residency==="absent"?"NOT STORED":object.residency==="transient"?"TRANSIENT":"STORED",12,"middle",tone);
        drawings.push(`<g data-concept="${prefix}-${object.id}" data-node-bounds="${x},${node.y},${nodeW},${h}">${drawing}</g>`);
      });nodes.push(...rowNodes);rowY+=Math.max(...rowNodes.map(node=>node.h))+40;
    }
    y=rowY+20;frames.push(`<rect x="1" y="${start}" width="${width-2}" height="${y-start}" rx="8" fill="${tone}06" stroke="${tone}90"/>`);y+=80;
  }
  const scene:Scene={title:panel.title,description:panel.caption,footnote:"",nodes,edges:panel.transfers.map((transfer,index)=>({...transfer,label:String(index+1),dashed:false}))};
  const edges=routePlacedEdges(scene,nodes,canvas,y,"memory");let arrows="",badges="";
  const badgeBoxes:{x:number;y:number;w:number;h:number}[]=[];
  const intersects=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
  const badgeFree=(box:{x:number;y:number;w:number;h:number})=>!nodes.some(node=>intersects(box,node))&&!badgeBoxes.some(other=>intersects(box,other))&&!edges.some(edge=>edge.points.slice(1).some((b,i)=>{
    const a=edge.points[i];return intersects(box,{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x)||1,h:Math.abs(b.y-a.y)||1});
  }));
  edges.forEach((edge,index)=>{
    const d=edge.points.map((p,i)=>`${i?"L":"M"}${p.x} ${p.y}`).join(" ");
    arrows+=`<path d="${d}" stroke="white" stroke-width="5" fill="none"/><path data-connector="true" data-from="${prefix}-${edge.from}" data-to="${prefix}-${edge.to}" d="${d}" stroke="#7761bb" stroke-width="1.6" marker-end="url(#${marker})" fill="none"/>`;
    // Transfer numbers sit immediately above the source endpoint, away from the path.
    const point=edge.points[0],node=nodes.find(node=>node.id===edge.from)!;
    const left=point.x<node.x+node.w/2;
    let placed:{x:number;y:number;w:number;h:number}|undefined;
    for(const dx of [left?node.x-12:node.x+node.w+12,left?-10:canvas+4]){
      for(const dy of [-15,15,-25,25,-35,35,-55,55]){
        const labelW=String(index+1).length*8+4,box={x:dx-labelW/2,y:point.y+dy-12,w:labelW,h:15};if(badgeFree(box)){placed=box;break;}
      }if(placed)break;
    }
    if(!placed)throw new Error("Memory transfer has no clear annotation position.");
    badgeBoxes.push(placed);badges+=text(placed.x+placed.w/2,placed.y+12,String(index+1),12,"middle","#7761bb");
  });
  let svg=frames.join("")+arrows+drawings.join("")+badges;y+=10;
  for(const [i,transfer] of panel.transfers.entries()){
    const from=nodes.find(node=>node.id===transfer.from)!,to=nodes.find(node=>node.id===transfer.to)!;
    for(const line of wrapDiagramText(`${i+1}. ${from.label} → ${to.label}: ${transfer.label}`,Math.floor(width/8.4))){svg+=text(4,y,line,14);y+=20;}y+=10;
  }
  for(const line of wrapDiagramText(panel.repeat,Math.floor(width/8.4))){svg+=text(4,y,line,14);y+=20;}
  if(panel.coverage){
    const coverage=panel.coverage,left=70,cw=(width-left)/coverage.right.length;
    y+=28;svg+=text(4,y,"Tile visits · not a stored matrix",14);y+=25;
    for(const line of wrapDiagramText(`${coverage.leftLabel} × ${coverage.rightLabel}`,Math.floor(width/8.4))){svg+=text(4,y,line,13);y+=20;}
    coverage.right.forEach((label,c)=>svg+=text(left+(c+.5)*cw,y+12,label,13,"middle"));y+=30;
    coverage.left.forEach((label,r)=>{svg+=text(4,y+r*45+26,label,13);coverage.right.forEach((_,c)=>{
      const visit=coverage.order==="left-major"?r*coverage.right.length+c+1:c*coverage.left.length+r+1;
      svg+=`<rect data-tile-visit="${r},${c}" x="${left+c*cw+2}" y="${y+r*45}" width="${cw-4}" height="40" rx="4" fill="#7761bb15" stroke="#7761bb60"/>`+text(left+(c+.5)*cw,y+r*45+26,String(visit),14,"middle");
    });});y+=coverage.left.length*45+24;svg+=text(4,y,"Numbers = visit order; every pair is computed.",12);y+=20;
  }
  return {svg,height:y+10};
}
