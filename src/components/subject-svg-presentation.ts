import React, { type ReactNode } from "react";

const numericAttributes=new Set(["x","y","cx","cy","x1","x2","y1","y2","width","height","r","rx","ry","opacity","fillOpacity","strokeOpacity","strokeWidth","fontSize"]);
const coordinateStrings=new Set(["d","points","transform","viewBox","strokeDasharray"]);
const numericToken=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const rounded=(value:number)=>Number(value.toFixed(4));

/** Quantize presentation attributes only; scientific state retains its full precision. */
export function stableSubjectSvg(node:ReactNode):ReactNode{
  if(Array.isArray(node))return React.Children.map(node,stableSubjectSvg);
  if(!React.isValidElement<Record<string,unknown>>(node))return node;
  const attributes:Record<string,unknown>={};
  if(typeof node.type==="string")for(const [name,value] of Object.entries(node.props)){
    if(numericAttributes.has(name)&&typeof value==="number"&&Number.isFinite(value))attributes[name]=rounded(value);
    else if(coordinateStrings.has(name)&&typeof value==="string")attributes[name]=value.replace(numericToken,token=>String(rounded(Number(token))));
  }
  if("children" in node.props)attributes.children=stableSubjectSvg(node.props.children as ReactNode);
  return React.cloneElement(node,attributes);
}
