import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { AssistantDatabase } from "../src/lib/assistant-storage";
import { initialState } from "../src/lib/catalog";
import type { AssistantEvidence, AssistantTurn, Conversation } from "../src/lib/assistant-model";
const now=Date.parse("2026-10-02T12:00:00Z");
const evidence:AssistantEvidence={title:"Test paper",arxivId:"2503.01840",digest:"a".repeat(64),sources:[{id:"s1",label:"Model architecture",url:"https://arxiv.org/html/2503.01840#S2",excerpt:"Primary evidence",kind:"paper"}],material:{},scope:"full-text"};
function input(conversationId=randomUUID(),kind:"paper"|"subject"="paper"){return {action:"ask" as const,id:randomUUID(),conversationId,target:{kind,id:kind==="paper"?"2503.01840":"attention-is-all-you-need"},question:"Explain the mechanism",selection:"A selected passage"};}
function store(){return new AssistantDatabase(new DatabaseSync(":memory:"));}
function finish(db:AssistantDatabase,time=now){const claimed=db.execute({op:"claim"},time) as {request:{id:string;leaseToken:string};context:unknown};assert.ok(claimed.request);db.execute({op:"update",action:"complete",id:claimed.request.id,leaseToken:claimed.request.leaseToken,answer:"A grounded answer [source:s1]"},time+1);return claimed;}
test("legacy migration is transactional, repeatable and preserves every retained turn",()=>{
 const sql=new DatabaseSync(":memory:"),state=initialState(),at=new Date(now).toISOString();
 state.assistantRequests=Array.from({length:100},(_,index)=>({id:randomUUID(),paperId:state.papers[index%2].id,question:`Question ${index}`,selection:"quote",status:"complete",answer:`Answer ${index}`,createdAt:at,updatedAt:at}));
 sql.exec("CREATE TABLE state (id INTEGER, data TEXT)");sql.prepare("INSERT INTO state VALUES(1,?)").run(JSON.stringify(state));
 const db=new AssistantDatabase(sql);new AssistantDatabase(sql);
 assert.equal(sql.prepare("SELECT count(*) n FROM assistant_turns").get()!.n,100);assert.equal(sql.prepare("SELECT count(*) n FROM assistant_conversations").get()!.n,2);
 for(const old of state.assistantRequests){const next=db.execute({op:"get",id:old.id},now) as AssistantTurn;assert.equal(next.answer,old.answer);assert.equal(next.selection,old.selection);assert.equal(next.id,old.id);}
});
test("new chats isolate context, preserve evidence, resume, and deduplicate requests",()=>{
 const db=store(),first=input(),second=input();
 const reply=db.execute({op:"enqueue",input:first,evidence},now) as AssistantTurn;
 assert.equal(db.execute({op:"enqueue",input:first,evidence},now) instanceof Object,true);
 assert.throws(()=>db.execute({op:"enqueue",input:{...first,question:"Changed"},evidence},now),/identifier/);
 assert.throws(()=>db.execute({op:"enqueue",input:input(first.conversationId),evidence},now),/progress/);
 finish(db);db.execute({op:"enqueue",input:second,evidence},now+2);
 const isolated=finish(db,now+3) as {context:{history:unknown[]}};assert.equal(isolated.context.history.length,0);
 db.execute({op:"enqueue",input:{...input(first.conversationId),question:"Continue"},evidence:{...evidence,digest:"b".repeat(64)}},now+4);
 const resumed=finish(db,now+5) as {context:{history:{answer:string;evidenceDigest:string}[]}};assert.equal(resumed.context.history.length,1);assert.equal(resumed.context.history[0].evidenceDigest,evidence.digest);
 assert.equal(JSON.stringify(reply).includes("Primary evidence"),false);assert.equal(JSON.stringify(reply).includes("leaseToken"),false);
 assert.equal((db.execute({op:"source",id:first.id,sourceId:"s1"},now) as {excerpt:string}).excerpt,"Primary evidence");
});
test("Subjects works independently, target mismatches fail, leases and cancellation are enforced",()=>{
 const db=store(),request=input(undefined,"subject");db.execute({op:"enqueue",input:request,evidence:{...evidence,lessonDigest:"lesson-v1"}},now);
 const claim=db.execute({op:"claim"},now) as {request:{id:string;leaseToken:string}};
 assert.deepEqual(db.execute({op:"update",action:"complete",id:request.id,leaseToken:randomUUID(),answer:"Wrong"},now),{cancelled:true});
 db.execute({op:"update",action:"update",...claim.request,answer:"Partial response"},now+1);
 db.execute({op:"update",action:"update",...claim.request,answer:"Short"},now+2);
 assert.equal((db.execute({op:"get",id:request.id},now+3) as AssistantTurn).answer,"Partial response");
 db.execute({op:"cancel",id:request.id},now+4);
 assert.equal((db.execute({op:"get",id:request.id},now+5) as AssistantTurn).status,"cancelled");
 assert.throws(()=>db.execute({op:"enqueue",input:{...input(request.conversationId),target:{kind:"paper",id:"different"}},evidence},now+6),/target/);
 assert.deepEqual(db.execute({op:"update",action:"complete",...claim.request,answer:"Late reply"},now+7),{cancelled:true});
});
test("history paginates without deleting chats and expired work is not requeued",()=>{
 const db=store(),requests=[];
 for(let i=0;i<45;i++){const request=input();requests.push(request);const time=now+i*3600001;db.execute({op:"enqueue",input:request,evidence},time);finish(db,time);}
 const first=db.execute({op:"list",target:requests[0].target},now) as {items:Conversation[];nextCursor:string};
 assert.equal(first.items.length,20);const second=db.execute({op:"list",target:requests[0].target,cursor:first.nextCursor},now) as {items:Conversation[];nextCursor:string};assert.equal(second.items.length,20);
 const third=db.execute({op:"list",target:requests[0].target,cursor:second.nextCursor},now) as {items:Conversation[]};assert.equal(third.items.length,5);
 const stale=input();db.execute({op:"enqueue",input:stale,evidence},now+100*3600000);assert.equal((db.execute({op:"get",id:stale.id},now+100*3600000+120001) as AssistantTurn).status,"failed");
 assert.deepEqual(db.execute({op:"claim"},now+100*3600000+120002),{request:null});
});
test("SQLite backup and restore includes chats, turns and their bound evidence",async()=>{
 const {mkdtempSync,rmSync}=await import("node:fs"),{tmpdir}=await import("node:os"),{join}=await import("node:path");const directory=mkdtempSync(join(tmpdir(),"assistant-restore-"));
 try{const db=store(),request=input();db.execute({op:"enqueue",input:request,evidence},now);finish(db);const file=join(directory,"backup.sqlite");db.db.exec(`VACUUM INTO '${file.replaceAll("'","''")}'`);const restored=new AssistantDatabase(new DatabaseSync(file));assert.equal((restored.execute({op:"get",id:request.id},now) as AssistantTurn).answer,"A grounded answer [source:s1]");assert.equal((restored.execute({op:"source",id:request.id,sourceId:"s1"},now) as {excerpt:string}).excerpt,"Primary evidence");restored.db.close();db.db.close();}finally{rmSync(directory,{recursive:true,force:true});}
});
