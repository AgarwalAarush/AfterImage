import { randomUUID } from "node:crypto";
import { workerAuth } from "@/lib/auth";
import { assistantSnapshot, mutate } from "@/lib/store";
import { assistantContext, expireAssistant, terminal } from "@/lib/assistant";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){
  if(!workerAuth(req))return Response.json({error:"Unauthorized"},{status:401});
  try{
    const text=await req.text();if(text.length>70000)throw new Error("Update too large");const b=JSON.parse(text);
    if(b.action==="claim"){
      const requests=await assistantSnapshot(),now=Date.now();
      const expired=requests.some(r=>r.status==="queued"?now-Date.parse(r.createdAt)>120000:
        r.status==="running"&&Date.parse(r.leaseUntil||"")<now);
      if(!expired&&(!requests.some(r=>r.status==="queued")||requests.some(r=>r.status==="running")))
        return Response.json({request:null},{headers:{"Cache-Control":"no-store"}});
    }
    const result=await mutate(s=>{
      const requests=s.assistantRequests||[];expireAssistant(requests);const now=new Date().toISOString();
      if(b.action==="claim"){
        if(requests.some(r=>r.status==="running"))return {request:null};
        const r=requests.find(r=>r.status==="queued");if(!r)return {request:null};
        const p=s.papers.find(p=>p.id===r.paperId);if(!p){r.status="failed";return {request:null};}
        r.status="running";r.leaseToken=randomUUID();r.leaseUntil=new Date(Date.now()+45000).toISOString();r.updatedAt=now;
        return {request:r,context:assistantContext(p,requests,r)};
      }
      const r=requests.find(r=>r.id===b.id);
      if(!r||terminal(r)||r.leaseToken!==b.leaseToken) return {cancelled:true};
      if(b.action==="update"||b.action==="complete"){
        if(typeof b.answer!=="string"||b.answer.length>32000)throw new Error("Invalid reply");
        // Cumulative deltas make retried updates idempotent; stale updates cannot truncate a reply.
        if(b.answer.length>=r.answer.length)r.answer=b.answer;
        if(b.action==="complete"){if(!r.answer.trim())throw new Error("Empty answer");r.status="complete";delete r.leaseToken;}
      }else if(b.action==="fail"){r.status="failed";r.error="The assistant could not finish. Your partial reply is preserved; you can try again.";delete r.leaseToken;}
      else if(b.action!=="heartbeat")throw new Error("Unknown action");
      r.updatedAt=now;r.leaseUntil=new Date(Date.now()+45000).toISOString();return {ok:true};
    });return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(e){return Response.json({error:(e as Error).message},{status:400});}
}
