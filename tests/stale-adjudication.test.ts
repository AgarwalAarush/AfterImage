import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { repairCandidate, RepairFailure, type RepairDefect, type RepairContext } from "../worker/repair-controller";

const schema=z.object({text:z.string()}),candidate={text:"The exact source-supported result is already present."};
const demand:RepairDefect={id:"demand",category:"scientific-source-demand",owner:"content",targets:["/text"],sourceIds:["source"],evidence:"A reviewer disputes the unchanged supported text.",acceptance:"The text agrees with the exact source."};
const receipt=(ctx:RepairContext)=>({defect:{...demand},candidate:ctx.fingerprint,binding:ctx.binding!,rationale:"The source supports the unchanged result.",support:[{sourceId:"source",passage:"The exact source-supported result is already present."}]});
const noEdit=async()=>{throw Error("No edit or automatic source-dispute waiver is permitted");};

for(const variant of ["binding-change","scope-change"] as const) test(`stale adjudication remains history without blocking fresh ordinary verification (${variant})`,async()=>{
 const inputs={sourceEpoch:0};let reviews=0;
 const result=await repairCandidate(candidate,{schema,binding:inputs,maxRepairs:0,record:async()=>{},validate:()=>{},edit:noEdit,replan:noEdit,review:async(_c,ctx)=>{
  reviews++;
  if(reviews===1)return{defects:[],verified:[],complete:false,refresh:true,adjudications:[receipt(ctx)]};
  if(reviews===2){
   if(variant==="binding-change")inputs.sourceEpoch++;
   return{defects:variant==="scope-change"?[{...demand,acceptance:"The text agrees with the exact source and preserves its domain."}]:[],verified:[],complete:false,refresh:true};
  }
  assert.equal(ctx.adjudications?.length,0,"A binding- or scope-stale receipt must not be presented as current");
  assert.ok(ctx.obligations[0].adjudication,"The historical receipt remains auditable");
  return{defects:[],complete:true,verified:ctx.obligations.map(d=>({id:d.id,resolved:true,resolution:"same-representation" as const,evidence:"Independent current source review verified the complete current obligation without using stale adjudication."}))};
 }});
 assert.equal(reviews,3);assert.deepEqual(result.candidate,candidate);assert.equal(result.ledger[0].status,"resolved");
});

test("a current adjudication still requires explicit adjudication verification",async()=>{
 let reviews=0;
 await assert.rejects(repairCandidate(candidate,{schema,maxRepairs:0,record:async()=>{},validate:()=>{},edit:noEdit,replan:noEdit,review:async(_c,ctx)=>++reviews===1?{defects:[],verified:[],complete:false,refresh:true,adjudications:[receipt(ctx)]}:{defects:[],complete:true,verified:ctx.obligations.map(d=>({id:d.id,resolved:true,resolution:"same-representation" as const,evidence:"Ordinary verification cannot bypass a current source adjudication."}))}}),/explicit current adjudication/);
});

test("a current adjudication cannot close a still-blocking fresh finding",async()=>{
 let reviews=0;
 await assert.rejects(repairCandidate(candidate,{schema,maxRepairs:0,record:async()=>{},validate:()=>{},edit:noEdit,replan:noEdit,review:async(_c,ctx)=>++reviews===1?{defects:[],verified:[],complete:false,refresh:true,adjudications:[receipt(ctx)]}:{defects:[demand],complete:false,verified:ctx.obligations.map(d=>({id:d.id,resolved:true,resolution:"adjudication" as const,evidence:"A receipt cannot override the still-failing fresh review."}))}}),/passing fresh review/);
});

test("omitting verification never automatically closes a disputed obligation",async()=>{
 let reviews=0;
 await assert.rejects(repairCandidate(candidate,{schema,maxRepairs:0,record:async()=>{},validate:()=>{},edit:noEdit,replan:noEdit,review:async(_c,ctx)=>++reviews===1?{defects:[],verified:[],complete:false,refresh:true,adjudications:[receipt(ctx)]}:{defects:[],complete:true,verified:[]}}),(e:unknown)=>e instanceof RepairFailure&&e.ledger.some(d=>d.id===demand.id&&d.status==="disputed"));
});
