import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { AssistantDatabase } from "../src/lib/assistant-storage";
import { AssistantWakeServer } from "../scripts/assistant-wake-server";
import { AssistantWakeClient, type WakeSource } from "../worker/assistant-wake";
import { runAssistantWorker, type WorkerCommand, type WorkerReply } from "../worker/assistant-runtime";

test("five wall-clock minutes idle, then immediate durable-queue pickup",{skip:process.env.AFTERIMAGE_WAKE_SOAK!=="1",timeout:315_000},async()=>{
  const db=new AssistantDatabase(new DatabaseSync(":memory:")),token="isolated-soak-test-wake-token-32-bytes";
  const hub=new AssistantWakeServer(token,()=>db.queueReadiness());await hub.listen(0);
  const address=hub.server.address();assert.ok(address&&typeof address!=="string");
  const client=new AssistantWakeClient(`http://127.0.0.1:${address.port}/internal/assistant/events`,token);
  let online=false,connections=0;const commands:WorkerCommand[]=[],stop=new AbortController();
  const wake:WakeSource={start:(notify,connection)=>client.start(notify,value=>{online=value;if(value)connections++;connection(value);}),stop:()=>client.stop()};
  const worker=runAssistantWorker({wake,signal:stop.signal,api:async command=>{
    commands.push(command);const result=db.execute(command.action==="claim"?{op:"claim"}:{op:"update",...command}) as WorkerReply;
    hub.refresh(command.action==="complete"||command.action==="fail");return result;
  },stream:async(_context,onText)=>onText("Soak fixture answer")});
  try {
    const deadline=Date.now()+2000;while(!online){assert.ok(Date.now()<deadline);await delay(5);}
    console.log("Soak connected; observing five idle minutes using only synthetic data.");
    await delay(300_000);assert.equal(online,true);assert.equal(connections,1);assert.equal(commands.length,0);
    const started=Date.now(),id=randomUUID();
    db.execute({op:"enqueue",input:{action:"ask",id,conversationId:randomUUID(),target:{kind:"paper",id:"2503.01840"},question:"Synthetic soak question",selection:""},evidence:{title:"Fixture",arxivId:"2503.01840",digest:"a".repeat(64),sources:[],material:{},scope:"fixture"}});
    hub.refresh(true);while(!commands.some(c=>c.action==="complete")){assert.ok(Date.now()-started<1000);await delay(5);}
    assert.equal((db.execute({op:"get",id}) as {answer:string}).answer,"Soak fixture answer");
    console.log(JSON.stringify({idleSeconds:300,idleApiCalls:0,connections,pickupAndCompletionMs:Date.now()-started}));
  } finally {stop.abort();await worker;await hub.close();db.db.close();}
});
