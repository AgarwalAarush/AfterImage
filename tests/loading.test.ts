import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {publicState} from '../src/lib/public-state';
import {initialState} from '../src/lib/catalog';
import {storageRequest} from '../src/lib/storage-request';
import {readLibrary, readLibraryUpdate, SessionExpired} from '../src/lib/library-client';
import {LibraryContent} from '../src/components/library-content';
import {currentState} from '../src/lib/state-version';
import {workerClaimDecision} from '../src/lib/store';
import {paperPreparationModel} from '../src/lib/generation-progress';

test('legacy post-reading capture fields are removed from the active state model', () => {
 const legacy=initialState() as any;
 legacy.schemaVersion=1;
 legacy.entries.paper={paperId:'paper',status:'read',savedAt:'2026-09-01',updatedAt:'2026-09-02',takeaway:'retired',why:'retired',question:'retired',nextAction:'retired'};
 const upgraded=currentState(legacy);
 assert.equal(upgraded.schemaVersion,2);
 assert.deepEqual(upgraded.entries.paper,{paperId:'paper',status:'read',savedAt:'2026-09-01',updatedAt:'2026-09-02'});
});

test('paper preparation presents notecard and study work as one atomic package', () => {
 const paper=structuredClone(initialState().papers[0]);
 paper.id='generated';paper.recall=null;paper.scene=null;delete paper.study;paper.generationStatus='queued';
 let model=paperPreparationModel(paper,[{id:'g',type:'generate',paperId:paper.id,status:'queued',createdAt:'2026-09-12',attempts:0}]);
 assert.equal(model.status,'queued');
 assert.equal(model.orbState,'working');
 assert.deepEqual(model.steps.map(step=>step.state),['active','upcoming','upcoming','upcoming','upcoming']);
 assert.match(model.detail,/notecard, visual guide, and questions/i);

 paper.generationStatus='running';paper.generationStep='reviewing';
 model=paperPreparationModel(paper,[{id:'g',type:'generate',paperId:paper.id,status:'running',createdAt:'2026-09-12',attempts:1}]);
 assert.equal(model.orbState,'solving');
 assert.deepEqual(model.steps.map(step=>step.state),['complete','complete','complete','active','upcoming']);

 paper.generationStatus='ready';paper.recall={...initialState().papers[0].recall!,provenance:'codex'};
 model=paperPreparationModel(paper,[{id:'s',type:'study',paperId:paper.id,status:'running',createdAt:'2026-09-12',attempts:1}]);
 assert.equal(model.orbState,'weaving');
 assert.deepEqual(model.steps.map(step=>step.state),['complete','complete','complete','complete','active']);

 model=paperPreparationModel(paper,[{id:'s',type:'study',paperId:paper.id,status:'queued',createdAt:'2026-09-12',attempts:1}]);
 assert.equal(model.orbState,'working');

 model=paperPreparationModel(paper,[{id:'s',type:'study',paperId:paper.id,status:'failed',createdAt:'2026-09-12',attempts:1,error:'private'}]);
 assert.equal(model.status,'failed');assert.equal(model.retryAction,'study');
 assert.doesNotMatch(model.detail,/private/);
});

test('browser projection drops heavy excerpts, preserves citations, and full export never leaks leases', () => {
 const state=initialState();
 state.papers[0].sources=[{id:'abstract',label:'Source',url:'https://arxiv.org/abs/2401.04088',excerpt:'source evidence'}];
 state.jobs=[{id:'j',type:'generate',status:'running',createdAt:'2026-09-12',attempts:1,leaseToken:'private-lease'}];
 const light=publicState(state);
 assert.equal(light.papers[0].sources[0].excerpt,'');
 assert.equal(light.papers[0].sources[0].url,state.papers[0].sources[0].url);
 assert.equal(state.papers[0].sources[0].excerpt,'source evidence');
 assert.equal(publicState(state,true).papers[0].sources[0].excerpt,'source evidence');
 assert.equal(light.jobs[0].leaseToken,undefined);
 assert.equal(publicState(state,true).jobs[0].leaseToken,undefined);
});
test('temporary storage read failure retries, but uncertain writes never replay', async () => {
 let reads=0,writes=0;
 const read=(async()=>++reads===1?new Response('',{status:503}):new Response('{"ok":true}')) as typeof fetch;
 assert.deepEqual(await(await storageRequest('https://example.com',{},read)).json(),{ok:true});
 assert.equal(reads,2);
 const write=(async()=>{writes++;throw new TypeError('fetch failed')}) as typeof fetch;
 await assert.rejects(storageRequest('https://example.com',{method:'PATCH'},write),/couldn't confirm/);
 assert.equal(writes,1);
});
test('a partial storage response is retried for reads', async () => {
 let count=0;
 const request=(async()=>++count===1?new Response(new ReadableStream({start(c){c.error(new Error('connection reset'));}})):new Response('[]')) as typeof fetch;
 assert.deepEqual(await(await storageRequest('https://example.com',{},request)).json(),[]);
 assert.equal(count,2);
});
test('client recovers from a network interruption without retrying expired sessions', async () => {
 let calls=0;
 const request=(async()=>{if(++calls===1)throw new TypeError('network');return new Response(JSON.stringify(initialState()));}) as typeof fetch;
 const state=await readLibrary(new AbortController().signal,request);
 assert.ok(state.papers.length);assert.equal(calls,2);
 calls=0;
 const unauthorized=(async()=>{calls++;return new Response('',{status:401});}) as typeof fetch;
 await assert.rejects(readLibrary(new AbortController().signal,unauthorized),SessionExpired);
 assert.equal(calls,1);
});
test('aborted obsolete client reads do not retry', async () => {
 const controller=new AbortController();let calls=0;
 const request=(async()=>{calls++;controller.abort();throw new Error('aborted');}) as typeof fetch;
 await assert.rejects(readLibrary(controller.signal,request),/aborted/);assert.equal(calls,1);
});
test('unchanged library polling uses a version response and keeps the loaded state', async () => {
 const urls:string[]=[];
 const request=(async (url:string)=>{
  urls.push(url);
  if(url.includes('since='))return new Response(null,{status:204,headers:{'X-Afterimage-Worker-Seen-At':'2026-09-25T12:00:00.000Z'}});
  return new Response(JSON.stringify(initialState()),{headers:{'X-Afterimage-State-Version':'7'}});
 }) as typeof fetch;
 const signal=new AbortController().signal;
 const first=await readLibraryUpdate(signal,undefined,request);
 assert.equal(first.version,7);assert.ok(first.state);
 const unchanged=await readLibraryUpdate(signal,first.version!,request);
 assert.equal(unchanged.state,null);assert.equal(unchanged.version,7);
 assert.equal(unchanged.workerSeenAt,'2026-09-25T12:00:00.000Z');
 assert.deepEqual(urls,['/api/state','/api/state?since=7']);
});
test('idle workers avoid full state claims but still refresh presence and reclaim expired jobs', () => {
 const now=Date.parse('2026-09-25T12:00:00.000Z');
 const recent='2026-09-25T11:59:30.000Z';
 assert.deepEqual(workerClaimDecision([],recent,now),{claim:false,heartbeat:false});
 assert.deepEqual(workerClaimDecision([],'2026-09-25T11:58:00.000Z',now),{claim:false,heartbeat:true});
 assert.equal(workerClaimDecision([],null,now).claim,true);
 assert.equal(workerClaimDecision([{id:'q',type:'generate',status:'queued',createdAt:recent,attempts:0}],recent,now).claim,true);
 assert.equal(workerClaimDecision([{id:'r',type:'generate',status:'running',createdAt:recent,attempts:1,leaseUntil:'2026-09-25T11:59:00.000Z'}],recent,now).claim,true);
});
test('background errors retain library content while initial errors offer recovery', () => {
 const props={error:'Connection unavailable',retry:()=>{},loading:'Loading',children:createElement('article',null,'Saved paper')};
 const retained=renderToStaticMarkup(createElement(LibraryContent,{...props,loaded:true}));
 assert.match(retained,/Saved paper/);assert.match(retained,/last loaded library/);
 const initial=renderToStaticMarkup(createElement(LibraryContent,{...props,loaded:false}));
 assert.doesNotMatch(initial,/Saved paper/);assert.match(initial,/Try again/);
});
