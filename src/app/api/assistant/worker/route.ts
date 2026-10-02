import { workerAuth } from "@/lib/auth";
import { assistantStore } from "@/lib/assistant-storage";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){
  if(!workerAuth(req))return Response.json({error:"Unauthorized"},{status:401});
  try{
    const text=await req.text();if(text.length>70000)throw Error();const body=JSON.parse(text);
    // A web-first release holds new work until the compatible worker arrives.
    if(body.action==="claim")return Response.json(body.protocol===2?await assistantStore({op:"claim"}):{request:null},{headers:{"Cache-Control":"no-store"}});
    return Response.json(await assistantStore({op:"update",id:body.id,leaseToken:body.leaseToken,action:body.action,answer:body.answer}),{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Invalid assistant update."},{status:400});}
}
