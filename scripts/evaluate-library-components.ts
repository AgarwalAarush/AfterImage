/** Nonpublishing acceptance suite. Explicit retry exercises are opt-in; never part of npm test. */
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { implementationDigest } from "../worker/implementation";
import { mergeComponentRetry, completeEvaluationResult, reconcileEvaluationOutcomes } from "./library-evaluation-results";
const cases = [
  { name: "MegaBlocks", id: "2211.15841", role: "regression", savedReplay: true },
  { name: "TriRoute", id: "2607.06601", role: "regression", savedReplay: true },
  { name: "QLoRA", id: "2305.14314", role: "regression", savedReplay: true },
  { name: "FlashAttention", id: "2205.14135", role: "regression", savedReplay: true },
  { name: "LoRA", id: "2106.09685", role: "regression", savedReplay: false },
  { name: "Mamba", id: "2312.00752", role: "regression", savedReplay: false },
];
let stopping = false;
const children = new Set<number>();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
  stopping = true;
  for (const pid of children) { try { process.kill(-pid, "SIGTERM"); } catch {} }
});
async function command(args: string[], log: string) {
 let output = ""; const stream = createWriteStream(log);
 const code = await new Promise<number | null>((resolve, reject) => {
  const child = spawn(process.execPath, ["--import", "tsx", ...args], { cwd: process.cwd(), env: process.env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  if (child.pid) children.add(child.pid);
  const record = (chunk: Buffer) => { output += String(chunk); stream.write(chunk); };
  child.stdout.on("data", record); child.stderr.on("data", record);
  child.on("error", reject); child.on("close", code => { if(child.pid)children.delete(child.pid); stream.end(); resolve(code); });
 });
 return { code, output, dir: /Evaluation artifacts: (.+)/.exec(output)?.[1] };
}
async function json(file: string) { return JSON.parse(await readFile(file, "utf8").catch(() => "null")); }
async function main() {
 const root = path.resolve(".artifacts/library-evaluations", new Date().toISOString().replaceAll(":", "-"));
 await mkdir(root, { recursive: true });
 const implementation = await implementationDigest(), startedAt = new Date().toISOString();
 const exerciseRetries = process.argv.includes("--exercise-retries");
 const concurrencyIndex=process.argv.indexOf("--concurrency");
 const concurrency=concurrencyIndex<0?2:Number(process.argv[concurrencyIndex+1]);
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error("Evaluation concurrency must be 1–4");
 const replayIndex=process.argv.indexOf("--replay-dir");
 const replayDir=replayIndex<0?undefined:path.resolve(process.argv[replayIndex+1]);
 const results: unknown[] = []; let cursor = 0;
 console.log(root);
 async function lane() {
  while (!stopping && cursor < cases.length) {
   const paper = cases[cursor++], start = Date.now(); console.log(`Starting ${paper.name}`);
   const replay=paper.savedReplay&&replayDir ? path.join(replayDir,`${paper.id}.json`) : undefined;
   if(replay)await readFile(replay);
   const run = await command(["worker/index.ts", "--evaluate-paper", paper.id, ...(replay?["--candidate",replay]:[])], path.join(root, paper.name + ".log"));
   let result = run.dir ? await json(path.join(run.dir, "result.json")) : null;
   const report = run.dir ? await json(path.join(run.dir, "kit-quality-report.json")) : null;
   const initialFailure = result?.failure;
   if (result) result = { ...result, initialFailure };
   const retries: unknown[] = [];
   // This deliberately simulates ONE separately requested retry per failed unit. It is not worker auto-retry.
   if (exerciseRetries && result && run.dir && !stopping) {
    const failed = result.outcomes.filter((o: any) => o.status !== "passed");
    for (const target of failed) {
     if (stopping) break;
     if (target.id !== "explanation" && !result.paper.recall) continue;
     const input = path.join(root, `${paper.name}-${target.id.replace(":", "-")}-input.json`);
     await writeFile(input, JSON.stringify(result.paper));
     const retry = await command(["worker/index.ts", "--evaluate-file", input, "--component", target.id, "--checkpoint-root", path.join(run.dir, "checkpoints")], input.replace("-input.json", "-retry.log"));
     const next = retry.dir ? await json(path.join(retry.dir, "result.json")) : null;
     const retryReport = retry.dir ? await json(path.join(retry.dir, "kit-quality-report.json")) : null;
     retries.push({ id: target.id, code: retry.code, dir: retry.dir, report: retryReport, failure: next?.failure, outcomes: next?.outcomes });
     result = mergeComponentRetry(result, target.id, next, retry.code, failed.map((outcome: any) => outcome.id));
    }
   }
   if (result) result = reconcileEvaluationOutcomes(result);
   let nullCost = null;
   if (paper.name === "TriRoute" && result?.paper.recall && !stopping) {
    const finalFile = path.join(root, "TriRoute-final.json"); await writeFile(finalFile, JSON.stringify(result));
    const probe = await command(["scripts/evaluate-triroute-cost.ts", finalFile], path.join(root, "TriRoute-null-cost.log"));
    nullCost = { code: probe.code, report: await json(path.join(root, "null-cost-acceptance-v2.json")) };
   }
   const accepted = completeEvaluationResult(result) && (paper.name !== "TriRoute" || nullCost?.code === 0);
   results.push({ ...paper, inputMode: replay ? "saved-failure-replay" : "fresh-generation", replay, initialCode: run.code, initialFailure, accepted, elapsedMs: Date.now()-start, dir: run.dir, report, retries, nullCost, finalOutcomes: result?.outcomes, unchanged: implementation === await implementationDigest() });
   await writeFile(path.join(root, "results.json"), JSON.stringify({ implementation, startedAt, exerciseRetries, cases, results }, null, 2));
   if (result) await writeFile(path.join(root, `${paper.name}-final.json`), JSON.stringify(result, null, 2));
   console.log(`Finished ${paper.name}: ${accepted ? "passed" : "not accepted"}`);
  }
 }
 await Promise.all(Array.from({length:concurrency},()=>lane()));
 console.log(`Private results: ${root}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
