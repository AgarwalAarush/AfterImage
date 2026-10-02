import { DatabaseSync } from "node:sqlite";
import { AssistantDatabase } from "../src/lib/assistant-storage";
const [mode,file]=process.argv.slice(2);
if(!["idle","restore","verify"].includes(mode)||!file?.startsWith("/"))throw Error("Invalid release check.");
const sql=new DatabaseSync(file,{readOnly:mode!=="restore"});
try{
 const state=JSON.parse((sql.prepare("SELECT data FROM state WHERE id=1").get() as {data:string}).data);
 const legacy=state.assistantRequests||[];
 if(mode==="idle"){
  const now=Date.now(),active=legacy.filter((t:{status:string;createdAt:string;leaseUntil?:string})=>t.status==="queued"?now-Date.parse(t.createdAt)<120000:t.status==="running"&&Date.parse(t.leaseUntil||"")>now);
  if(active.length)throw Error("Assistant work is active. Let it finish before installation.");
  console.log(JSON.stringify({activeLegacyTurns:0}));
 }else{
  if(mode==="restore")new AssistantDatabase(sql);
  if(sql.prepare("PRAGMA integrity_check").get()!.integrity_check!=="ok")throw Error("Restore integrity failed.");
  for(const old of legacy){const row=sql.prepare("SELECT data FROM assistant_turns WHERE id=?").get(old.id) as {data:string}|undefined;if(!row)throw Error("Legacy turn missing.");const turn=JSON.parse(row.data);if(turn.question!==old.question||turn.selection!==old.selection||turn.answer!==old.answer)throw Error("Legacy content mismatch.");}
  const counts=Object.fromEntries(["assistant_conversations","assistant_turns","assistant_migrations","documents"].map(table=>[table,sql.prepare(`SELECT count(*) AS count FROM ${table}`).get()!.count]));
  console.log(JSON.stringify({integrity:"ok",retainedLegacyTurns:legacy.length,counts}));
 }
}finally{sql.close();}
