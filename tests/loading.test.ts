import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {publicState} from '../src/lib/public-state';
import {initialState} from '../src/lib/catalog';
import {storageRequest} from '../src/lib/storage-request';
import {readLibrary, SessionExpired} from '../src/lib/library-client';
import {LibraryContent} from '../src/components/library-content';

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
test('background errors retain library content while initial errors offer recovery', () => {
 const props={error:'Connection unavailable',retry:()=>{},loading:'Loading',children:createElement('article',null,'Saved paper')};
 const retained=renderToStaticMarkup(createElement(LibraryContent,{...props,loaded:true}));
 assert.match(retained,/Saved paper/);assert.match(retained,/last loaded library/);
 const initial=renderToStaticMarkup(createElement(LibraryContent,{...props,loaded:false}));
 assert.doesNotMatch(initial,/Saved paper/);assert.match(initial,/Try again/);
});
