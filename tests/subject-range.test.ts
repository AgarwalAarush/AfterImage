import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubjectRange } from "../src/components/subject-range";
import { experimentState } from "../src/lib/subject-experiments";
import { rangeExplorationPhase,rangeExplorationValue,rangeKeyboardValue,subjectParameterValue } from "../src/lib/subject-range";

test("range thumbs preserve continuous positions while integer scientific quantities stay whole",()=>{
  for(const kind of ["low-rank","quantization","memory","routing","graph","search","retrieval","streaming-attention"] as const){
    assert.equal(subjectParameterValue(kind,2.49),2);
    assert.equal(subjectParameterValue(kind,2.51),3);
  }
  for(const kind of ["noise","normalization","optimizer","policy","state","latent","ode","guidance","noise-shells"] as const)assert.equal(subjectParameterValue(kind,.41357),.41357);
  assert.equal(experimentState("routing",subjectParameterValue("routing",2.41)).selected.length,8);
  assert.equal(experimentState("memory",subjectParameterValue("memory",3.78)).values.filter(value=>value===.35).length,3);
});
test("keyboard control moves along meaningful steps from a continuous pointer position",()=>{
  const integer={min:1,max:4,step:1};
  assert.equal(rangeKeyboardValue(2.41,"ArrowRight",integer),3);
  assert.equal(rangeKeyboardValue(2.41,"ArrowLeft",integer),1);
  assert.equal(rangeKeyboardValue(2.41,"Home",integer),1);
  assert.equal(rangeKeyboardValue(2.41,"End",integer),4);
  assert.equal(rangeKeyboardValue(2.41,"PageUp",integer),4);
  assert.equal(rangeKeyboardValue(2.41,"PageDown",integer),1);
  assert.equal(rangeKeyboardValue(.41357,"ArrowUp",{min:.1,max:.8,step:.01}),.42);
  assert.equal(rangeKeyboardValue(.41357,"ArrowDown",{min:.1,max:.8,step:.01}),.4);
  assert.equal(rangeKeyboardValue(.41357,"Tab",{min:.1,max:.8,step:.01}),null);
});
test("linear parameter playback moves on adjacent frames, holds, and resumes from the current parameter",()=>{
  const phase=rangeExplorationPhase(2.41,1,4);
  assert.equal(rangeExplorationValue(phase,1,4),2.41);
  const a=rangeExplorationValue(phase+16,1,4),b=rangeExplorationValue(phase+32,1,4);
  assert.ok(a>2.41&&b>a);
  assert.ok(b-a<.02);
  assert.equal(rangeExplorationValue(6000,1,4),4);
  assert.ok(rangeExplorationValue(7000,1,4)<4);
  assert.ok(rangeExplorationValue(7000,1,4)>rangeExplorationValue(7016,1,4));
});
test("parameter exploration stays continuous at both endpoint holds and across the cycle boundary",()=>{
  const min=-2,max=2;
  for(const boundary of [5500,6400,11900,12800]){
    const before=rangeExplorationValue(boundary-.001,min,max),at=rangeExplorationValue(boundary,min,max),after=rangeExplorationValue(boundary+.001,min,max);
    assert.ok(Math.abs(before-at)<.000001,`before ${boundary}`);
    assert.ok(Math.abs(after-at)<.000001,`after ${boundary}`);
  }
  assert.equal(rangeExplorationValue(6000,min,max),max);
  assert.equal(rangeExplorationValue(12400,min,max),min);
  const pausedPhase=8400,paused=rangeExplorationValue(pausedPhase,min,max),resumed=rangeExplorationValue(pausedPhase+16,min,max);
  assert.ok(resumed<paused&&paused-resumed<.02);
});
test("native slider markup exposes the semantic value without snapping its thumb",()=>{
  const html=renderToStaticMarkup(React.createElement(SubjectRange,{label:"Retained rank",min:1,max:6,keyboardStep:1,value:2.41,semanticValue:2,onChange:()=>{}}));
  assert.match(html,/step="any"/);
  assert.match(html,/value="2.41"/);
  assert.match(html,/aria-valuenow="2"/);
  assert.match(html,/aria-label="Retained rank"/);
});
