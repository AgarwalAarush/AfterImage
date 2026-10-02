import React from "react";
import { rollingCausalWindow } from "@/lib/subject-experiments";
import { stableSubjectSvg } from "./subject-svg-presentation";

const ink="var(--ink)",muted="var(--muted)",accent="var(--accent)",line="var(--line)",paper="var(--paper)";
export function RollingWindowDrawing({width,query}:{width:number;query:number}){
  const state=rollingCausalWindow(query),tokenStep=(width-36)/12,slotStep=(width-36)/4;
  return stableSubjectSvg(<>
    <text x="18" y="18" fontSize="12" fill={muted}>Read previous keys and the current state</text>
    {Array.from({length:12},(_,position)=>{
      const current=position===state.query,previous=state.previous.includes(position),future=position>state.query,x=18+position*tokenStep;
      return <g key={position} data-position={position} data-eligible={current||previous} data-role={current?"current":previous?"previous":future?"future":"expired"}>
        <rect x={x} y="32" width={tokenStep-3} height="27" rx="3" fill={current||previous?accent:paper} fillOpacity={current?.9:previous?.2:1} stroke={current?accent:line} strokeDasharray={future?"2 2":undefined}/>
        <text x={x+(tokenStep-3)/2} y="49" textAnchor="middle" fontSize="10" fill={current?paper:previous?ink:muted} opacity={future?.5:1}>{position}</text>
      </g>;
    })}
    <text x="18" y="79" fontSize="12" fill={muted}>Query {state.query} · eligible {state.eligible[0]}…{state.query} · W = 4 previous keys</text>
    {[{label:"Cache before the read",slots:state.before,y:111},{label:"Cache after the write",slots:state.after,y:185}].map((row,rowIndex)=><g key={row.label}>
      <text x="18" y={row.y-12} fontSize="12" fill={ink}>{row.label}</text>
      {row.slots.map((position,slot)=>{const x=18+slot*slotStep,writing=slot===state.writeSlot;return <g key={slot} data-cache-phase={rowIndex===0?"before":"after"} data-slot={slot} data-token={position??"empty"}>
        <rect x={x} y={row.y} width={slotStep-8} height="39" rx="4" fill={writing&&rowIndex===1?accent:paper} fillOpacity={writing&&rowIndex===1?.12:1} stroke={writing?accent:line} strokeDasharray={writing&&rowIndex===0?"3 3":undefined}/>
        <text x={x+(slotStep-8)/2} y={row.y+15} textAnchor="middle" fontSize="10" fill={muted}>slot {slot}</text>
        <text x={x+(slotStep-8)/2} y={row.y+31} textAnchor="middle" fontSize="12" fill={ink}>{position===null?"—":`t${position}`}</text>
      </g>;})}
    </g>)}
    <text x="18" y="250" fontSize="12" fill={ink}>Write t{state.query} → slot {state.writeSlot}{state.evicted===null?" · empty slot":` · replaces t${state.evicted} after reading`}</text>
  </>);
}
export function RollingWindowTable({query}:{query:number}){
  const state=rollingCausalWindow(query);
  return <details className="subject-numeric-table"><summary>Inspect window and cache identities</summary><table><thead><tr><th>Slot</th><th>Before read</th><th>After write</th><th>Action</th></tr></thead><tbody>{state.before.map((position,slot)=><tr key={slot}><td>{slot}</td><td>{position===null?"Empty":`t${position}`}</td><td>{state.after[slot]===null?"Empty":`t${state.after[slot]}`}</td><td>{slot===state.writeSlot?`Write t${state.query}`:"Retain"}</td></tr>)}</tbody></table><p>Previous cached positions: {state.previous.length?state.previous.join(", "):"none"}. Current local position: {state.query}. Eligible keys: {state.eligible.join(", ")}.</p></details>;
}
