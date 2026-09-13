import {test} from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/lib/catalog";
import { askSchema, enqueueAssistant, expireAssistant, assistantContext } from "../src/lib/assistant";
import { publicState } from "../src/lib/public-state";
const id="2c532dd6-3fd8-4e9d-9196-c29dd54aff8c";
test("assistant requests are idempotent and exclude secrets from browser/library views",()=>{
 const s=initialState(),input=askSchema.parse({action:"ask",id,paperId:s.papers[0].id,question:"Explain this",selection:"A passage"});
 const r=enqueueAssistant(s,input);enqueueAssistant(s,input);assert.equal(s.assistantRequests?.length,1);assert.equal(r.question,"Explain this");
 assert.throws(()=>enqueueAssistant(s,{...input,question:"Different"}),/identifier/);
 s.assistantRequests![0].leaseToken="private";assert.equal(publicState(s).assistantRequests,undefined);
});
test("expired jobs fail without silently rerunning credit-consuming turns",()=>{const s=initialState();enqueueAssistant(s,askSchema.parse({action:"ask",id,paperId:s.papers[0].id,question:"Explain"}),0);expireAssistant(s.assistantRequests!,120001);assert.equal(s.assistantRequests![0].status,"failed");});
test("quotas count cancelled/failed work and context comes from canonical paper",()=>{
 const s=initialState(),p=s.papers[0],now=Date.now();s.assistantRequests=Array.from({length:20},(_,i)=>({id:String(i),paperId:p.id,question:"q",selection:"",answer:"",status:"cancelled",createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()}));
 assert.throws(()=>enqueueAssistant(s,askSchema.parse({action:"ask",id,paperId:p.id,question:"Q"}),now),/limit/);
 assert.equal(assistantContext(p,s.assistantRequests,s.assistantRequests[0]).paper.title,p.title);
 assert.throws(()=>askSchema.parse({action:"ask",id,paperId:p.id,question:"x".repeat(3001)}));
});
