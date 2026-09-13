import { spawn } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { assistantInstructions } from "../src/lib/assistant";

/** An independent, tool-disabled Codex app-server over stdio. No listening socket. */
export async function streamCodex(context: unknown, onText: (text:string)=>void, signal: AbortSignal) {
  const runtime=path.resolve(".assistant-runtime"),work=path.join(runtime,"work");
  await mkdir(work,{recursive:true,mode:0o700});
  // Reuse the owner's existing ChatGPT login, with a separate config/runtime (no plugins or MCPs).
  try {await symlink(path.join(os.homedir(),".codex/auth.json"),path.join(runtime,"auth.json"));} catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;}
  await writeFile(path.join(runtime,"config.toml"),`approval_policy = "never"
sandbox_mode = "read-only"
web_search = "disabled"
[features]
shell_tool = false
unified_exec = false
apps = false
plugins = false
remote_plugin = false
browser_use = false
browser_use_external = false
computer_use = false
in_app_browser = false
image_generation = false
multi_agent = false
multi_agent_v2 = false
code_mode_host = false
memories = false
hooks = false
skill_search = false
tool_suggest = false
[analytics]
enabled = false
`,{mode:0o600});
  const child=spawn(process.env.CODEX_BIN||"codex",["app-server","--stdio"],{
    cwd:work,stdio:["pipe","pipe","pipe"],env:{NODE_ENV:"production",HOME:os.homedir(),CODEX_HOME:runtime,PATH:"/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin",LANG:"en_US.UTF-8",TMPDIR:os.tmpdir()},
  });
  let seq=0,answer="",settled=false,stderr="";
  const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
  let doneResolve:()=>void=()=>{},doneReject:(e:Error)=>void=()=>{};
  const done=new Promise<void>((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});
  // Register immediately so early startup failures cannot become unhandled rejections.
  void done.catch(()=>{});
  const finish=(error?:Error)=>{if(settled)return;settled=true;for(const p of pending.values())p.reject(error||new Error("Codex ended"));pending.clear();error?doneReject(error):doneResolve();};
  const send=(v:unknown)=>child.stdin.write(JSON.stringify(v)+"\n");
  const rpc=(method:string,params:unknown)=>new Promise<any>((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});send({id,method,params});});
  const stop=()=>{child.kill("SIGTERM");setTimeout(()=>child.kill("SIGKILL"),2000).unref();finish(new Error("Cancelled"));};
  signal.addEventListener("abort",stop,{once:true});
  const timer=setTimeout(stop,180000);
  const phases=new Map<string,string>();
  const lines=createInterface({input:child.stdout});
  lines.on("line",line=>{
    try{
      const m=JSON.parse(line);
      if(m.id!==undefined&&!m.method){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}return;}
      if(m.id!==undefined&&m.method){send({id:m.id,error:{code:-32601,message:"Tools and approvals are unavailable in this reader."}});finish(new Error("Unexpected tool request"));child.kill();return;}
      const p=m.params;
      if(m.method==="item/started"){
        const item=p.item;
        if(!["agentMessage","userMessage","reasoning"].includes(item.type)){finish(new Error("Unexpected tool activity"));child.kill();return;}
        if(item.type==="agentMessage")phases.set(item.id,item.phase||"final_answer");
      }
      if(m.method==="item/agentMessage/delta"&&phases.get(p.itemId)!=="commentary"){
        answer+=p.delta;if(answer.length>32000){finish(new Error("Reply exceeded limit"));child.kill();return;}onText(answer);
      }
      if(m.method==="turn/completed")p.turn.status==="completed"?finish():finish(new Error(p.turn.error?.message||"Codex turn failed"));
    }catch(e){finish(e as Error);}
  });
  child.stderr.on("data",b=>{stderr=(stderr+b.toString()).slice(-1000);});
  child.on("error",finish);child.on("close",code=>{if(!settled)finish(new Error(`Codex closed (${code}): ${stderr.slice(-200)}`));});
  try{
    if(signal.aborted)throw new Error("Cancelled");
    await rpc("initialize",{clientInfo:{name:"afterimage_reader",version:"1.0.0"},capabilities:{experimentalApi:false}});
    send({method:"initialized",params:{}});
    const started=await rpc("thread/start",{cwd:work,ephemeral:true,sandbox:"read-only",approvalPolicy:"never",baseInstructions:assistantInstructions});
    await rpc("turn/start",{threadId:started.thread.id,input:[{type:"text",text:JSON.stringify(context),text_elements:[]}],effort:"low",summary:"none"});
    await done;
    if(!answer.trim())throw new Error("Codex returned no text");
    return answer;
  }finally{clearTimeout(timer);signal.removeEventListener("abort",stop);lines.close();child.kill("SIGTERM");setTimeout(()=>child.kill("SIGKILL"),2000).unref();}
}
