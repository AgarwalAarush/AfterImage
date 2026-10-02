import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export const ASSISTANT_WAKE_PATH = "/internal/assistant/events";

/** A hint channel only. The authenticated public API remains the queue authority. */
export class AssistantWakeServer {
  private clients = new Set<ServerResponse>();
  private recheck?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  readonly server = createServer((req, res) => this.handle(req, res));

  constructor(private token: string, private readiness: () => {ready:boolean;recheckAt?:number}) {
    if (!/^[\x21-\x7e]{32,512}$/.test(token)) throw Error("Invalid assistant wake credential.");
    this.server.headersTimeout = 5_000;
    this.server.requestTimeout = 5_000;
    this.server.maxConnections = 8;
  }

  private handle(req: IncomingMessage, res: ServerResponse) {
    const reject = (status: number) => {res.writeHead(status, {"Cache-Control":"no-store"});res.end();};
    if (req.socket.remoteAddress !== "127.0.0.1") return reject(403);
    if (req.url !== ASSISTANT_WAKE_PATH) return reject(404);
    if (req.method !== "GET") return reject(405);
    const actual = Buffer.from(req.headers.authorization || ""), expected = Buffer.from(`Bearer ${this.token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reject(401);
    if (this.clients.size >= 2) return reject(503);
    res.writeHead(200, {"Content-Type":"text/event-stream", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"});
    // Register first: readiness and notifications run synchronously on the same event loop.
    this.clients.add(res);
    res.on("error", () => res.destroy());
    res.write("event: connected\ndata: {}\n\n");
    res.on("close", () => {
      this.clients.delete(res);
      if (!this.clients.size) this.clearTimers();
    });
    if (!this.heartbeat) this.heartbeat = setInterval(() => {
      for (const client of this.clients) this.write(client, ": keepalive\n\n");
    }, 15_000);
    try {this.refresh(false);if (this.readiness().ready) this.write(res, "event: ready\ndata: {}\n\n");}
    catch {res.destroy();}
  }

  private write(client: ServerResponse, frame: string) {
    // Slow readers cannot accumulate an unbounded private service output buffer.
    if(client.destroyed||client.writableEnded)return;
    try {if (!client.write(frame)) client.destroy();} catch {client.destroy();}
  }

  /** Call only after a committed operation. Heartbeat/update writes do not emit hints. */
  refresh(notify: boolean) {
    if (this.recheck) clearTimeout(this.recheck);
    this.recheck = undefined;
    if (!this.clients.size) return;
    const state = this.readiness();
    if (notify) for (const client of this.clients)
      this.write(client, state.ready ? "event: ready\ndata: {}\n\n" : "event: wake\ndata: {}\n\n");
    if (state.recheckAt) this.recheck = setTimeout(() => {
      this.recheck = undefined;
      try {this.refresh(this.readiness().ready);} catch {for (const client of this.clients) client.destroy();}
    }, Math.max(1, state.recheckAt - Date.now()));
  }

  async listen(port = 3104) {
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw Error("Invalid assistant wake port.");
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, "127.0.0.1", () => {this.server.removeListener("error", reject);resolve();});
    });
  }
  private clearTimers() {
    if (this.recheck) clearTimeout(this.recheck);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.recheck = this.heartbeat = undefined;
  }
  async close() {
    this.clearTimers();
    for (const client of this.clients) client.destroy();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
}
