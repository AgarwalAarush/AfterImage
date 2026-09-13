import { streamCodex } from "./assistant-codex";
const base=process.env.AFTERIMAGE_URL,token=process.env.AFTERIMAGE_WORKER_TOKEN;
if(!base||!token)throw new Error("Worker configuration is missing");
let stopping=false;let current:AbortController|undefined;
process.on("SIGTERM",()=>{stopping=true;current?.abort();});
process.on("SIGINT",()=>{stopping=true;current?.abort();});
async function api(body:unknown){
  const response=await fetch(`${base}/api/assistant/worker`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Assistant service ${response.status}`);return response.json();
}
async function run(){
  const {request,context}=await api({action:"claim"});if(!request)return false;
  const credentials={id:request.id,leaseToken:request.leaseToken};current=new AbortController();
  let text="",sent="",sending=false;
  // Deliver true model deltas in short batches, never a fabricated typing animation.
  async function flush(){if(sending)return;sending=true;try{const outgoing=text;const result=await api({action:outgoing!==sent?"update":"heartbeat",...credentials,answer:outgoing});if(result.cancelled)current?.abort();sent=outgoing;}catch{current?.abort();}finally{sending=false;}}
  const timer=setInterval(()=>void flush(),650);
  try{
    console.log(new Date().toISOString(),"Assistant started",request.id);
    await streamCodex(context,value=>{text=value;},current.signal);
    clearInterval(timer);while(sending)await new Promise(r=>setTimeout(r,50));
    if(!current.signal.aborted)await api({action:"complete",...credentials,answer:text});
    console.log(new Date().toISOString(),"Assistant finished",request.id);
  }catch(e){console.error("Assistant failed:",(e as Error).message);await api({action:"fail",...credentials}).catch(()=>{});}
  finally{clearInterval(timer);current=undefined;}
  return true;
}
async function main(){do{try{const worked=await run();if(process.argv.includes("--once"))return;if(!worked)await new Promise(r=>setTimeout(r,2000));}catch(e){console.error((e as Error).message);await new Promise(r=>setTimeout(r,5000));}}while(!stopping);}
void main();
