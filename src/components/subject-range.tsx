"use client";
import { useRef, useState } from "react";
import { clampRangeValue, rangeKeyboardValue } from "@/lib/subject-range";

type Props={label:string;min:number;max:number;keyboardStep:number;value:number;semanticValue:number;valueText?:string;onChange:(value:number)=>void};

/** The native thumb follows the pointer immediately, independently of discrete diagram quantities. */
export function SubjectRange({label,min,max,keyboardStep,value,semanticValue,valueText,onChange}:Props){
  const pointerFocus=useRef(false),[keyboardFocus,setKeyboardFocus]=useState(false);
  return <input className="subject-range" type="range" min={min} max={max} step="any" value={value}
    aria-label={label} aria-valuenow={semanticValue} aria-valuetext={valueText??String(Number(semanticValue.toFixed(2)))}
    data-keyboard-focus={keyboardFocus||undefined}
    onPointerDown={()=>{pointerFocus.current=true;setKeyboardFocus(false);}}
    onFocus={event=>setKeyboardFocus(!pointerFocus.current&&event.currentTarget.matches(":focus-visible"))}
    onBlur={()=>{pointerFocus.current=false;setKeyboardFocus(false);}}
    onKeyDown={event=>{
      pointerFocus.current=false;setKeyboardFocus(true);
      if(event.metaKey||event.altKey||event.ctrlKey)return;
      const next=rangeKeyboardValue(value,event.key,{min,max,step:keyboardStep});
      if(next!==null){event.preventDefault();onChange(next);}
    }}
    onChange={event=>onChange(clampRangeValue(Number(event.target.value),min,max))}/>
}
