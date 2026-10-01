import test from "node:test";
import assert from "node:assert/strict";
import { validateStateTrace, type StateTrace } from "../src/lib/scene-state-trace";
import { stateTraceSvg } from "../src/lib/scene-state-trace-svg";
import { inspectSvg } from "../worker/diagram-review";

const trace:StateTrace={initial:{state:"s₀",h:"h₀",z:"z₀",observation:"x₀"},branches:[
  {mode:"replay",steps:[{state:"sR₁",h:"hR₁",z:"zR₁",action:"aR₀",observation:"x₁"},{state:"sR₂",h:"hR₂",z:"zR₂",action:"aR₁",observation:"x₂"}]},
  {mode:"imagination",steps:[{state:"sI₁",h:"hI₁",z:"zI₁",action:"aπ₀",observation:null},{state:"sI₂",h:"hI₂",z:"zI₂",action:"aπ₁",observation:null}]},
]};
test("one shared posterior branches into action-conditioned replay and imagination",()=>{
  validateStateTrace(trace);
  for(const width of [332,936]){
    const {svg,height}=stateTraceSvg(trace,width,"arrow","trace");
    assert.equal((svg.match(/data-trace-state=/g)||[]).length,5);
    assert.equal((svg.match(/data-trace-observation=/g)||[]).length,3);
    assert.equal((svg.match(/data-trace-action=/g)||[]).length,4);
    assert.equal((svg.match(/data-action-origin="imagination"/g)||[]).length,2);
    assert.equal((svg.match(/data-observation-target=/g)||[]).length,3);
    assert.ok(svg.lastIndexOf('data-observation-target=')>svg.lastIndexOf('data-trace-state='),"Observation arrowheads paint above target fills");
    assert.deepEqual(inspectSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width+8} ${height+8}"><g transform="translate(4 4)">${svg}</g></svg>`),[]);
  }
});
test("untrusted trace symbols remain escaped in text and diagnostic attributes",()=>{
  const value=structuredClone(trace);value.initial.state='s<0';value.initial.observation='x"0';
  const {svg}=stateTraceSvg(value,332,"arrow","trace");
  assert.match(svg,/data-trace-state="trace-s&lt;0"/);
  assert.match(svg,/data-trace-observation="trace-x&quot;0"/);
  assert.doesNotMatch(svg,/data-trace-state="trace-s<0"/);
});
test("state traces reject invented future observations and duplicated boundary identities",()=>{
  const bad=structuredClone(trace);bad.branches[1].steps[0].observation="x₁";
  assert.throws(()=>validateStateTrace(bad),/observations/);
  const duplicate=structuredClone(trace);duplicate.branches[1].steps[0].state="s₀";
  assert.throws(()=>validateStateTrace(duplicate),/identities/);
  const missing=structuredClone(trace);missing.branches[0].steps[0].observation=null;
  assert.throws(()=>validateStateTrace(missing),/observations/);
});
