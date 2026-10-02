import React from "react";
import { volumeBackground, volumeRendering, type RayRgb } from "@/lib/subject-experiments";
import { stableSubjectSvg } from "./subject-svg-presentation";

const ink="var(--ink)",muted="var(--muted)",line="var(--line)",paper="var(--paper)";
/** These swatches encode the declared RGB numbers; annotation colors follow local appearance. */
const rgb=(color:RayRgb)=>`rgb(${color.map(channel=>Math.round(channel*255)).join(" ")})`;

export function VolumeRenderingDrawing({width,density}:{width:number;density:number}){
  const ray=volumeRendering(density),left=72,right=width-38,stripLeft=18,stripWidth=width-36;
  let cursor=stripLeft;
  return stableSubjectSvg(<>
    <text x="18" y="18" fontSize="12" fill={muted}>Constructed ray · four intervals, Δ = 1</text>
    <rect x="18" y="33" width="24" height="22" rx="3" fill={paper} stroke={line}/><circle cx="30" cy="44" r="5" fill="none" stroke={muted}/>
    <path d={`M 42 44 H ${width-18} l -6 -4 m 6 4 l -6 4`} fill="none" stroke={muted}/>
    {ray.samples.map((sample,i)=>{const x=left+i*(right-left)/3;return <g key={sample.id} data-sample={sample.id}>
      <circle cx={x} cy="44" r="9" fill={rgb(sample.color)} stroke={ink} strokeWidth=".7"/>
      <text x={x} y="72" textAnchor="middle" fontSize="12" fill={ink}>{sample.id}</text>
      <text x={x} y="92" textAnchor="middle" fontSize="11" fill={muted}>σ {sample.sigma.toFixed(2)}</text>
      <text x={x} y="111" textAnchor="middle" fontSize="11" fill={muted}>α {sample.alpha.toFixed(3)}</text>
      <text x={x} y="130" textAnchor="middle" fontSize="11" fill={muted}>T {sample.transmittance.toFixed(3)}</text>
      <text x={x} y="149" textAnchor="middle" fontSize="11" fill={ink}>w {sample.weight.toFixed(3)}</text>
    </g>;})}
    <text x="18" y="175" fontSize="12" fill={muted}>Weights sum to 1 with the background</text>
    {ray.samples.map(sample=>{const x=cursor,w=sample.weight*stripWidth;cursor+=w;return <rect key={sample.id} data-contribution={sample.id} x={x} y="186" width={w} height="18" fill={rgb(sample.color)}/>;})}
    <rect data-contribution="background" x={cursor} y="186" width={ray.backgroundWeight*stripWidth} height="18" fill={rgb(volumeBackground)}/>
    <rect x={stripLeft} y="186" width={stripWidth} height="18" fill="none" stroke={line}/>
    <text x="18" y="225" fontSize="12" fill={muted}>Background weight {ray.backgroundWeight.toFixed(3)}</text>
    <rect data-final-pixel="true" x="18" y="241" width="25" height="25" rx="3" fill={rgb(ray.pixel)} stroke={line}/>
    <text x="54" y="258" fontSize="12" fill={ink}>RGB ({ray.pixel.map(channel=>channel.toFixed(3)).join(", ")})</text>
  </>);
}

export function VolumeRenderingTable({density}:{density:number}){
  const ray=volumeRendering(density);
  return <details className="subject-numeric-table"><summary>Inspect the ray accumulation</summary><table><thead><tr><th>Sample</th><th>σ</th><th>Δ</th><th>α</th><th>Prefix T</th><th>Weight</th><th>RGB</th></tr></thead><tbody>
    {ray.samples.map(sample=><tr key={sample.id}><td>{sample.id}</td><td>{sample.sigma.toFixed(5)}</td><td>{sample.delta}</td><td>{sample.alpha.toFixed(5)}</td><td>{sample.transmittance.toFixed(5)}</td><td>{sample.weight.toFixed(5)}</td><td>{sample.color.join(", ")}</td></tr>)}
    <tr><td>Background</td><td>—</td><td>—</td><td>—</td><td>{ray.backgroundWeight.toFixed(5)}</td><td>{ray.backgroundWeight.toFixed(5)}</td><td>{volumeBackground.join(", ")}</td></tr>
    <tr><td>Final pixel</td><td colSpan={5}>Σ wᵢ cᵢ + T₅ c_background</td><td>{ray.pixel.map(channel=>channel.toFixed(5)).join(", ")}</td></tr>
  </tbody></table></details>;
}
