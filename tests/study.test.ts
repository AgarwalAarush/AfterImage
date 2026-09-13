import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStudy, studySvg, type StudyPack } from "../src/lib/study";
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
