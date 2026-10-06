import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStudy, studySvg, figureSchema, MAX_STUDY_BAR_SERIES, type StudyPack, type StudyFigure } from "../src/lib/study";
import { inspectSvg } from "../worker/diagram-review";
const pack:StudyPack={figures:[{id:"comparison",kind:"bars",placement:"evidence",title:"A controlled comparison",caption:"Illustrative values show how to compare results under the same conditions, not a measured benchmark.",sourceId:"s1",provenance:"illustrative",unit:"iterations",series:[{label:"Baseline",value:100,note:"Same task and hardware"},{label:"Variant",value:50,note:"Same task and hardware"}]}],quiz:[0,1].map(i=>({id:`q-${i}`,question:"Which quantity stays fixed in this comparison?",options:[{text:"The task",explanation:"The task stays fixed for a controlled comparison."},{text:"The result",explanation:"The result can change; that is the measured outcome."},{text:"Nothing",explanation:"This cannot isolate an effect if everything changes."}],answer:0,sourceId:"s1"}))};
const sources=[{id:"s1",label:"Method",url:"https://arxiv.org/abs/1234.56789",excerpt:"Evidence"}];
test("study figures render without label collisions at both sizes",()=>{validateStudy(pack,sources);for(const mobile of [false,true])assert.deepEqual(inspectSvg(studySvg(pack.figures[0],mobile)),[]);});
test("study rejects unsupported citations, inconsistent matrices and ambiguous options",()=>{
 assert.throws(()=>validateStudy(pack,[]),/source/);
 const bad=structuredClone(pack);bad.quiz[0].options[1].text=bad.quiz[0].options[0].text;assert.throws(()=>validateStudy(bad,sources),/differ/);
 const matrix={...pack.figures[0],kind:"matrix" as const,unit:"score",rows:["a","b"],columns:["x","y"],values:[[1,2],[3]]};assert.throws(()=>validateStudy({...pack,figures:[matrix]},sources));
});
test("weighted network states have visible values and safe mobile geometry",()=>{
 const figure={...pack.figures[0],kind:"network" as const,layers:[{label:"Input",nodes:["x1","x2"]},{label:"Hidden",nodes:["h1","h2"]},{label:"Output",nodes:["y"]}],states:[{label:"Original weights",explanation:"Illustrative weights make the contributions visible.",edges:[{fromLayer:0,from:0,to:0,weight:.12,active:true},{fromLayer:0,from:1,to:1,weight:-.08,active:true},{fromLayer:1,from:0,to:0,weight:.31,active:true},{fromLayer:1,from:1,to:0,weight:.06,active:false}]}]};
 for(const mobile of [false,true]){const svg=studySvg(figure,mobile);assert.match(svg,/0.12/);assert.match(svg,/marker-end/);assert.deepEqual(inspectSvg(svg),[]);}
});
test("quiz shuffling preserves the correct option and its explanation",async()=>{
 const {arrangeQuiz}=await import("../src/lib/study");const shuffled=arrangeQuiz(pack);
 for(let i=0;i<pack.quiz.length;i++)assert.deepEqual(shuffled.quiz[i].options[shuffled.quiz[i].answer],pack.quiz[i].options[pack.quiz[i].answer]);
 assert.deepEqual(arrangeQuiz(pack),shuffled);
});
test("reported charts need the exact values in the cited original excerpt",()=>{
 const reported=structuredClone(pack);reported.figures[0].provenance="reported";
 assert.throws(()=>validateStudy(reported,sources),/absent/);
 assert.doesNotThrow(()=>validateStudy(reported,[{...sources[0],excerpt:"Baseline 100 iterations; variant 50 iterations under the same conditions."}]));
});
test("complete eight-endpoint comparisons preserve every sourced condition and value",()=>{
 const values=[6.1,9.8,37.6,55.2,16.2,30.5,44.3,66.3];
 const labels=["Alpaca parallel low","Alpaca parallel high","Alpaca beam low","Alpaca beam high","ShareGPT parallel low","ShareGPT parallel high","ShareGPT beam low","ShareGPT beam high"];
 const figure={...pack.figures[0],kind:"bars" as const,layout:"adaptive-bars-v1" as const,provenance:"reported" as const,unit:"Memory saved (%)",series:values.map((value,i)=>({label:labels[i],value,note:"Reported range endpoint."}))};
 validateStudy({...pack,figures:[figure]},[{...sources[0],excerpt:values.join("; ")}]);
 for(const mobile of [false,true]){
  const svg=studySvg(figure,mobile);assert.deepEqual(inspectSvg(svg),[]);
  for(const [i,value] of values.entries()){assert.ok(svg.includes(`>${value}<`));assert.ok(svg.includes(labels[i]));}
  assert.equal([...svg.matchAll(/fill="#8c79b2"/g)].length,8);
 }
});
test("maximum study bar rows retain readable text and complete notes within a bounded resource budget",()=>{
 const figure={...pack.figures[0],kind:"bars" as const,layout:"adaptive-bars-v1" as const,unit:"items",series:Array.from({length:MAX_STUDY_BAR_SERIES},(_,i)=>({label:`Condition ${i+1}, same workload`,value:i+1,note:"The task, model, precision, hardware and measurement denominator remain the same across conditions."}))};
 validateStudy({...pack,figures:[figure]},sources);
 for(const mobile of [false,true]){
  const svg=studySvg(figure,mobile);assert.deepEqual(inspectSvg(svg),[]);
  assert.equal([...svg.matchAll(/fill="#8c79b2"/g)].length,MAX_STUDY_BAR_SERIES);
  for(const item of figure.series)assert.ok(svg.includes(item.label));
  assert.doesNotMatch(svg,/font-size="(?:[0-9]|10|11)"/);
  assert.ok(svg.includes("conditions."));
 }
 assert.throws(()=>figureSchema.parse({...figure,series:[...figure.series,figure.series[0]]}));
 assert.throws(()=>validateStudy({...pack,figures:[{...figure,layout:null}]},sources),/adaptive-bars-v1/);
});
test("adaptive loss comparisons use their actual positive endpoint while keeping relative parity and complete unit labels",()=>{
 const figure={...pack.figures[0],kind:"bars" as const,layout:"adaptive-bars-v1" as const,unit:"Auxiliary loss",series:[{label:"Balanced",value:.010,note:"Illustrative balanced routing."},{label:"Imbalanced",value:.013,note:"Illustrative imbalanced routing."}]};
 validateStudy({...pack,figures:[figure]},sources);
 for(const mobile of [false,true]){
  const svg=studySvg(figure,mobile),extent=mobile?302:558;
  const widths=[...svg.matchAll(/<rect[^>]+width="([^"]+)"[^>]+fill="#8c79b2"/g)].map(m=>Number(m[1]));
  assert.ok(Math.abs(widths[0]-extent*.010/.013)<.00001);assert.equal(widths[1],extent);assert.match(svg,/>0.013<\/text>/);assert.deepEqual(inspectSvg(svg),[]);
  assert.match(studySvg({...figure,unit:"speedup ratio"},mobile),/1× parity/);
  assert.match(studySvg({...figure,unit:"accuracy (%)"},mobile),/>100<\/text>/);
 }
 assert.throws(()=>validateStudy({...pack,figures:[{...figure,unit:"Aux loss (dimensionles"}]},sources),/unfinished bracket/);
 assert.doesNotThrow(()=>validateStudy({...pack,figures:[{...figure,unit:"Aux loss (dimensionless)"}]},sources));
});
test("specialized scientific renderers are deterministic and publication-safe",()=>{
 const base={placement:"mechanism" as const,caption:"Illustrative values expose the structure of this mechanism and are not measurements reported by the paper.",sourceId:"s1",provenance:"illustrative" as const};
 const figures:StudyPack["figures"]=[
  {...base,id:"attention",title:"Causal attention pattern",kind:"heatmap",unit:"attention",normalization:"row-normalized",rows:["tok-a","tok-b","tok-c"],columns:["tok-a","tok-b","tok-c"],values:[[1,0,0],[.3,.7,0],[.1,.2,.7]]},
  {...base,id:"token-tree",title:"Verified token branches",kind:"tree",scoreUnit:"log probability",nodes:[{id:"root",parentId:null,token:"The",score:-.1,status:"accepted"},{id:"a",parentId:"root",token:"model",score:-.4,status:"accepted"},{id:"b",parentId:"root",token:"paper",score:-.7,status:"rejected"},{id:"c",parentId:"a",token:"routes",score:-.3,status:"candidate"}]},
  {...base,id:"timeline",title:"One decoding iteration",kind:"timeline",events:[{label:"Prefix",detail:"Read the accepted context",phase:"input"},{label:"Draft",detail:"Propose several tokens",phase:"compute"},{label:"Verify",detail:"Score candidates together",phase:"decision"},{label:"Commit",detail:"Keep the accepted prefix",phase:"output"}]},
  {...base,id:"latency",title:"Latency with batch size",kind:"curve",xLabel:"batch size",yLabel:"milliseconds",series:[{label:"baseline",points:[{x:1,y:9},{x:4,y:14},{x:8,y:23}]},{label:"variant",points:[{x:1,y:6},{x:4,y:10},{x:8,y:17}]}]},
  {...base,id:"loss",title:"Optimization across a loss surface",kind:"landscape",xLabel:"parameter one",yLabel:"parameter two",zLabel:"loss",values:[[8,6,5,6],[6,3,2,4],[5,2,1,3],[7,4,3,5]],path:[{row:0,column:0,label:"start"},{row:1,column:1,label:"step 1"},{row:2,column:2,label:"minimum"}]},
 ];
 for(const figure of figures){validateStudy({...pack,figures:[figure]},sources);for(const mobile of [false,true]){const first=studySvg(figure,mobile),second=studySvg(figure,mobile);assert.equal(first,second);assert.deepEqual(inspectSvg(first),[],`${figure.kind} ${mobile?"mobile":"desktop"}`);assert.match(first,/aria-labelledby=/);}}
});
test("specialized renderers reject invalid normalization, topology, axes, and paths",()=>{
 const base={placement:"mechanism" as const,title:"Invalid example",caption:"Illustrative values expose a validation failure without representing reported measurements.",sourceId:"s1",provenance:"illustrative" as const};
 const validQuiz=pack.quiz;
 assert.throws(()=>validateStudy({figures:[{...base,id:"bad-heat",kind:"heatmap",unit:"attention",normalization:"row-normalized",rows:["a","b"],columns:["a","b"],values:[[.2,.2],[.5,.5]]}],quiz:validQuiz},sources),/sum to one/);
 assert.throws(()=>validateStudy({figures:[{...base,id:"bad-tree",kind:"tree",scoreUnit:"score",nodes:[{id:"a",parentId:null,token:"a",score:1,status:"accepted"},{id:"b",parentId:null,token:"b",score:1,status:"candidate"},{id:"c",parentId:"a",token:"c",score:1,status:"candidate"}]}],quiz:validQuiz},sources),/one root/);
 assert.throws(()=>validateStudy({figures:[{...base,id:"bad-curve",kind:"curve",xLabel:"x",yLabel:"y",series:[{label:"series",points:[{x:2,y:1},{x:1,y:2}]}]}],quiz:validQuiz},sources),/increase strictly/);
 assert.throws(()=>validateStudy({figures:[{...base,id:"bad-landscape",kind:"landscape",xLabel:"x",yLabel:"y",zLabel:"loss",values:[[1,2,3],[2,3,4],[3,4,5]],path:[{row:0,column:0,label:"start"},{row:4,column:1,label:"end"}]}],quiz:validQuiz},sources),/leaves the grid/);
});

test("readable curves retain complete configuration names and every point without legend collisions",()=>{
 const figure={...pack.figures[0],id:"training-curve",kind:"curve" as const,layout:"readable-curve-v1" as const,xLabel:"Training tokens (B)",yLabel:"Validation perplexity",series:[{label:"8-bit GaLore, rank 1024",points:[{x:5.2,y:17.94},{x:10.5,y:15.39},{x:15.7,y:14.95},{x:19.7,y:14.65}]},{label:"8-bit Adam",points:[{x:5.2,y:18.09},{x:10.5,y:15.47},{x:15.7,y:14.83},{x:19.7,y:14.61}]}]};
 validateStudy({...pack,figures:[figure]},sources);
 const legacy={...figure,layout:null,series:figure.series.map(s=>({...s,label:s.label.replace("1024","102")}))};
 assert(inspectSvg(studySvg(legacy,true)).some(issue=>issue.includes("collision")));
 const maximum={...figure,xLabel:"Complete horizontal axis description",yLabel:"Complete vertical axis description",series:Array.from({length:3},(_,i)=>({label:`Condition ${i+1} complete configuration name`,points:Array.from({length:12},(_,j)=>({x:j+1,y:(i+1)*(j+1)}))}))};
 figureSchema.parse(maximum);
 for(const f of [figure,maximum])for(const mobile of [false,true]){
  const svg=studySvg(f,mobile);assert.deepEqual(inspectSvg(svg),[]);assert.equal(svg,studySvg(f,mobile));
  assert.doesNotMatch(svg,/font-size="(?:[0-9]|10|11|12)"/);
  for(const [i,series] of f.series.entries())for(const [j,point] of series.points.entries())assert.ok(svg.includes(`data-point="${i}:${j}" data-x="${point.x}" data-y="${point.y}"`));
  assert.equal([...svg.matchAll(/data-point=/g)].length,f.series.reduce((n,s)=>n+s.points.length,0));
  for(const [i,series] of f.series.entries()){
   const legend=svg.match(new RegExp(`<g data-legend="${i}">([\\s\\S]*?)</g>`))![1];
   assert.equal([...legend.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1]).join(" "),series.label);
  }
 }
 assert.throws(()=>validateStudy({...pack,figures:[{...figure,layout:null}]},sources),/readable-curve-v1/);
 assert.throws(()=>validateStudy({...pack,figures:[{...figure,series:[{...figure.series[0],label:"GaLore (rank 1024"}]}]},sources),/complete brackets/);
 const flat={...figure,series:[{label:"Constant measurement",points:[{x:1,y:0},{x:2,y:0}]}]};
 for(const mobile of [false,true])assert.deepEqual(inspectSvg(studySvg(flat,mobile)),[]);
});

test("percentage bars use the full 0–100 scale and label both endpoints", () => {
  const figure={...pack.figures[0],kind:"bars" as const,layout:null,unit:"accuracy (%)",series:[{label:"EC-CF2",value:92.6,note:"Same condition"},{label:"ST Top-1",value:88.9,note:"Same condition"}]};
  for(const mobile of [false,true]) {
    const svg=studySvg(figure,mobile);
    assert.match(svg,/>100<\/text>/);
    const extent=mobile?302:558;
    const widths=[...svg.matchAll(/<rect[^>]+width="([^"]+)"[^>]+fill="#8c79b2"/g)].map(m=>Number(m[1]));
    assert.ok(Math.abs(widths[0]-extent*.926)<.00001);
    assert.ok(Math.abs(widths[1]-extent*.889)<.00001);
    assert.deepEqual(inspectSvg(svg),[]);
  }
});


test("study illustrations share semantic validation and responsive object rendering", async () => {
 const {sparseAllocationScene}=await import("./fixtures/concept-scenes");
 const figure={...pack.figures[0],id:"allocation",kind:"illustration" as const,illustration:sparseAllocationScene.illustration!};
 const cited=[...sources,...figure.illustration.panels.flatMap(panel=>panel.sourceIds).map(id=>({...sources[0],id}))];
 validateStudy({...pack,figures:[figure]},cited);
 for(const mobile of [false,true]){
   const svg=studySvg(figure,mobile);assert.match(svg,/data-allocation-cell/);assert.deepEqual(inspectSvg(svg),[]);
 }
 const bad=structuredClone(figure);bad.illustration.panels[0].sourceIds=["invented"];
 assert.throws(()=>validateStudy({...pack,figures:[bad]},cited),/unknown source/);
 const reported={...figure,provenance:"reported" as const};assert.throws(()=>validateStudy({...pack,figures:[reported]},cited),/illustrative panels/);
});

test("mobile matrices preserve complete operand labels and timeline details are never truncated", () => {
 const matrix={...pack.figures[0],kind:"matrix" as const,unit:"microbatch size",rows:["MegaBlocks","Tutel"],columns:["dMoE-Small","dMoE-Medium"],values:[[64,32],[16,8]]};
 const svg=studySvg(matrix,true);assert.match(svg,/>MegaBlocks<\/text>/);assert.match(svg,/>dMoE-Small<\/text>/);assert.deepEqual(inspectSvg(svg),[]);
 const timeline={...pack.figures[0],kind:"timeline" as const,events:["input","compute","output"].map(phase=>({phase:phase as "input"|"compute"|"output",label:"Operation",detail:"Retain all routed tokens, including the final boundary-padded token group."}))};
 for(const mobile of [false,true]){const svg=studySvg(timeline,mobile);assert.match(svg,/token group/);assert.match(svg,/marker-end/);assert.deepEqual(inspectSvg(svg),[]);}
});


test("transpose glyphs use native SVG superscripts and relative charts show parity", () => {
 const matrix={...pack.figures[0],kind:"matrix" as const,unit:"sparse products",rows:["Data","Weights"],columns:["Layer 1","Layer 2"],values:[[0,1],[1,0]]};
 const figure={...pack.figures[0],kind:"bars" as const,layout:null,unit:"% of baseline",reference:{value:100,label:"100% parity"},series:[{label:"Below",value:91,note:"Same conditions"},{label:"Above",value:104,note:"Same conditions"}]};
 for(const mobile of [false,true]){assert.match(studySvg(figure,mobile),/100% parity/);assert.deepEqual(inspectSvg(studySvg(figure,mobile)),[]);assert.deepEqual(inspectSvg(studySvg(matrix,mobile)),[]);}
});

test("bounded heatmaps retain all conditions and values at readable phone size", () => {
  const figure: StudyFigure = { id:"large-heatmap", kind:"heatmap", title:"Readable conditions", placement:"evidence", sourceId:"s", provenance:"illustrative", caption:"Illustrative maximum-bounded grid exercises complete dataset and condition labels.", normalization:"unnormalized", unit:"percent", rows:Array.from({length:8},(_,i)=>`Dataset-${i}-long`), columns:Array.from({length:8},(_,i)=>`Condition-${i}`), values:Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>r*8+c)) };
  for(const mobile of [false,true]) {
    const svg=studySvg(figure,mobile);
    assert.deepEqual(inspectSvg(svg),[]);
    assert.doesNotMatch(svg,/rotate\(/);
    assert.doesNotMatch(svg,/font-size="(?:[0-9]|1[012])"/);
    for(const label of figure.rows)assert.ok(svg.includes(label));
    assert.match(svg,/0 → 100/);
    for(const row of figure.values)for(const value of row)assert.ok(svg.includes(`>${value}<`));
  }
});
