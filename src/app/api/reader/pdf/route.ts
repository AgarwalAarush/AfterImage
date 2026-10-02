import { authenticated } from "@/lib/auth";
import { assistantTargetSchema } from "@/lib/assistant-model";
import { fetchArxiv, resolveAssistantTarget } from "@/lib/assistant-evidence";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req:Request){
  if(!(await authenticated()))return Response.json({error:"Sign in to read the paper."},{status:401});
  try{
    const params=new URL(req.url).searchParams;
    const target=assistantTargetSchema.parse({kind:params.get("kind"),id:params.get("targetId")});
    const {arxivId}=await resolveAssistantTarget(target);
    const pdf=await fetchArxiv(arxivId,"pdf",32*1024*1024);
    // A stream avoids the platform's buffered response payload limit. The
    // upstream resource is already bounded and hashed before sending headers.
    let offset=0;
    const stream=new ReadableStream<Uint8Array>({pull(controller){
      if(offset>=pdf.body.length){controller.close();return;}
      const end=Math.min(offset+64*1024,pdf.body.length);
      controller.enqueue(new Uint8Array(pdf.body.subarray(offset,end)));offset=end;
    }});
    return new Response(stream,{headers:{"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Paper-Digest":pdf.digest,"X-Paper-Source":pdf.url,"Content-Disposition":`inline; filename="${arxivId.replaceAll("/","-")}.pdf"`}});
  }catch{return Response.json({error:"The PDF could not be loaded. You can open the original source."},{status:502});}
}
