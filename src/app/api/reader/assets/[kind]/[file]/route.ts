import { readFile } from "node:fs/promises";
import path from "node:path";
import { authenticated } from "@/lib/auth";
export const runtime="nodejs";
/** Serve only the pinned PDF renderer's public support assets, never arbitrary paths. */
export async function GET(_request:Request,{params}:{params:Promise<{kind:string;file:string}>}){
  if(!(await authenticated()))return new Response(null,{status:401});
  const {kind,file}=await params;
  if(!["cmaps","standard_fonts","wasm"].includes(kind)||!/^[-a-zA-Z0-9_]+\.(?:bcmap|pfb|ttf|wasm)$/.test(file))return new Response(null,{status:404});
  try{const bytes=await readFile(path.join(process.cwd(),"node_modules/pdfjs-dist",kind,file));return new Response(new Uint8Array(bytes),{headers:{"Content-Type":file.endsWith(".wasm")?"application/wasm":"application/octet-stream","Cache-Control":"private, max-age=86400","X-Content-Type-Options":"nosniff"}});}catch{return new Response(null,{status:404});}
}
