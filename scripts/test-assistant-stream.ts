import { streamCodex } from "../worker/assistant-codex";
async function main(){
const started=Date.now();let deltas=0,first=0;
const answer=await streamCodex({paper:{title:"Streaming verification"},question:"Explain in 3 sentences why a matrix multiplication must have compatible inner dimensions. This is a local verification question; there is no source paper."},text=>{deltas++;if(!first)first=Date.now();console.log(JSON.stringify({event:"delta",chars:text.length,ms:Date.now()-started}));},AbortSignal.timeout(150000));
console.log(JSON.stringify({complete:true,deltas,firstMs:first-started,totalMs:Date.now()-started,answer}));

}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
