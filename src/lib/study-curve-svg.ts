import type { StudyFigure } from "./study";
import { diagramText } from "./scene";

const text=(x:number,y:number,value:string,anchor="start")=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono" font-size="14" fill="#555a54">${diagramText(value)}</text>`;
const number=(value:number)=>Number(value.toPrecision(4)).toString();
function wrap(value:string,max:number){
  const words=value.split(/\s+/).flatMap(word=>word.length>max?Array.from({length:Math.ceil(word.length/max)},(_,i)=>word.slice(i*max,(i+1)*max)):[word]);
  const result:string[]=[];
  for(const word of words){if(!result.length||result[result.length-1].length+word.length+1>max)result.push(word);else result[result.length-1]+=" "+word;}
  return result;
}

/** Preserve exact series/points; axes and stacked legends own their text-sized space. */
export function readableCurveSvg(figure:Extract<StudyFigure,{kind:"curve"}>,mobile:boolean){
  const width=mobile?350:760,palette=["#8c79b2","#728d7e","#b38652"],points=figure.series.flatMap(series=>series.points);
  const xmin=Math.min(...points.map(p=>p.x)),xmax=Math.max(...points.map(p=>p.x)),ymin=Math.min(...points.map(p=>p.y)),ymax=Math.max(...points.map(p=>p.y));
  const left=Math.max(60,Math.max(number(ymin).length,number(ymax).length)*8.4+16),right=width-24;
  const ylabel=wrap(figure.yLabel,Math.floor((width-32)/8.4)),xlabel=wrap(figure.xLabel,Math.floor((width-32)/8.4));
  const top=20+ylabel.length*20,bottom=top+(mobile?210:260),flat=ymax===ymin;
  const map=(point:{x:number;y:number})=>({x:left+(point.x-xmin)/(xmax-xmin)*(right-left),y:flat?(top+bottom)/2:bottom-(point.y-ymin)/(ymax-ymin)*(bottom-top)});
  let body=ylabel.map((line,i)=>text(16,18+i*20,line)).join("");
  body+=`<path d="M${left} ${top} V${bottom} H${right}" stroke="#aaa8ac" fill="none"/>`;
  body+=flat?text(left-10,(top+bottom)/2+5,number(ymin),"end"):text(left-10,top+5,number(ymax),"end")+text(left-10,bottom+5,number(ymin),"end");
  body+=text(left,bottom+26,number(xmin))+text(right,bottom+26,number(xmax),"end");
  body+=xlabel.map((line,i)=>text(width/2,bottom+52+i*20,line,"middle")).join("");
  for(const [index,series] of figure.series.entries()){
    const mapped=series.points.map(map),tone=palette[index],d=mapped.map((p,i)=>`${i?"L":"M"}${p.x} ${p.y}`).join(" ");
    body+=`<path data-series="${index}" d="${d}" stroke="${tone}" stroke-width="2" fill="none"/>`;
    for(const [i,p] of mapped.entries())body+=`<circle data-point="${index}:${i}" data-x="${series.points[i].x}" data-y="${series.points[i].y}" cx="${p.x}" cy="${p.y}" r="3" fill="white" stroke="${tone}" stroke-width="1.5"/>`;
  }
  let y=bottom+52+xlabel.length*20+12;
  for(const [index,series] of figure.series.entries()){
    const label=wrap(series.label,Math.floor((width-64)/8.4));
    body+=`<g data-legend="${index}"><line x1="16" y1="${y-5}" x2="34" y2="${y-5}" stroke="${palette[index]}" stroke-width="2"/>`;
    body+=label.map((line,i)=>text(46,y+i*20,line)).join("")+"</g>";y+=label.length*20+14;
  }
  const id=`study-${figure.id}-${mobile?"mobile":"desktop"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y+10}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${diagramText(figure.title)}</title><desc id="${id}-desc">${diagramText(figure.caption)}</desc>${body}</svg>`;
}
