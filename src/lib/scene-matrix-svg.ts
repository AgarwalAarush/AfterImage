import type {IllustrationPanel} from './scene-illustration';
import {diagramText} from './scene';
import {wrapDiagramText} from './scene-layout';
type Matrix=Extract<IllustrationPanel,{kind:'matrix'}>;
const text=(x:number,y:number,value:string,fill='#34332f',anchor='start')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="16" fill="${fill}">${diagramText(value)}</text>`;
const lines=(x:number,y:number,value:string,limit:number,fill='#34332f')=>{const wrapped=wrapDiagramText(value,limit);return {svg:wrapped.map((v,i)=>text(x,y+i*22,v,fill)).join(''),height:wrapped.length*22};};
/** New matrices retain publication-scale text. Narrow views label every row/column pair. */
export function readableMatrixSvg(panel:Matrix,width:number,accent:string,mobile:boolean){
 let svg='',y=22;const limit=Math.max(2,Math.floor((width-12)/9.6));
 if(panel.selectionRule){svg+=text(0,y,`Top-${panel.selectionRule.k} per ${panel.selectionRule.axis}`,accent);y+=30;}
 const axis=lines(0,y,panel.columnLabel,limit,'#62675f');svg+=axis.svg;y+=axis.height+12;
 const chosen=(r:number,c:number)=>panel.selected.some(cell=>cell.row===r&&cell.column===c);
 if(mobile){
  for(const [r,row] of panel.rows.entries()){
   const label=lines(0,y,`${panel.rowLabel}: ${row}`,limit);svg+=label.svg;y+=label.height+12;
   for(const [c,column] of panel.columns.entries()){
    const selected=chosen(r,c),height=52;
    svg+=`<rect data-cell="${r},${c}" data-selected="${selected}" x="0" y="${y}" width="${width}" height="${height}" rx="4" fill="${selected?accent+'20':'#f7f7f5'}" stroke="${selected?accent:'#e0dfdb'}"/>`;
    svg+=text(12,y+31,column)+text(width-12,y+31,panel.values[r][c],'#34332f','end');
    y+=height+8;
   }
   y+=20;
  }
 }else{
  const labelW=132,cellW=(width-labelW)/panel.columns.length;
  const columnLimit=Math.max(2,Math.floor((cellW-16)/9.6)),rowLimit=Math.floor((labelW-12)/9.6);
  const rowAxis=lines(0,y,panel.rowLabel,rowLimit,'#62675f');svg+=rowAxis.svg;
  let headerHeight=rowAxis.height;
  for(const [c,column] of panel.columns.entries()){const label=lines(labelW+c*cellW+8,y,column,columnLimit);svg+=label.svg;headerHeight=Math.max(headerHeight,label.height);}
  y+=headerHeight+16;
  for(const [r,row] of panel.rows.entries()){
   const label=lines(0,y+27,row,rowLimit);const height=Math.max(54,label.height+24);svg+=label.svg;
   for(const [c,value] of panel.values[r].entries()){
    const selected=chosen(r,c),x=labelW+c*cellW;
    svg+=`<rect data-cell="${r},${c}" data-selected="${selected}" x="${x}" y="${y}" width="${cellW-4}" height="${height-4}" rx="4" fill="${selected?accent+'20':'#f7f7f5'}" stroke="${selected?accent:'#e0dfdb'}"/>`;
    svg+=text(x+(cellW-4)/2,y+27,value,'#34332f','middle');
   }
   y+=height;
  }
 }
 if(panel.selected.length){svg+=`<rect x="0" y="${y+4}" width="12" height="12" rx="2" fill="${accent}20" stroke="${accent}"/>`+text(20,y+16,'Selected cells','#62675f');y+=38;}
 return {svg,height:y+4};
}
