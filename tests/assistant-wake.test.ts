import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { AssistantDatabase } from "../src/lib/assistant-storage";
import { AssistantWakeServer } from "../scripts/assistant-wake-server";
import { AssistantWakeClient, type WakeSource, type WakeSignal } from "../worker/assistant-wake";
import { runAssistantWorker, type WorkerCommand, type WorkerReply } from "../worker/assistant-runtime";

const token="dedicated-test-wake-credential-32-bytes";
const evidence={title:"Test paper",arxivId:"2503.01840",digest:"a".repeat(64),sources:[],material:{},scope:"fixture"};
function enqueue(db:AssistantDatabase,now=Date.now()) {
  const input={action:"ask" as const,id:randomUUID(),conversationId:randomUUID(),target:{kind:"paper" as const,id:"2503.01840"},question:"Fixture question",selection:""};
  db.execute({op:"enqueue",input,evidence},now);return input.id;
}
function apiFor(db:AssistantDatabase,commands:WorkerCommand[],hub?:AssistantWakeServer) {
  return async (command:WorkerCommand):Promise<WorkerReply>=>{
    commands.push(command);
    const result=db.execute(command.action==="claim"?{op:"claim"}:{op:"update",...command}) as WorkerReply;
    hub?.refresh(command.action==="complete"||command.action==="fail");return result;
  };
}
async function until(predicate:()=>boolean,timeout=1500) {
  const end=Date.now()+timeout;
  while(!predicate()){if(Date.now()>end)throw Error("Fixture condition timed out.");await delay(5);}
}
class FakeWake implements WakeSource {
  onWake:(kind?:WakeSignal)=>void=()=>{};onConnection=(_value:boolean)=>{};
  start(onWake:(kind:WakeSignal)=>void,onConnection:(value:boolean)=>void){this.onWake=(kind="ready")=>onWake(kind);this.onConnection=onConnection;onConnection(true);}
  stop(){};
}

test("readiness is content-free, read-only, and respects leases and queue expiry",()=>{
  const db=new AssistantDatabase(new DatabaseSync(":memory:")),now=Date.now();
  enqueue(db,now);const before=db.db.prepare("SELECT data FROM assistant_turns").get();
  assert.deepEqual(db.queueReadiness(now),{ready:true});assert.deepEqual(db.db.prepare("SELECT data FROM assistant_turns").get(),before);
  const claim=db.execute({op:"claim"},now) as {request:{id:string;leaseToken:string}};
  enqueue(db,now+1);assert.deepEqual(db.queueReadiness(now+2),{ready:false,recheckAt:now+45001});
  assert.deepEqual(db.queueReadiness(now+45001),{ready:true});
  db.execute({op:"cancel",id:claim.request.id},now+3);assert.deepEqual(db.queueReadiness(now+4),{ready:true});
  assert.deepEqual(db.queueReadiness(now+120002),{ready:false});db.db.close();
});

test("wake listener authenticates, binds only loopback, bounds subscribers, and reveals no content",async()=>{
  const hub=new AssistantWakeServer(token,()=>({ready:true}));await hub.listen(0);
  const address=hub.server.address();assert.ok(address&&typeof address!=="string");assert.equal(address.address,"127.0.0.1");
  const url=`http://127.0.0.1:${address.port}/internal/assistant/events`,controller=new AbortController();
  try {
    assert.equal((await fetch(url)).status,401);
    assert.equal((await fetch(url,{headers:{Authorization:"Bearer wrong"}})).status,401);
    assert.equal((await fetch(url,{method:"POST"})).status,405);
    assert.equal((await fetch(url.replace("/assistant/events","/storage"))).status,404);
    const headers={Authorization:`Bearer ${token}`};
    const a=await fetch(url,{headers,signal:controller.signal}),b=await fetch(url,{headers,signal:controller.signal});
    assert.equal((await fetch(url,{headers})).status,503);
    assert.equal(a.headers.get("cache-control"),"no-store");
    const reader=a.body!.getReader(),decoder=new TextDecoder();let text="";
    while(!text.includes("event: ready"))text+=decoder.decode((await reader.read()).value);
    assert.equal(text,"event: connected\ndata: {}\n\nevent: ready\ndata: {}\n\n");
    assert.equal(b.status,200);
  } finally {controller.abort();await hub.close();}
  for(const url of ["https://example.com/internal/assistant/events","http://localhost:3104/internal/assistant/events","http://127.0.0.1:3104/internal/storage","http://127.0.0.1:3104/internal/assistant/events?token=x"])assert.throws(()=>new AssistantWakeClient(url,token));
});

test("real stream wakes promptly, drains once, and reconciles queued work on reconnect",async()=>{
  const db=new AssistantDatabase(new DatabaseSync(":memory:"));
  let hub=new AssistantWakeServer(token,()=>db.queueReadiness());await hub.listen(0);
  const address=hub.server.address();assert.ok(address&&typeof address!=="string");
  const client=new AssistantWakeClient(`http://127.0.0.1:${address.port}/internal/assistant/events`,token);
  const stop=new AbortController(),commands:WorkerCommand[]=[];
  let online=false;const wake:WakeSource={start:(notify,connection)=>client.start(notify,value=>{online=value;connection(value);}),stop:()=>client.stop()};
  const worker=runAssistantWorker({api:command=>apiFor(db,commands,hub)(command),stream:async(_context,onText)=>{onText("Fixture answer");},wake,signal:stop.signal});
  try {
    await until(()=>online);await delay(40);assert.equal(commands.length,0);
    const start=Date.now(),id=enqueue(db);hub.refresh(true);hub.refresh(true);
    await until(()=>commands.some(c=>c.action==="complete"));assert.ok(Date.now()-start<1000);
    assert.equal(commands.filter(c=>c.action==="complete").length,1);
    assert.equal((db.execute({op:"get",id}) as {answer:string}).answer,"Fixture answer");
    await until(()=>commands.at(-1)?.action==="claim");
    await hub.close();await until(()=>!online);
    const queued=enqueue(db);
    hub=new AssistantWakeServer(token,()=>db.queueReadiness());await hub.listen(address.port);
    await until(()=>commands.filter(c=>c.action==="complete").length===2,3000);
    assert.equal((db.execute({op:"get",id:queued}) as {answer:string}).answer,"Fixture answer");
  } finally {stop.abort();await worker;await hub.close();db.db.close();}
});

test("healthy idle worker makes zero calls across five simulated minutes; offline recovery polls at 30 seconds",async context=>{
  context.mock.timers.enable({apis:["Date","setTimeout","setInterval"]});
  const wake=new FakeWake(),stop=new AbortController();let calls=0;
  const worker=runAssistantWorker({wake,signal:stop.signal,api:async()=>{calls++;return {request:null};},stream:async()=>{}});
  context.mock.timers.tick(300_000);await Promise.resolve();assert.equal(calls,0);
  wake.onConnection(false);context.mock.timers.tick(29_999);await Promise.resolve();assert.equal(calls,0);
  context.mock.timers.tick(1);for(let i=0;i<5;i++)await Promise.resolve();assert.equal(calls,1);
  wake.onConnection(true);context.mock.timers.tick(300_000);await Promise.resolve();assert.equal(calls,1);
  stop.abort();await worker;
});

test("real text batches remain fast; quiet model heartbeats renew leases without resending answer text",async context=>{
  context.mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:Date.now()});
  const db=new AssistantDatabase(new DatabaseSync(":memory:")),id=enqueue(db),wake=new FakeWake(),stop=new AbortController(),commands:WorkerCommand[]=[];
  let text:((value:string)=>void)|undefined,finish:()=>void=()=>{};
  const worker=runAssistantWorker({wake,signal:stop.signal,api:apiFor(db,commands),stream:async(_context,onText)=>{text=onText;await new Promise<void>(resolve=>{finish=resolve;});}});
  wake.onWake();for(let i=0;i<6;i++)await Promise.resolve();assert.ok(text);
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  try {
    text("Partial");context.mock.timers.tick(650);await settle();assert.equal(commands.at(-1)?.action,"update");
    context.mock.timers.tick(4550);await settle();assert.equal(commands.filter(c=>c.action==="heartbeat").length,0);
    context.mock.timers.tick(650);await settle();assert.equal(commands.filter(c=>c.action==="heartbeat").length,1);
    assert.equal(commands.find(c=>c.action==="heartbeat"&&"answer" in c),undefined);
    for(let i=0;i<9;i++){context.mock.timers.tick(5200);await settle();}
    assert.equal((db.execute({op:"get",id}) as {status:string}).status,"running");
    text("Final answer");finish();await settle();
    assert.equal((db.execute({op:"get",id}) as {answer:string;status:string}).answer,"Final answer");
    assert.equal((db.execute({op:"get",id}) as {status:string}).status,"complete");
  } finally {stop.abort();finish();await worker;db.db.close();}
});

test("cancellation wakes the active worker immediately and preserves partial text",async()=>{
  const db=new AssistantDatabase(new DatabaseSync(":memory:")),id=enqueue(db),wake=new FakeWake(),stop=new AbortController(),commands:WorkerCommand[]=[];
  let started=false,aborted=false;
  const worker=runAssistantWorker({wake,signal:stop.signal,api:apiFor(db,commands),stream:async(_context,onText,signal)=>{
    onText("Partial answer");started=true;
    await new Promise<void>((_resolve,reject)=>signal.addEventListener("abort",()=>{aborted=true;reject(Error("cancelled"));},{once:true}));
  }});
  try {
    wake.onWake();await until(()=>started);await until(()=>commands.some(c=>c.action==="update"));
    db.execute({op:"cancel",id});const start=Date.now();wake.onWake("check");await until(()=>aborted);
    assert.ok(Date.now()-start<250);assert.equal(commands.filter(c=>c.action==="complete").length,0);
    const turn=db.execute({op:"get",id}) as {status:string;answer:string};assert.equal(turn.status,"cancelled");assert.equal(turn.answer,"Partial answer");
  } finally {stop.abort();await worker;db.db.close();}
});

test("uncertain claims stop recovery polling until a fresh durable readiness signal",async context=>{
  context.mock.timers.enable({apis:["Date","setTimeout","setInterval"]});
  const wake=new FakeWake(),stop=new AbortController();let calls=0;
  const worker=runAssistantWorker({wake,signal:stop.signal,api:async()=>{calls++;throw Error("lost claim");},stream:async()=>{}});
  wake.onWake();for(let i=0;i<5;i++)await Promise.resolve();assert.equal(calls,1);
  wake.onConnection(false);context.mock.timers.tick(300_000);await Promise.resolve();assert.equal(calls,1);
  wake.onWake("check");await Promise.resolve();assert.equal(calls,1);
  wake.onConnection(true);wake.onWake("ready");for(let i=0;i<5;i++)await Promise.resolve();assert.equal(calls,2);
  stop.abort();await worker;
});

test("lost completion response is never replayed or replaced with failure",async()=>{
  const db=new AssistantDatabase(new DatabaseSync(":memory:")),id=enqueue(db),commands:WorkerCommand[]=[];
  const api=apiFor(db,commands);
  await runAssistantWorker({once:true,signal:new AbortController().signal,api:async command=>{
    const result=await api(command);if(command.action==="complete")throw Error("lost response");return result;
  },stream:async(_context,onText)=>{onText("Persisted answer");}});
  assert.deepEqual(commands.map(c=>c.action),["claim","complete"]);
  assert.equal((db.execute({op:"get",id}) as {status:string}).status,"complete");db.db.close();
});
