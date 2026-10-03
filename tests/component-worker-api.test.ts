import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initialState } from '../src/lib/catalog';
import { paperKit } from '../src/lib/kit';
import { digest } from '../src/lib/kit-publication';
import { mutate } from '../src/lib/store';
import { POST } from '../src/app/api/worker/route';
test('worker API negotiates components, reconciles completions, and rejects stale writers',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'component-api-')),file=path.join(directory,'state.sqlite');
 const old={storage:process.env.AFTERIMAGE_STORAGE,sqlite:process.env.AFTERIMAGE_SQLITE_PATH,token:process.env.AFTERIMAGE_WORKER_TOKEN};
 try {
  process.env.AFTERIMAGE_STORAGE='sqlite';process.env.AFTERIMAGE_SQLITE_PATH=file;process.env.AFTERIMAGE_WORKER_TOKEN='test-worker-token';
  const state=initialState(),paper=state.papers[0];paper.kit=paperKit(paper);
  state.jobs=[{id:'component',type:'component',componentId:'quiz',paperId:paper.id,status:'queued',attempts:0,createdAt:new Date().toISOString()}];
  const db=new DatabaseSync(file);db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,version INTEGER NOT NULL,data TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,0,?)').run(JSON.stringify(state));db.close();
  const request=(body:unknown)=>POST(new Request('http://localhost/api/worker',{method:'POST',headers:{authorization:'Bearer test-worker-token','content-type':'application/json'},body:JSON.stringify(body)}));
  const oldClaim=await(await request({action:'claim'})).json();assert.equal(oldClaim.job,null);
  const claimed=await(await request({action:'claim',componentProtocol:1})).json();assert.equal(claimed.job.id,'component');const credentials={jobId:'component',leaseToken:claimed.job.leaseToken};
  const content=[0,1].map(i=>({id:`q${i}`,question:'Which statement best matches the mechanism?',options:['The mechanism','Another mechanism','Neither'].map(text=>({text,explanation:'This option can be checked against the reviewed explanation.'})),answer:0,sourceId:'abstract'}));
  const publication={id:'quiz',completionId:'quiz-result',expectedRevision:null,dependencies:{explanation:'legacy'},sources:paper.sources,scope:'abstract',content,review:{version:1,contentDigest:digest(content),sourcesDigest:digest(paper.sources),implementationDigest:'a'.repeat(64),gates:{source:true,math:true,teaching:true,geometry:true,visual:true,quiz:true}}};
  assert.equal((await request({action:'publish-component',...credentials,publication})).status,200);
  assert.equal((await(await request({action:'completion-status',...credentials,completionId:'quiz-result'})).json()).accepted,true);
  await mutate(s=>{s.jobs[0].leaseUntil=new Date(Date.now()-1000).toISOString();});
  assert.equal((await POST(new Request('http://localhost/api/worker',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'claim',componentProtocol:1})}))).status,401);
  const reclaimed=await(await request({action:'claim',componentProtocol:1})).json();
  assert.equal(reclaimed.job.id,claimed.job.id);assert.equal(reclaimed.job.attempts,2);assert.notEqual(reclaimed.job.leaseToken,credentials.leaseToken);
  assert.deepEqual(reclaimed.job.componentReceipts.map(({componentId,revision}:{componentId:string;revision:string})=>({componentId,revision})),[{componentId:'quiz',revision:reclaimed.paper.kit.components.find((c:{id:string})=>c.id==='quiz').revision}]);
  assert.deepEqual(reclaimed.paper.study.quiz,content);
  const current={jobId:'component',leaseToken:reclaimed.job.leaseToken};
  assert.equal((await(await request({action:'completion-status',...current,completionId:'quiz-result'})).json()).accepted,false);
  assert.notEqual((await request({action:'component-status',...credentials,componentId:'quiz',state:'failed'})).status,200);
  assert.notEqual((await request({action:'publish-component',...credentials,publication:{...publication,completionId:'stale-result'}})).status,200);
  assert.notEqual((await request({action:'publish-component',...current,publication})).status,200);
  assert.equal((await request({action:'complete',...current,components:true})).status,200);
  assert.equal((await(await request({action:'completion-status',...current,finished:true})).json()).accepted,true);
  const duplicate=await(await request({action:'publish-component',...credentials,publication})).json();assert.equal(duplicate.duplicate,true);
  assert.notEqual((await request({action:'component-status',...credentials,componentId:'quiz',state:'failed'})).status,200);
  assert.notEqual((await request({action:'publish-component',...credentials,publication:{...publication,completionId:'another-result'}})).status,200);
 }finally{
  for(const [key,value] of [['AFTERIMAGE_STORAGE',old.storage],['AFTERIMAGE_SQLITE_PATH',old.sqlite],['AFTERIMAGE_WORKER_TOKEN',old.token]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await rm(directory,{recursive:true,force:true});
 }
});
