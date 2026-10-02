import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ExperimentDrawing } from "../src/components/subject-experiment";
import { NoiseShellDrawing, StreamingAttentionDrawing } from "../src/components/subject-mechanism-experiments";
import { experimentControls, experimentState, shellCanvasHeight } from "../src/lib/subject-experiments";
import { experimentKinds } from "../src/lib/subjects";

function drawing(kind: typeof experimentKinds[number], value: number, width = 660) {
  return renderToStaticMarkup(React.createElement("svg", {viewBox:`0 0 ${width} ${kind==="noise-shells"?shellCanvasHeight(width):275}`},
    React.createElement(ExperimentDrawing, {kind,result:experimentState(kind,value),width,value,dimension:3})));
}

test("every experiment draws finite native-size geometry across its parameter range", () => {
  for (const kind of experimentKinds) {
    const control=experimentControls[kind];
    for(const width of [320,660])for(const value of [control.min,control.initial,control.max]) {
      const svg=drawing(kind,value,width);
      const height=kind==="noise-shells"?shellCanvasHeight(width):275;
      assert.doesNotMatch(svg,/NaN|Infinity/,`${kind}: ${value} at ${width}px`);
      const $=load(svg,{xml:true});
      $("[x],[cx],[x1],[x2]").each((_,element)=>{
        for(const attribute of ["x","cx","x1","x2"]){const raw=$(element).attr(attribute);if(raw===undefined)continue;const n=Number(raw);assert.ok(n>=0&&n<=width,`${kind} ${attribute}=${n}`);}
      });
      $("[y],[cy],[y1],[y2]").each((_,element)=>{
        for(const attribute of ["y","cy","y1","y2"]){const raw=$(element).attr(attribute);if(raw===undefined)continue;const n=Number(raw);assert.ok(n>=0&&n<=height,`${kind} ${attribute}=${n}`);}
      });
    }
  }
});

test("topology reflects graph relationships and distinguishes unrevealed search outcomes",()=>{
  const graph=load(drawing("graph",1),{xml:true});
  assert.equal(graph("circle").length,3);
  assert.equal(graph("line").length,2);
  assert.match(graph("svg").text(),/0\.500/);
  const search=load(drawing("search",2),{xml:true});
  assert.equal(search("circle").length,7);
  assert.equal(search("line").length,6);
  assert.equal(search("text").filter((_,element)=>search(element).text()==="?").length,2);
});

test("continuous examples connect computed values and preserve separate reference curves",()=>{
  for(const kind of ["optimizer","state","guidance"] as const)assert.equal(load(drawing(kind,experimentControls[kind].initial),{xml:true})("polyline").length,1);
  for(const kind of ["ode","latent"] as const)assert.equal(load(drawing(kind,experimentControls[kind].initial),{xml:true})("polyline").length,2);
});
test("sphere visibility changes preserve point identities while camera rotation changes only projection",()=>{
  const render=(yaw:number,shells:"both"|"inner"|"outer")=>load(renderToStaticMarkup(React.createElement("svg",null,React.createElement(NoiseShellDrawing,{width:660,sigma:.4,yaw,pitch:.35,shells}))),{xml:true});
  const initial=render(.6,"both"),rotated=render(1.2,"both");
  assert.equal(initial("[data-point]").length,480);
  for(const shell of ["inner","outer"] as const)assert.equal(render(.6,shell)("[data-point]").length,240);
  const coordinates=($:ReturnType<typeof load>)=>new Map($("[data-point]").toArray().map(element=>[$(element).attr("data-point"),[$(element).attr("cx"),$(element).attr("cy")]]));
  const a=coordinates(initial),b=coordinates(rotated);
  assert.deepEqual([...a.keys()].sort(),[...b.keys()].sort());
  assert.notDeepEqual(a.get("inner-0"),b.get("inner-0"));
});
test("the online-softmax poster never presents an empty state's output as zero",()=>{
  const svg=renderToStaticMarkup(React.createElement("svg",null,React.createElement(StreamingAttentionDrawing,{width:660,tileWidth:1,order:"reverse",visited:0})));
  assert.match(svg,/Initial empty state/);
  assert.match(svg,/—/);
  assert.match(svg,/No scores have been accumulated/);
});
test("SVG presentation absorbs platform-level math differences without changing scientific state",()=>{
  const state=experimentState("contrastive",.7),snapshot=structuredClone(state);
  const nudged={...state,values:state.values.map(value=>value+1e-15)};
  const render=(result:typeof state)=>renderToStaticMarkup(React.createElement("svg",null,React.createElement(ExperimentDrawing,{kind:"contrastive",result,width:660,value:.7,dimension:3})));
  assert.equal(render(state),render(nudged));
  assert.deepEqual(state,snapshot);
  const $=load(render(state),{xml:true});
  $("rect").each((_,element)=>{
    for(const attribute of ["x","y","width","height","fill-opacity"]){const value=$(element).attr(attribute);if(value!==undefined)assert.doesNotMatch(value,/\.\d{5}/);}
  });
});
test("short Euler trajectories produce one axis label per sample index",()=>{
  const svg=load(drawing("ode",1,660),{xml:true});
  const labels=svg("text[y='240']").toArray().map(element=>svg(element).text());
  assert.deepEqual(labels,["0","1","2","3"]);
});

test("continuous Euler and Gaussian curves position samples from their actual coordinates",()=>{
  const state=experimentState("ode",.137),times=state.coordinates!;
  assert.equal(times.at(-1),3);
  assert.ok(Math.abs(times[1]-.137)<1e-12);
  const svg=load(drawing("ode",.137,660),{xml:true});
  const x=Number(svg("circle").eq(1).attr("cx"));
  assert.ok(Math.abs(x-(46+.137/3*(636-46)))<.0001);
  const gaussian=experimentState("latent",.41357);
  assert.equal(gaussian.coordinates![1],-2.75);
  const raw=load(drawing("latent",.41357,660),{xml:true});
  const second=Number(raw("polyline").last().attr("points")!.split(" ")[1].split(",")[0]);
  assert.ok(Math.abs(second-(46+.25/6*(636-46)))<.0001);
});
