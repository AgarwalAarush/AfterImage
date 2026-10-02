import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { rollingCausalWindow } from "../src/lib/subject-experiments";
import { RollingWindowDrawing } from "../src/components/subject-rolling-window";
test("the causal read and modulo write preserve every identity through sequential cache overwrites",()=>{
  let previousAfter:(number|null)[]=Array(4).fill(null);
  for(let query=0;query<12;query++){
    const state=rollingCausalWindow(query);
    assert.deepEqual(state.before,previousAfter);
    assert.deepEqual(state.eligible,Array.from({length:Math.min(query,4)+1},(_,i)=>Math.max(0,query-4)+i));
    assert.equal(state.writeSlot,query%4);
    assert.equal(state.after[state.writeSlot],query);
    assert.equal(state.evicted,query>=4?query-4:null);
    if(state.evicted!==null){assert.ok(state.previous.includes(state.evicted));assert.ok(!state.after.includes(state.evicted));}
    state.after.forEach((position,slot)=>{if(position!==null){assert.equal(position%4,slot);assert.ok(position>=Math.max(0,query-3)&&position<=query);}});
    assert.equal(state.after.filter(position=>position!==null).length,Math.min(query+1,4));
    previousAfter=state.after;
  }
});
test("query selection remains an integer while the drawing separates previous, current, expired and future positions",()=>{
  assert.equal(rollingCausalWindow(5.41).query,5);
  assert.equal(rollingCausalWindow(5.51).query,6);
  const render=(query:number)=>load(renderToStaticMarkup(React.createElement("svg",null,React.createElement(RollingWindowDrawing,{width:660,query}))),{xml:true});
  const $=render(5);
  assert.equal($("[data-role='current']").attr("data-position"),"5");
  assert.deepEqual($("[data-role='previous']").toArray().map(element=>Number($(element).attr("data-position"))),[1,2,3,4]);
  assert.equal($("[data-role='expired']").length,1);
  assert.equal($("[data-role='future']").length,6);
  assert.equal($("[data-cache-phase='before'][data-slot='1']").attr("data-token"),"1");
  assert.equal($("[data-cache-phase='after'][data-slot='1']").attr("data-token"),"5");
  const initial=render(0);
  $("[data-position]").each((_,element)=>{const id=$(element).attr("data-position")!,a=initial(`[data-position='${id}'] rect`),b=$(element).find("rect");assert.equal(a.attr("x"),b.attr("x"));assert.equal(a.attr("width"),b.attr("width"));});
});
