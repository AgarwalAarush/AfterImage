import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { macserverRequest } from "./macserver-client";
import { assistantTargetSchema, conversationAskSchema, isActiveTurn, publicTurn, type AssistantEvidence, type AssistantTarget, type Conversation, type StoredAssistantTurn } from "./assistant-model";
import type { AppState } from "./types";

const uuid = z.string().uuid();
const sourceSchema = z.object({id:z.string().max(160),label:z.string().max(500),url:z.string().max(2048),excerpt:z.string().max(20000),kind:z.enum(["paper","lesson","notecard"]).optional(),sectionId:z.string().max(160).optional()});
const evidenceSchema = z.object({title:z.string().max(500),arxivId:z.string().max(80),lessonDigest:z.string().optional(),digest:z.string().length(64),sources:z.array(sourceSchema).max(64),material:z.unknown(),scope:z.string().max(300)});
export const assistantOperationSchema = z.discriminatedUnion("op", [
  z.object({op:z.literal("list"),target:assistantTargetSchema,cursor:z.string().max(200).optional()}),
  z.object({op:z.literal("turns"),conversationId:z.string().max(200),before:z.string().max(200).optional()}),
  z.object({op:z.literal("get"),id:uuid}),
  z.object({op:z.literal("source"),id:uuid,sourceId:z.string().max(160)}),
  z.object({op:z.literal("enqueue"),input:conversationAskSchema,evidence:evidenceSchema}),
  z.object({op:z.literal("cancel"),id:uuid}),
  z.object({op:z.literal("claim")}),
  z.object({op:z.literal("update"),id:uuid,leaseToken:uuid,action:z.enum(["update","complete","heartbeat","fail"]),answer:z.string().max(32000).optional()}),
]);
export type AssistantOperation = z.infer<typeof assistantOperationSchema>;

/** The bridge owns transactions; no read/modify/write loop crosses the network. */
export class AssistantDatabase {
  constructor(readonly db: DatabaseSync) {
    db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS assistant_conversations (id TEXT PRIMARY KEY, kind TEXT NOT NULL, target_id TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assistant_conversations_target ON assistant_conversations(kind,target_id,updated_at,id);
      CREATE TABLE IF NOT EXISTS assistant_turns (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id), created_at TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assistant_turns_conversation ON assistant_turns(conversation_id,created_at,id);
      CREATE INDEX IF NOT EXISTS assistant_turns_status ON assistant_turns(status);
      CREATE TABLE IF NOT EXISTS assistant_migrations (id TEXT PRIMARY KEY);`);
    this.transaction(() => {
      if (db.prepare("SELECT id FROM assistant_migrations WHERE id='legacy-v1'").get()) return;
      const table=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='state'").get();
      const row=table?db.prepare("SELECT data FROM state WHERE id=1").get() as {data:string}|undefined:undefined;
      if(row){
        const state=JSON.parse(row.data) as AppState;
        for(const old of state.assistantRequests||[]){
          const paper=state.papers.find(p=>p.id===old.paperId);
          const conversationId=`legacy-${old.paperId}`;
          const evidence:AssistantEvidence={title:paper?.title||old.paperId,arxivId:paper?.arxivId||old.paperId,digest:createHash("sha256").update(JSON.stringify(paper?.sources||[])).digest("hex"),sources:[...(paper?.sources||[]),...(paper?.recall?[{id:"notecard",label:"AfterImage notecard",url:`/papers/${old.paperId}`,excerpt:JSON.stringify(paper.recall),kind:"notecard" as const}]:[])],material:{notecard:paper?.recall||null,legacySnapshot:true},scope:"Legacy answer: sources captured at migration; the original answer-time source version is unavailable."};
          db.prepare("INSERT OR IGNORE INTO assistant_conversations VALUES (?,?,?,?,?,?)").run(conversationId,"paper",old.paperId,"Previous conversation",old.createdAt,old.updatedAt);
          db.prepare("UPDATE assistant_conversations SET created_at=min(created_at,?),updated_at=max(updated_at,?) WHERE id=?").run(old.createdAt,old.updatedAt,conversationId);
          this.save({...old,conversationId,evidence,evidenceDigest:evidence.digest,sources:evidence.sources.map(({excerpt,...source})=>source)});
        }
      }
      db.prepare("INSERT INTO assistant_migrations VALUES ('legacy-v1')").run();
    });
  }
  transaction<T>(fn:()=>T):T{this.db.exec("BEGIN IMMEDIATE");try{const result=fn();this.db.exec("COMMIT");return result;}catch(error){this.db.exec("ROLLBACK");throw error;}}
  private save(turn:StoredAssistantTurn){
    this.db.prepare("INSERT INTO assistant_turns VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data").run(turn.id,turn.conversationId,turn.createdAt,turn.status,JSON.stringify(turn));
    this.db.prepare("UPDATE assistant_conversations SET updated_at=max(updated_at,?) WHERE id=?").run(turn.updatedAt,turn.conversationId);
  }
  private get(id:string){const row=this.db.prepare("SELECT data FROM assistant_turns WHERE id=?").get(id) as {data:string}|undefined;return row?JSON.parse(row.data) as StoredAssistantTurn:null;}
  private expired(turn:StoredAssistantTurn,now:number){
    return isActiveTurn(turn)&&(turn.status==="queued"?now-Date.parse(turn.createdAt)>120000:!turn.leaseUntil||Date.parse(turn.leaseUntil)<now);
  }
  private failedExpiry(turn:StoredAssistantTurn,now:number):StoredAssistantTurn{
    return {...turn,status:"failed",error:"The assistant did not respond in time. You can ask again.",updatedAt:new Date(now).toISOString(),leaseToken:undefined,leaseUntil:undefined};
  }
  private visible(turn:StoredAssistantTurn,now:number){return publicTurn(this.expired(turn,now)?this.failedExpiry(turn,now):turn);}
  private expire(now:number){
    const rows=this.db.prepare("SELECT data FROM assistant_turns WHERE status IN ('queued','running')").all() as {data:string}[];
    for(const row of rows){const turn=JSON.parse(row.data) as StoredAssistantTurn;if(this.expired(turn,now))this.save(this.failedExpiry(turn,now));}
  }
  execute(raw:AssistantOperation,now=Date.now()):unknown{
    const op=assistantOperationSchema.parse(raw);
    if(op.op==="list"){
      const cursor=op.cursor?this.db.prepare("SELECT updated_at,id FROM assistant_conversations WHERE id=? AND kind=? AND target_id=?").get(op.cursor,op.target.kind,op.target.id) as Record<string,string>|undefined:undefined;
      const rows=(cursor?this.db.prepare("SELECT * FROM assistant_conversations WHERE kind=? AND target_id=? AND (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT 21").all(op.target.kind,op.target.id,cursor.updated_at,cursor.id):this.db.prepare("SELECT * FROM assistant_conversations WHERE kind=? AND target_id=? ORDER BY updated_at DESC,id DESC LIMIT 21").all(op.target.kind,op.target.id)) as Record<string,string>[];
      const page=rows,more=page.length>20;page.length=Math.min(page.length,20);
      return {items:page.map(r=>({id:r.id,target:{kind:r.kind,id:r.target_id},title:r.title,createdAt:r.created_at,updatedAt:r.updated_at})),nextCursor:more?page.at(-1)!.id:null};
    }
    if(op.op==="turns"){
      const conversation=this.db.prepare("SELECT * FROM assistant_conversations WHERE id=?").get(op.conversationId) as Record<string,string>|undefined;
      if(!conversation)return null;
      const cursor=op.before?this.db.prepare("SELECT created_at,id FROM assistant_turns WHERE id=? AND conversation_id=?").get(op.before,op.conversationId) as Record<string,string>|undefined:undefined;
      const rows=(cursor?this.db.prepare("SELECT data FROM assistant_turns WHERE conversation_id=? AND (created_at,id)<(?,?) ORDER BY created_at DESC,id DESC LIMIT 41").all(op.conversationId,cursor.created_at,cursor.id):this.db.prepare("SELECT data FROM assistant_turns WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 41").all(op.conversationId)) as {data:string}[];
      const page=rows.map(r=>JSON.parse(r.data) as StoredAssistantTurn),more=page.length>40;page.length=Math.min(page.length,40);
      return {conversation:{id:conversation.id,target:{kind:conversation.kind as AssistantTarget["kind"],id:conversation.target_id},title:conversation.title,createdAt:conversation.created_at,updatedAt:conversation.updated_at} satisfies Conversation,items:page.reverse().map(turn=>this.visible(turn,now)),nextCursor:more?page[0].id:null};
    }
    if(op.op==="source")return this.get(op.id)?.evidence.sources.find(s=>s.id===op.sourceId)||null;
    if(op.op==="get"){const turn=this.get(op.id);return turn?this.visible(turn,now):null;}
    return this.transaction(()=>{
      this.expire(now);const at=new Date(now).toISOString();
      if(op.op==="enqueue"){
        const {input,evidence}=op,existing=this.get(input.id);
        if(existing){const c=this.db.prepare("SELECT kind,target_id FROM assistant_conversations WHERE id=?").get(existing.conversationId) as Record<string,string>;
          if(existing.conversationId!==input.conversationId||existing.question!==input.question||existing.selection!==input.selection||c.kind!==input.target.kind||c.target_id!==input.target.id)throw Error("Request identifier is already in use.");return publicTurn(existing);}
        const counts=this.db.prepare("SELECT count(*) AS count FROM assistant_turns WHERE created_at>=?");
        if(Number(counts.get(new Date(now-3600000).toISOString())!.count)>=20||Number(counts.get(new Date(now-86400000).toISOString())!.count)>=60)throw Error("Your assistant limit has been reached (20 questions/hour, 60/day).");
        if(this.db.prepare("SELECT id FROM assistant_turns WHERE conversation_id=? AND status IN ('queued','running')").get(input.conversationId))throw Error("A reply is already in progress in this chat.");
        if(Number(this.db.prepare("SELECT count(*) AS count FROM assistant_turns WHERE status IN ('queued','running')").get()!.count)>=3)throw Error("The assistant is busy. Wait for a reply to finish.");
        const c=this.db.prepare("SELECT kind,target_id FROM assistant_conversations WHERE id=?").get(input.conversationId) as Record<string,string>|undefined;
        if(c&&(c.kind!==input.target.kind||c.target_id!==input.target.id))throw Error("Conversation target does not match.");
        this.db.prepare("INSERT OR IGNORE INTO assistant_conversations VALUES (?,?,?,?,?,?)").run(input.conversationId,input.target.kind,input.target.id,input.question.slice(0,80),at,at);
        const turn:StoredAssistantTurn={id:input.id,conversationId:input.conversationId,question:input.question,selection:input.selection,status:"queued",answer:"",createdAt:at,updatedAt:at,evidence:evidence as AssistantEvidence,evidenceDigest:evidence.digest,lessonDigest:evidence.lessonDigest,sources:evidence.sources.map(({excerpt,...source})=>source)};
        this.save(turn);return publicTurn(turn);
      }
      if(op.op==="claim"){
        if(this.db.prepare("SELECT id FROM assistant_turns WHERE status='running'").get())return {request:null};
        const row=this.db.prepare("SELECT id FROM assistant_turns WHERE status='queued' ORDER BY created_at,id LIMIT 1").get() as {id:string}|undefined;
        if(!row)return {request:null};const turn=this.get(row.id)!;
        turn.status="running";turn.leaseToken=randomUUID();turn.leaseUntil=new Date(now+45000).toISOString();turn.updatedAt=at;this.save(turn);
        const history=(this.db.prepare("SELECT data FROM assistant_turns WHERE conversation_id=? AND status='complete' AND created_at<=? ORDER BY created_at DESC,id DESC LIMIT 6").all(turn.conversationId,turn.createdAt) as {data:string}[]).reverse().map(row=>{const t=JSON.parse(row.data) as StoredAssistantTurn;return {question:t.question,selection:t.selection,answer:t.answer.slice(0,8000),evidenceDigest:t.evidenceDigest};});
        return {request:{...publicTurn(turn),leaseToken:turn.leaseToken},context:{...turn.evidence,history,selectedPassage:turn.selection,question:turn.question}};
      }
      const turn=this.get(op.id);if(!turn||!isActiveTurn(turn))return {cancelled:true};
      if(op.op==="cancel"){turn.status="cancelled";delete turn.leaseToken;delete turn.leaseUntil;}
      else{
        if(turn.leaseToken!==op.leaseToken)return {cancelled:true};
        if(op.action==="fail"){turn.status="failed";turn.error="The assistant could not finish. Your partial reply is preserved.";}
        else if(op.action==="update"||op.action==="complete"){
          if(typeof op.answer!=="string"||(op.action==="complete"&&!op.answer.trim()))throw Error("Invalid reply.");
          if(op.answer.length>=turn.answer.length)turn.answer=op.answer;
          if(op.action==="complete")turn.status="complete";
        }
        if(isActiveTurn(turn))turn.leaseUntil=new Date(now+45000).toISOString();else{delete turn.leaseToken;delete turn.leaseUntil;}
      }
      turn.updatedAt=at;this.save(turn);return {ok:true};
    });
  }
}
let local:AssistantDatabase|undefined;
export function localAssistantStore(){
  if(!local){
    const file=process.env.AFTERIMAGE_SQLITE_PATH||path.resolve(".data/afterimage.sqlite");
    if(process.env.VERCEL||process.env.AFTERIMAGE_STORAGE==="supabase")throw Error("Durable assistant storage requires SQLite.");
    if(process.env.NODE_ENV==="production"&&(!process.env.AFTERIMAGE_SQLITE_PATH||!path.isAbsolute(file)||!existsSync(file)))throw Error("Assistant storage requires the existing SQLite library.");
    mkdirSync(path.dirname(file),{recursive:true});const db=new DatabaseSync(file);db.exec("PRAGMA journal_mode=WAL");local=new AssistantDatabase(db);
  }return local;
}
export async function assistantStore<T=unknown>(operation:AssistantOperation):Promise<T>{
  const input=assistantOperationSchema.parse(operation);
  return (process.env.AFTERIMAGE_STORAGE==="macserver"?await macserverRequest({action:"assistant",operation:input}):localAssistantStore().execute(input)) as T;
}
