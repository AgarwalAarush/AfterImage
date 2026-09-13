import { signSession } from "../src/lib/auth";
import { randomUUID } from "node:crypto";
async function main(){
 const base="https://afterimage.aarushagarwal.dev",cookie=`afterimage_session=${signSession()}`,headers={"Content-Type":"application/json",Cookie:cookie,Origin:base};
 const checks=[];
 for(const path of ["/api/assistant?paperId=2503.01840","/api/assistant?paperId=2503.01840&sourceId=s1"]){checks.push({path,status:(await fetch(base+path)).status});}
 checks.push({path:"anonymous question",status:(await fetch(base+"/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"action":"ask"}'})).status});
 checks.push({path:"worker auth",status:(await fetch(base+"/api/assistant/worker",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"action":"claim"}'})).status});
 checks.push({path:"cross-origin mutation",status:(await fetch(base+"/api/assistant",{method:"POST",headers:{...headers,Origin:"https://example.com"},body:'{"action":"ask"}'})).status});
 console.log(JSON.stringify({checks}));
 const id=randomUUID();const created=await fetch(base+"/api/assistant",{method:"POST",headers,body:JSON.stringify({action:"ask",id,paperId:"2503.01840",question:"Give a worked example following up on the token versus hidden-state distinction. Use a tiny illustrative vector and show the concatenation and projection with dimensions. Explain what changes on the next step and cite the original paper. About 250 words.",selection:""})});
 if(!created.ok)throw new Error(`Create ${created.status}`);
 const started=Date.now();let updates=0,first=0,last=0,done=false;
 while(!done&&Date.now()-started<180000){
  const r=await fetch(`${base}/api/assistant?id=${id}`,{headers:{Cookie:cookie},signal:AbortSignal.timeout(35000)});if(!r.ok)throw new Error(`Stream ${r.status}`);
  const reader=r.body!.getReader();let buffer="";const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});let cut:number;
   while((cut=buffer.indexOf("\n\n"))>=0){const event=buffer.slice(0,cut);buffer=buffer.slice(cut+2);if(!event.startsWith("event: reply"))continue;const value=JSON.parse(event.split("data: ")[1]);if(value.answer.length>last){last=value.answer.length;updates++;if(!first)first=Date.now();console.log(JSON.stringify({streamUpdate:updates,chars:last,ms:Date.now()-started,status:value.status}));}if(["complete","failed","cancelled"].includes(value.status)){done=true;console.log(JSON.stringify({finalStatus:value.status,updates,firstMs:first-started,citations:value.answer.match(/\[source:[^\]]+\]/g),id}));}}
  }
 }
 if(!done||updates<2)throw new Error("Did not observe multiple incremental response updates");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
