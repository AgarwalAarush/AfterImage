import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { studySvg, type StudyFigure } from "../src/lib/study";
import { reviewFonts } from "../worker/diagram-review";

const base={placement:"mechanism" as const,caption:"Illustrative values expose the structure of this mechanism and are not measurements reported by the paper.",sourceId:"s1",provenance:"illustrative" as const};
const figures:StudyFigure[]=[
  {...base,id:"attention",title:"Causal attention pattern",kind:"heatmap",unit:"attention",normalization:"row-normalized",rows:["The","model","routes","tokens"],columns:["The","model","routes","tokens"],values:[[1,0,0,0],[.26,.74,0,0],[.12,.31,.57,0],[.08,.17,.28,.47]]},
  {...base,id:"token-tree",title:"Verified token branches",kind:"tree",scoreUnit:"log probability",nodes:[{id:"root",parentId:null,token:"The",score:-.1,status:"accepted"},{id:"model",parentId:"root",token:"model",score:-.4,status:"accepted"},{id:"paper",parentId:"root",token:"paper",score:-.7,status:"rejected"},{id:"routes",parentId:"model",token:"routes",score:-.3,status:"accepted"},{id:"keeps",parentId:"model",token:"keeps",score:-.6,status:"candidate"},{id:"tokens",parentId:"routes",token:"tokens",score:-.2,status:"candidate"}]},
  {...base,id:"timeline",title:"One decoding iteration",kind:"timeline",events:[{label:"Prefix",detail:"Read the accepted context",phase:"input"},{label:"Draft",detail:"Propose several tokens",phase:"compute"},{label:"Verify",detail:"Score candidates together",phase:"decision"},{label:"Commit",detail:"Keep the accepted prefix",phase:"output"}]},
  {...base,id:"latency",title:"Latency with batch size",kind:"curve",xLabel:"batch size",yLabel:"milliseconds",series:[{label:"baseline",points:[{x:1,y:9},{x:4,y:14},{x:8,y:23},{x:16,y:41}]},{label:"variant",points:[{x:1,y:6},{x:4,y:10},{x:8,y:17},{x:16,y:29}]}]},
  {...base,id:"loss",title:"Optimization across a loss surface",kind:"landscape",xLabel:"parameter one",yLabel:"parameter two",zLabel:"loss",values:[[9,8,7,7,8],[8,5,4,5,7],[7,4,1,3,6],[8,5,3,4,7],[9,7,6,7,9]],path:[{row:0,column:0,label:"start"},{row:1,column:1,label:"step 1"},{row:2,column:2,label:"minimum"}]},
];
async function main(){
  const out=path.resolve(".artifacts/study-gallery");
  await mkdir(out,{recursive:true});
  for(const figure of figures)for(const mobile of [false,true]){
    const svg=studySvg(figure,mobile),file=path.join(out,`${figure.kind}-${mobile?"mobile":"desktop"}.png`);
    await writeFile(file,new Resvg(svg,{background:"#faf9fc",font:reviewFonts,fitTo:{mode:"width",value:mobile?350:760}}).render().asPng());
  }
  console.log(out);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
