import React from "react";
import { smoothQuantInput, smoothQuantScaling, smoothQuantWeights } from "@/lib/subject-experiments";
import { stableSubjectSvg } from "./subject-svg-presentation";

const ink="var(--ink)",muted="var(--muted)",line="var(--line)",accent="var(--accent)";
export function PairedScalingDrawing({width,alpha}:{width:number;alpha:number}){
  const state=smoothQuantScaling(alpha),panelWidth=(width-54)/2;
  const panels=[{label:"Activation maxima",original:state.originalActivationMaxima,current:state.activationMaxima},{label:"Weight maxima",original:state.originalWeightMaxima,current:state.weightMaxima}];
  return stableSubjectSvg(<>
    {panels.map((panel,panelIndex)=>{
      const left=18+panelIndex*(panelWidth+18),plotLeft=left+21,plotRight=left+panelWidth-5,step=(plotRight-plotLeft)/3,barWidth=Math.min(30,step*.52),y=(value:number)=>153-value/8*105;
      return <g key={panel.label}>
        <text x={left+panelWidth/2} y="22" textAnchor="middle" fontSize="12" fill={ink}>{panel.label}</text>
        {[0,4,8].map(tick=><g key={tick}><line x1={plotLeft} x2={plotRight} y1={y(tick)} y2={y(tick)} stroke={line} strokeDasharray="3 4"/><text x={plotLeft-7} y={y(tick)+4} textAnchor="end" fontSize="11" fill={muted}>{tick}</text></g>)}
        {panel.current.map((value,i)=>{const x=plotLeft+step*(i+.5);return <g key={i} data-channel={`${panelIndex===0?"x":"w"}-${i}`}>
          <rect x={x-barWidth/2-3} y={y(panel.original[i])} width={barWidth+6} height={153-y(panel.original[i])} rx="2" fill={muted} opacity=".18"/>
          <rect x={x-barWidth/2} y={y(value)} width={barWidth} height={153-y(value)} rx="2" fill={accent} opacity=".85"/>
          <text x={x} y={y(value)-8} textAnchor="middle" fontSize="11" fill={ink}>{value.toFixed(2)}</text>
          <text x={x} y="171" textAnchor="middle" fontSize="11" fill={muted}>C{i+1}</text>
        </g>;})}
      </g>;
    })}
    <rect x={width/2-104} y="189" width="9" height="9" fill={muted} opacity=".18"/><text x={width/2-88} y="198" fontSize="11" fill={muted}>Original</text>
    <rect x={width/2+10} y="189" width="9" height="9" fill={accent} opacity=".85"/><text x={width/2+26} y="198" fontSize="11" fill={muted}>Paired scaling</text>
    <text x={width/2} y="225" textAnchor="middle" fontSize="12" fill={muted}>s = [{state.scales.map(scale=>scale.toFixed(3)).join(", ")}]</text>
    <text x={width/2} y="252" textAnchor="middle" fontSize="13" fill={ink}>XW = X′W′ · before quantization</text>
  </>);
}
export function PairedScalingTable({alpha}:{alpha:number}){
  const state=smoothQuantScaling(alpha);
  const values=(row:readonly number[])=>row.map(value=>Number(value.toFixed(5))).join(", ");
  return <details className="subject-numeric-table"><summary>Inspect both sides of the scaling</summary><table><thead><tr><th>Channel</th><th>Original X column</th><th>Original W row</th><th>Scale s</th><th>X′ column</th><th>W′ row</th></tr></thead><tbody>
    {state.scales.map((scale,i)=><tr key={i}><td>C{i+1}</td><td>{values(smoothQuantInput.map(row=>row[i]))}</td><td>{values(smoothQuantWeights[i])}</td><td>{scale.toFixed(5)}</td><td>{values(state.activations.map(row=>row[i]))}</td><td>{values(state.weights[i])}</td></tr>)}
  </tbody></table><table><thead><tr><th>Token</th><th>Original XW</th><th>Scaled X′W′</th></tr></thead><tbody>{state.output.map((row,i)=><tr key={i}><td>T{i+1}</td><td>{values(row)}</td><td>{values(state.scaledOutput[i])}</td></tr>)}</tbody></table></details>;
}
