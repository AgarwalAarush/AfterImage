import { setTimeout as delay } from "node:timers/promises";

export type WakeSignal = "ready" | "check";
export interface WakeSource {
  start(onWake: (kind:WakeSignal) => void, onConnection: (connected: boolean) => void): void;
  stop(): void;
}

/** Persistent local hint stream. No storage/Access credential or payload enters this client. */
export class AssistantWakeClient implements WakeSource {
  private stopController = new AbortController();
  private connection?: AbortController;
  constructor(private url: string, private token: string) {
    let parsed:URL;
    try {parsed = new URL(url);} catch {throw Error("Invalid local assistant wake configuration.");}
    if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.username ||
        parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/internal/assistant/events" ||
        !/^[\x21-\x7e]{32,512}$/.test(token)) throw Error("Invalid local assistant wake configuration.");
  }
  start(onWake: (kind:WakeSignal) => void, onConnection: (connected: boolean) => void) {
    void this.connect(onWake, onConnection);
  }
  stop() {this.stopController.abort();this.connection?.abort();}

  private async connect(onWake: (kind:WakeSignal) => void, onConnection: (connected: boolean) => void) {
    let retry = 1_000;
    while (!this.stopController.signal.aborted) {
      const controller = this.connection = new AbortController();
      let watchdog = setTimeout(() => controller.abort(), 5_000);
      const refresh = () => {clearTimeout(watchdog);watchdog=setTimeout(() => controller.abort(),45_000);};
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await fetch(this.url, {headers:{Authorization:`Bearer ${this.token}`},
          signal:controller.signal, redirect:"error", cache:"no-store"});
        if (!response.ok || !response.body || !response.headers.get("content-type")?.startsWith("text/event-stream"))
          throw Error("Wake connection unavailable.");
        reader = response.body.getReader();
        const decoder = new TextDecoder();let buffer="", connected=false;
        for (;;) {
          const result = await reader.read();if(result.done)break;
          refresh();buffer+=decoder.decode(result.value,{stream:true});
          let boundary: number;
          while ((boundary=buffer.indexOf("\n\n"))!==-1) {
            const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
            if(frame.length>1024)throw Error("Invalid wake frame.");
            if(frame==="event: connected\ndata: {}") {
              if(!connected){connected=true;retry=1_000;onConnection(true);}
            } else if(frame==="event: ready\ndata: {}" && connected) onWake("ready");
            else if(frame==="event: wake\ndata: {}" && connected) onWake("check");
            else if(frame!==": keepalive")throw Error("Invalid wake frame.");
          }
          if(buffer.length>1024)throw Error("Invalid wake frame.");
        }
      } catch { /* Recover locally. Never log headers, tokens, URLs or exception messages. */ }
      finally {
        clearTimeout(watchdog);controller.abort();await reader?.cancel().catch(()=>{});
        onConnection(false);
      }
      try {await delay(retry,undefined,{signal:this.stopController.signal});} catch {break;}
      retry=Math.min(30_000,retry*2);
    }
  }
}
