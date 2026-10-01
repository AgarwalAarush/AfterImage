import type { StateTrace } from "./scene-state-trace";
import { diagramText, escapeXml } from "./scene";
import { wrapDiagramText } from "./scene-layout";

/** Unroll the same learned dynamics from one posterior, with explicit observation/action roles. */
export function stateTraceSvg(trace:StateTrace,width:number,marker:string,prefix:string){
  const mobile=width<600,ink="#34332f",purple="#7761bb",blue="#416f91";
  const text=(x:number,y:number,value:string,anchor="start",tone=ink)=>`<text x="${x}" y="${y}" font-family="IBM Plex Mono" font-size="14" text-anchor="${anchor}" fill="${tone}">${diagramText(value)}</text>`;
  const connectors:string[]=[];
  const path=(d:string,dashed=false,tone=purple,targetCell="")=>{
    connectors.push(`<path d="${d}" stroke="white" stroke-width="5" fill="none"/><path data-connector="true" ${targetCell?`data-observation-target="${escapeXml(targetCell)}"`:""} d="${d}" stroke="${tone}" stroke-width="1.6" ${dashed?'stroke-dasharray="4 4"':''} fill="none" marker-end="url(#${marker})"/>`);
    return "";
  };
  const token=(x:number,y:number,value:string,tone:string)=>`<circle cx="${x}" cy="${y}" r="24" fill="white" stroke="${tone}" stroke-width="1.6"/>${text(x,y+5,value,"middle",tone)}`;
  const initial={x:mobile?width/2:100,y:mobile?180:410};
  const state=(point:{x:number;y:number},data:{state:string;h:string;z:string})=>{
    let svg=`<g data-trace-state="${prefix}-${escapeXml(data.state)}"><rect x="${point.x-70}" y="${point.y-36}" width="140" height="72" rx="6" fill="#faf9fc" stroke="#bbb3d1"/>`;
    for(const [offset,value] of [[-33,data.h],[33,data.z]] as const)svg+=`<rect x="${point.x+offset-26}" y="${point.y-26}" width="52" height="52" rx="4" fill="white" stroke="${purple}"/>`+text(point.x+offset,point.y+5,value,"middle");
    svg+=path(`M${point.x-7} ${point.y} H${point.x+7}`)+text(point.x,point.y+65,data.state,"middle");
    return svg+"</g>";
  };
  const observe=(point:{x:number;y:number},value:string,z:string)=>{
    const x=point.x+33,y=point.y-130;
    return `<g data-trace-observation="${prefix}-${escapeXml(value)}">${token(x,y,value,blue)}${path(`M${x} ${y+24} V${point.y-26}`,false,blue,z)}</g>`;
  };
  let svg=text(16,14,"One shared replay posterior", "start", blue);
  if(!mobile)svg=text(16,210,"Shared replay posterior","start",blue);
  svg+=observe(initial,trace.initial.observation,trace.initial.z)+state(initial,trace.initial);
  const replay=trace.branches.find(branch=>branch.mode==="replay")!,imagined=trace.branches.find(branch=>branch.mode==="imagination")!;
  let bottom=0;
  for(const [bi,branch] of [replay,imagined].entries()){
    const firstY=mobile?(bi===0?480:480+(replay.steps.length-1)*260+240):(bi===0?220:620);
    const heading=branch.mode==="replay"?"Replay · recorded actions":"Imagination · actor actions";
    svg+=text(mobile?60:300,mobile?firstY-(bi===0?195:115):firstY-190,heading,"start",branch.mode==="replay"?blue:purple);
    let previous=initial;
    for(const [index,step] of branch.steps.entries()){
      const next={x:mobile?width/2:branch.steps.length===1?610:420+index*350,y:mobile?firstY+index*260:firstY};
      const action={x:mobile?72:(previous.x+70+next.x-59)/2,y:next.y-60};
      if(mobile){
        const lane=index===0?(bi===0?27:17):37;
        svg+=path(`M${previous.x-70} ${previous.y} H${lane} V${next.y} H${next.x-59}`,branch.mode==="imagination");
        if(branch.mode==="imagination"){
          const policyLane=index===0?7:47;
          svg+=path(`M${previous.x-70} ${previous.y} H${policyLane} V${action.y} H${action.x-24}`,true);
        }
      }else{
        const lane=branch.mode==="replay"?240:230;
        svg+=path(index===0?`M${previous.x+70} ${previous.y} H${lane} V${next.y} H${next.x-59}`:`M${previous.x+70} ${previous.y} H${next.x-59}`,branch.mode==="imagination");
        if(branch.mode==="imagination")svg+=path(`M${previous.x+70} ${previous.y} H${index===0?210:previous.x+100} V${action.y} H${action.x-24}`,true);
      }
      svg+=`<g data-trace-action="${prefix}-${escapeXml(step.action)}" data-action-origin="${branch.mode}">${token(action.x,action.y,step.action,purple)}${path(`M${action.x} ${action.y+24} V${next.y}`,branch.mode==="imagination")}<circle cx="${action.x}" cy="${next.y}" r="3" fill="${purple}"/></g>`;
      if(step.observation)svg+=observe(next,step.observation,step.z);
      svg+=state(next,step);previous=next;bottom=Math.max(bottom,next.y+65);
    }
  }
  let y=bottom+48;
  for(const line of wrapDiagramText("h = recurrent state; z = stochastic state. Each transition uses the previous h,z and action. Solid blue inputs are observations; dashed paths are imagined.",Math.floor(width/8.4))){svg+=text(0,y,line);y+=20;}
  return {svg:svg+connectors.join(""),height:y+16};
}
