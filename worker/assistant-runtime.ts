import type { WakeSource } from "./assistant-wake";

export type WorkerCommand = {action:"claim";protocol:2} |
  {action:"update"|"heartbeat"|"complete"|"fail";id:string;leaseToken:string;answer?:string};
export type WorkerReply = {request?:{id:string;leaseToken:string}|null;context?:unknown;cancelled?:boolean};
type Dependencies = {
  api:(body:WorkerCommand)=>Promise<WorkerReply>;
  stream:(context:unknown,onText:(text:string)=>void,signal:AbortSignal)=>Promise<unknown>;
  wake?:WakeSource;
  signal:AbortSignal;
  once?:boolean;
  log?:(phase:string)=>void;
};

export async function runAssistantWorker({api,stream,wake,signal,once,log=()=>{}}:Dependencies) {
  let connected=false,pending=false,claimUncertain=false,notify:()=>void=()=>{},active:AbortController|undefined;
  let urgentFlush:(()=>void)|undefined;
  let offlineSince=Date.now();
  const pulse=()=>notify();
  const abort=()=>{active?.abort();pulse();};
  signal.addEventListener("abort",abort,{once:true});
  if(!once)wake?.start(kind=>{
    // Readiness confirms there is no live running lease. A generic check cannot
    // reconcile a lost claim response and must not cause that mutation to replay.
    if(kind==="ready"){pending=true;claimUncertain=false;}
    urgentFlush?.();pulse();
  },value=>{
    if(connected!==value){connected=value;if(!value)offlineSince=Date.now();pulse();}
  });

  async function run() {
    // A claim is a mutation. An uncertain response is never retried here.
    const {request,context}=await api({action:"claim",protocol:2});
    if(!request)return false;
    const credentials={id:request.id,leaseToken:request.leaseToken};
    const current=active=new AbortController();
    if(signal.aborted)current.abort();
    let text="",sent="",lastContact=Date.now(),finishing=false,forcePending=false;
    let sending:Promise<void>|undefined;
    let heartbeatTimer=setTimeout(()=>{void flush();},5_000);
    function flush(force=false):Promise<void> {
      if(finishing||current.signal.aborted)return Promise.resolve();
      if(sending){forcePending ||= force;return sending;}
      if(!force&&text===sent&&Date.now()-lastContact<5_000)return Promise.resolve();
      const outgoing=text;
      sending=(async()=>{
        try {
          const result=await api(outgoing!==sent?{action:"update",...credentials,answer:outgoing}:{action:"heartbeat",...credentials});
          if(result.cancelled)current.abort();
          sent=outgoing;lastContact=Date.now();
          clearTimeout(heartbeatTimer);
          if(!finishing&&!current.signal.aborted)heartbeatTimer=setTimeout(()=>{void flush();},5_000);
        } catch {current.abort();log("update-failed");}
        finally {sending=undefined;if(forcePending){forcePending=false;void flush(true);}}
      })();
      return sending;
    }
    urgentFlush=()=>{void flush(true);};
    const timer=setInterval(()=>{void flush();},650);
    try {
      log("started");
      await stream(context,value=>{text=value;},current.signal);
      finishing=true;urgentFlush=undefined;clearInterval(timer);clearTimeout(heartbeatTimer);
      if(sending)await sending;
      if(!current.signal.aborted) {
        // A lost completion response must not result in an automatic fail/replay.
        try {await api({action:"complete",...credentials,answer:text});log("finished");}
        catch {log("completion-uncertain");}
      }
    } catch {
      finishing=true;urgentFlush=undefined;clearInterval(timer);clearTimeout(heartbeatTimer);
      if(sending)await sending;
      log("failed");
      // Model failure/cancellation preserves the existing partial answer. No retry.
      try {await api({action:"fail",...credentials});} catch {log("failure-uncertain");}
    } finally {
      finishing=true;urgentFlush=undefined;clearInterval(timer);clearTimeout(heartbeatTimer);active=undefined;
    }
    return true;
  }

  function wait(ms?:number) {
    return new Promise<void>(resolve=>{
      let timer:ReturnType<typeof setTimeout>|undefined;
      notify=()=>{if(timer)clearTimeout(timer);notify=()=>{};resolve();};
      if(ms!==undefined)timer=setTimeout(()=>notify(),ms);
    });
  }
  try {
    if(once){await run();return;}
    while(!signal.aborted) {
      const recoveryDue=!connected&&!claimUncertain&&Date.now()-offlineSince>=30_000;
      if(!pending&&!recoveryDue) {
        await wait(connected||claimUncertain?undefined:Math.max(1,30_000-(Date.now()-offlineSince)));
        continue;
      }
      pending=false;
      if(!connected)offlineSince=Date.now();
      try {while(!signal.aborted&&await run()) {/* Drain serially; SQLite leases still arbitrate. */}}
      catch {claimUncertain=true;pending=false;log("claim-uncertain");/* Wait for readiness reconciliation, never replay a claim. */}
    }
  } finally {wake?.stop();signal.removeEventListener("abort",abort);}
}
