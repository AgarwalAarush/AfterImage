// Meaningful acceptance boundaries: stale critique, malformed verdict, repair ceiling.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [runtime,approvedReport]=process.argv.slice(2);
if(!runtime||!approvedReport)throw Error('Usage: node check-review-guards.mjs runtime-project approved-report.json');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'scientific-review-guards-'));
const report=JSON.parse(await fs.readFile(approvedReport,'utf8'));
const base=report.review;
assert.equal(report.status,'approved');
const scene=fileURLToPath(new URL('../examples/state-reuse.mjs',import.meta.url));
const runner=fileURLToPath(new URL('./render-review.mjs',import.meta.url));
function run(out,review){return spawnSync(process.execPath,[runner,'--scene',scene,'--out',out,'--runtime',runtime,'--review',review],{encoding:'utf8'});}
const stale=path.join(temp,'stale.json');await fs.writeFile(stale,JSON.stringify({...base,fingerprint:'old'}));
let result=run(path.join(temp,'stale'),stale);assert.notEqual(result.status,0);assert.match(result.stderr,/Stale critique/);
const invalid=path.join(temp,'invalid.json');await fs.writeFile(invalid,JSON.stringify({...base,issues:[{severity:'mustfix'}]}));
result=run(path.join(temp,'invalid'),invalid);assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid critique defects/);
const bounded=path.join(temp,'bounded');await fs.mkdir(bounded);
await fs.writeFile(path.join(bounded,'history.json'),JSON.stringify(Array.from({length:4},(_,i)=>({round:i+1,fingerprint:String(i),status:'repair-required',issues:[]}))));
const rejected=path.join(temp,'rejected.json');await fs.writeFile(rejected,JSON.stringify({...base,gates:{...base.gates,source:false},issues:[{category:'unsupported-claim',severity:'must-fix',location:'test fixture',evidence:'Deliberate guard test',repair:'Stop; preserve the gate'}]}));
result=run(bounded,rejected);assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).status,'repair-limit');
console.log('Pass: stale/malformed critiques rejected; fifth unresolved verdict stops at repair-limit. Evidence: '+temp);
