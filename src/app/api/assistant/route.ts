import { authenticated, sameOrigin } from "@/lib/auth";
import { snapshot } from "@/lib/store";
import { assistantStore } from "@/lib/assistant-storage";
import { assistantTargetSchema, conversationAskSchema, isActiveTurn, type AssistantTurn } from "@/lib/assistant-model";
import { assistantEvidence } from "@/lib/assistant-evidence";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
export async function POST(req:Request){
  if(!(await authenticated()))return Response.json({error:"Sign in to use the assistant."},{status:401});
  if(!sameOrigin(req))return Response.json({error:"Invalid origin"},{status:403});
  try{
    const text=await req.text();if(text.length>14000)return Response.json({error:"Question is too long."},{status:413});
    const body=JSON.parse(text);
    if(body.action==="cancel")return Response.json(await assistantStore({op:"cancel",id:body.id}),{headers});
    // Existing open reader tabs may still submit the previous paper-only shape.
    const input=conversationAskSchema.parse(body.paperId&&!body.target
      ?{...body,target:{kind:"paper",id:body.paperId},conversationId:`legacy-${body.paperId}`}:body);
    const existing=await assistantStore<AssistantTurn|null>({op:"get",id:input.id});
    if(existing){
      const history=await assistantStore<{conversation:{target:{kind:string;id:string}}}>({op:"turns",conversationId:existing.conversationId});
      if(existing.conversationId!==input.conversationId||existing.question!==input.question||existing.selection!==input.selection||history.conversation.target.kind!==input.target.kind||history.conversation.target.id!==input.target.id)return Response.json({error:"Request identifier is already in use."},{status:409,headers});
      return Response.json(existing,{headers});
    }
    const evidence=await assistantEvidence(input.target);
    return Response.json(await assistantStore({op:"enqueue",input,evidence}),{headers});
  }catch{return Response.json({error:"Could not save this question. Check the chat before trying again."},{status:400,headers});}
}
export async function GET(req:Request){
  if(!(await authenticated()))return Response.json({error:"Sign in to use the assistant."},{status:401});
  const url=new URL(req.url),id=url.searchParams.get("id"),conversationId=url.searchParams.get("conversationId");
  try{
    const legacyPaper=url.searchParams.get("paperId");
    if(legacyPaper&&!id&&!conversationId){
      const ids=url.searchParams.getAll("sourceIds"),single=url.searchParams.get("sourceId");
      if(ids.length||single){
        const requested=single?[single]:ids;
        if(requested.length>24||requested.some(value=>value.length>160))return Response.json({error:"Invalid source request."},{status:400,headers});
        const sources=(await snapshot()).data.papers.find(p=>p.id===legacyPaper)?.sources.filter(source=>requested.includes(source.id))||[];
        return Response.json(single?sources[0]||null:sources,{headers});
      }
      const page=await assistantStore<{items:AssistantTurn[]}|null>({op:"turns",conversationId:`legacy-${legacyPaper}`});
      return Response.json(page?.items||[],{headers});
    }
    if(id&&url.searchParams.has("sourceId")){
      const source=await assistantStore({op:"source",id,sourceId:url.searchParams.get("sourceId")!});return Response.json(source,{status:source?200:404,headers});
    }
    if(id&&url.searchParams.get("stream")!=="1"&&!req.headers.get("accept")?.includes("text/event-stream"))return Response.json(await assistantStore({op:"get",id}),{headers});
    if(!id){
      if(conversationId)return Response.json(await assistantStore({op:"turns",conversationId,before:url.searchParams.get("before")||undefined}),{headers});
      const target=assistantTargetSchema.parse({kind:url.searchParams.get("kind"),id:url.searchParams.get("targetId")});
      return Response.json(await assistantStore({op:"list",target,cursor:url.searchParams.get("cursor")||undefined}),{headers});
    }
    const encoder=new TextEncoder();let cancelled=false;
    const stream=new ReadableStream({async start(controller){
      const deadline=Date.now()+25000;let previous="";
      const emit=(event:string,data:unknown)=>{if(!cancelled)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));};
      try{while(!cancelled&&!req.signal.aborted&&Date.now()<deadline){
        const turn=await assistantStore<AssistantTurn|null>({op:"get",id});if(!turn){emit("fault",{error:"Chat could not be loaded."});break;}
        const next=JSON.stringify(turn);if(next!==previous){emit("reply",turn);previous=next;}if(!isActiveTurn(turn))break;
        await new Promise(resolve=>setTimeout(resolve,700));
      }}catch{emit("fault",{error:"Connection interrupted. Reconnecting…"});}finally{if(!cancelled)controller.close();}
    },cancel(){cancelled=true;}});
    return new Response(stream,{headers:{...headers,"Content-Type":"text/event-stream","X-Accel-Buffering":"no"}});
  }catch{return Response.json({error:"Could not load this chat."},{status:400,headers});}
}
