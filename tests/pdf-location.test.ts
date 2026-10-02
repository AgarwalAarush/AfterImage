import {test} from "node:test";
import assert from "node:assert/strict";
import {locatePdfSource,normalizePdfText} from "../src/lib/pdf-location";
import {arxivResource,fetchArxiv} from "../src/lib/assistant-evidence";
test("PDF passage matching tolerates ligatures and refuses ambiguous locations",()=>{
 const excerpt="The efficient attention mechanism computes exact outputs while avoiding the storage of the full matrix.";
 const source={label:"2. Efficient attention",excerpt};
 assert.equal(locatePdfSource([{page:2,text:excerpt.replace("efficient","efﬁcient")}],source)?.page,2);
 assert.equal(locatePdfSource([{page:2,text:excerpt},{page:4,text:excerpt}],{...source,label:"Section"}),null);
 assert.equal(locatePdfSource([{page:2,text:"Different scientific content"}],source),null);
 assert.equal(normalizePdfText("repre-\nsentation"),"representation");
});
test("reader only constructs canonical arXiv URLs",()=>{
 assert.equal(arxivResource("2503.01840v2","pdf").href,"https://arxiv.org/pdf/2503.01840v2");
 for(const id of ["https://example.com/file","../secret","2503.01840?x=1","2503.01840#S1"])assert.throws(()=>arxivResource(id,"pdf"));
});
test("reader rejects redirects to another host and bounds streamed bytes",async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:"https://example.com/file.pdf"}});
  await assert.rejects(()=>fetchArxiv("2503.01840","pdf",100),/redirect/);
  globalThis.fetch=async()=>new Response("%PDF-"+"x".repeat(200));
  await assert.rejects(()=>fetchArxiv("2503.01840","pdf",100),/size limit/);
  globalThis.fetch=async()=>new Response("<html>Unavailable</html>");
  await assert.rejects(()=>fetchArxiv("2503.01840","pdf",100),/PDF/);
 }finally{globalThis.fetch=original;}
});
