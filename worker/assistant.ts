import { streamCodex } from "./assistant-codex";
import { runAssistantWorker, type WorkerCommand, type WorkerReply } from "./assistant-runtime";
import { AssistantWakeClient } from "./assistant-wake";

const base=process.env.AFTERIMAGE_URL,token=process.env.AFTERIMAGE_WORKER_TOKEN;
if(!base||!token)throw new Error("Worker configuration is missing");
const wakeToken=process.env.AFTERIMAGE_ASSISTANT_WAKE_TOKEN;
const wakeUrl=process.env.AFTERIMAGE_ASSISTANT_WAKE_URL;
if(wakeUrl&&!wakeToken)throw Error("Assistant wake credential is missing.");
const wake=wakeToken?new AssistantWakeClient(wakeUrl||"http://127.0.0.1:3104/internal/assistant/events",wakeToken):undefined;
const stop=new AbortController();
process.on("SIGTERM",()=>stop.abort());
process.on("SIGINT",()=>stop.abort());
async function api(body:WorkerCommand):Promise<WorkerReply>{
  const response=await fetch(`${base}/api/assistant/worker`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error("Assistant service unavailable.");
  return response.json();
}
void runAssistantWorker({api,stream:streamCodex,wake,signal:stop.signal,once:process.argv.includes("--once"),
  log:phase=>console.log("afterimage.assistant-worker",{phase})}).catch(()=>{
    console.error("afterimage.assistant-worker",{phase:"stopped",errorName:"Error"});process.exitCode=1;
  });
