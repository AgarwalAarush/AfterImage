import { authenticated, sameOrigin } from "@/lib/auth";
import { mutate, assistantSnapshot, snapshot } from "@/lib/store";
import { askSchema, enqueueAssistant, terminal, visibleRequest, expireAssistant } from "@/lib/assistant";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  if (!(await authenticated())) return Response.json({error:"Sign in to ask about your paper."},{status:401});
  if (!sameOrigin(req)) return Response.json({error:"Invalid origin"},{status:403});
  try {
    const text = await req.text();
    if (text.length > 12000) return Response.json({error:"Question is too long."},{status:413});
    const body = JSON.parse(text);
    if (body.action === "cancel") {
      await mutate(s=>{const r=s.assistantRequests?.find(r=>r.id===body.id); if(r&&!terminal(r)){r.status="cancelled";r.updatedAt=new Date().toISOString();delete r.leaseToken;}});
      return Response.json({ok:true},{headers});
    }
    const input=askSchema.parse(body);
    return Response.json(await mutate(s=>enqueueAssistant(s,input)),{headers});
  } catch(e) { return Response.json({error:(e as Error).message},{status:400,headers}); }
}
export async function GET(req: Request) {
  if (!(await authenticated())) return Response.json({error:"Sign in to your library."},{status:401});
  const url=new URL(req.url),id=url.searchParams.get("id"),paperId=url.searchParams.get("paperId");
  const sourceId=url.searchParams.get("sourceId");
  const sourceIds=url.searchParams.getAll("sourceIds");
  if(sourceIds.length){
    if(sourceIds.length>24||sourceIds.some(id=>id.length>160))return Response.json({error:"Too many sources requested"},{status:400,headers});
    const sources=(await snapshot()).data.papers.find(p=>p.id===paperId)?.sources||[];
    return Response.json(sources.filter(s=>sourceIds.includes(s.id)),{headers});
  }
  if(sourceId){const source=(await snapshot()).data.papers.find(p=>p.id===paperId)?.sources.find(s=>s.id===sourceId);return source?Response.json(source,{headers}):Response.json({error:"Source not found"},{status:404});}
  if (!id) return Response.json((await assistantSnapshot()).filter(r=>r.paperId===paperId).slice(-24).map(visibleRequest),{headers});
  const encoder=new TextEncoder();
  let cancelled=false;
  const stream=new ReadableStream({
    async start(controller) {
      const deadline=Date.now()+25000; let previous="";
      const emit=(name:string,data:unknown)=>{if(!cancelled)controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));};
      try {
        while(!cancelled&&!req.signal.aborted&&Date.now()<deadline){
          const records=await assistantSnapshot(); const r=records.find(r=>r.id===id);
          if(!r){emit("fault",{error:"Conversation not found."});break;}
          if(!terminal(r) && (r.status==="queued" ? Date.now()-Date.parse(r.createdAt)>120000 : Date.parse(r.leaseUntil||"")<Date.now())) {
            await mutate(s=>expireAssistant(s.assistantRequests||[])); continue;
          }
          const data=visibleRequest(r),serialized=JSON.stringify(data);
          if(serialized!==previous){emit("reply",data);previous=serialized;}
          if(terminal(r))break;
          await new Promise(r=>setTimeout(r,700));
        }
      } catch { emit("fault",{error:"Connection interrupted. Reconnecting…"}); }
      finally {if(!cancelled)controller.close();}
    }, cancel(){cancelled=true;},
  });
  return new Response(stream,{headers:{...headers,"Content-Type":"text/event-stream","X-Accel-Buffering":"no","Connection":"keep-alive"}});
}
