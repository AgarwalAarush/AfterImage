import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { subjectPresentationScope } from "../src/lib/subject-presentation-scope";
import { validateSubjectWorkspaceReview, verifySubjectWorkspaceArtifacts, subjectWorkspaceAcceptance } from "../src/lib/subject-workspace-review";

// Explicit approval-time command. A browser observation is not an approval.
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=="--report"||args[2]!=="--expected-receipt-digest")
  throw new Error("Usage: approve-subject-workspace.ts --report PRIVATE_REPORT --expected-receipt-digest none|SHA256");
const expected=args[3];
if(expected!=="none"&&!/^[a-f0-9]{64}$/.test(expected))throw new Error("Invalid expected receipt digest");
const destination=path.resolve("src/content/subjects/workspace-acceptance.json");
const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
async function receiptDigest(){
  try{return hash(await readFile(destination));}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return "none";throw error;}
}
if(await receiptDigest()!==expected)throw new Error("Workspace receipt changed before review");
const before=await subjectPresentationScope(process.cwd());
const report=validateSubjectWorkspaceReview(JSON.parse(await readFile(path.resolve(args[1]),"utf8")),before);
await verifySubjectWorkspaceArtifacts(report);
const after=await subjectPresentationScope(process.cwd());
if(before.coreDigest!==after.coreDigest||before.integrationDigest!==after.integrationDigest)
  throw new Error("Presentation changed during review");
if(await receiptDigest()!==expected)throw new Error("Workspace receipt changed during review");
await writeFile(destination,JSON.stringify(subjectWorkspaceAcceptance(report),null,2)+"\n");
console.log("Recorded independently reviewed workspace acceptance; per-mechanism publication checks still apply.");
