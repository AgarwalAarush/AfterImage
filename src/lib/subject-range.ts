import type { SubjectFigure } from "./subjects";

export type RangeBounds={min:number;max:number;step:number};
const integerKinds=new Set<SubjectFigure["kind"]>(["low-rank","quantization","memory","routing","graph","search","retrieval","streaming-attention","rolling-window"]);
export const clampRangeValue=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function subjectParameterValue(kind:SubjectFigure["kind"],raw:number){
  return integerKinds.has(kind)?Math.round(raw):raw;
}
/** Pointer movement stays continuous; keyboard actions use the control's meaningful grid. */
export function rangeKeyboardValue(raw:number,key:string,{min,max,step}:RangeBounds):number|null{
  if(key==="Home")return min;
  if(key==="End")return max;
  const direction=key==="ArrowRight"||key==="ArrowUp"?1:key==="ArrowLeft"||key==="ArrowDown"?-1:key==="PageUp"?10:key==="PageDown"?-10:0;
  if(!direction)return null;
  const tick=Math.round((raw-min)/step)+direction;
  return Number(clampRangeValue(min+tick*step,min,max).toFixed(10));
}
const explorationTravelMs=5500,explorationHoldMs=900;
/** Continuous forward/back exploration with short endpoint holds; reversing changes only the parameter. */
export function rangeExplorationValue(elapsed:number,min:number,max:number){
  const halfCycle=explorationTravelMs+explorationHoldMs,position=elapsed%(2*halfCycle);
  const fraction=position<explorationTravelMs?position/explorationTravelMs:
    position<halfCycle?1:position<halfCycle+explorationTravelMs?1-(position-halfCycle)/explorationTravelMs:0;
  return min+fraction*(max-min);
}
export const rangeExplorationPhase=(value:number,min:number,max:number)=>(value-min)/(max-min)*explorationTravelMs;
