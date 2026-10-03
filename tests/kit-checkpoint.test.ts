import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { KitCheckpoints } from '../worker/kit-checkpoint';
import { fingerprint } from '../worker/repair-controller';
import { validationProgress } from '../worker/validation-findings';
test('private checkpoints require exact bindings and survive process recreation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'kit-checkpoint-'));
 try {
  const store=new KitCheckpoints(root,'paper');assert.equal(await store.read('diagram','old'),undefined);
  const value={version:1 as const,binding:'bound',componentId:'diagram',candidate:{private:'draft'},repair:{candidate:{private:'draft'},ledger:[],round:4,replanned:true,seen:['one']},exhausted:true};
  await store.write(value);assert.deepEqual(await new KitCheckpoints(root,'paper').read('diagram','bound'),value);assert.equal(await store.read('diagram','changed'),undefined);
  const file=path.join(root,fingerprint('paper'),fingerprint('diagram')+'.json');assert.equal((await stat(file)).mode&0o777,0o600);assert.ok((await readFile(file,'utf8')).includes('draft'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('validation comparison preserves unrelated defects but rejects new, unsafe or uncorrected dependencies',()=>{
 const finding=(id:string,dependencies:string[]=[])=>({invariant:'consistent',objectId:id,paths:[`/${id}`],dependencies,message:'Invalid'});
 const a=finding('a'),b=finding('b'),target={path:'/a'} as any;
 assert.equal(validationProgress([a,b],[b],[target]),true);
 assert.equal(validationProgress([a,b],[b,finding('new')],[target]),false);
 assert.equal(validationProgress([a,b],[a,b],[target]),false);
 assert.equal(validationProgress([a,b],[{...b,fatal:true}],[target]),false);
 assert.equal(validationProgress([a,finding('parent',['/a'])],[finding('parent',['/a'])],[target]),false);
});
test('stale workers cannot replace a private checkpoint after losing their lease',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'kit-fence-'));
 try {
  const current=new KitCheckpoints(root,'paper');await current.write({version:1,binding:'same',componentId:'diagram',candidate:{acceptedProgress:2}});
  const stale=new KitCheckpoints(root,'paper',async()=>{throw Error('Stale lease');});
  await assert.rejects(stale.write({version:1,binding:'same',componentId:'diagram',candidate:{acceptedProgress:1}}),/Stale lease/);
  assert.deepEqual((await current.read('diagram','same'))?.candidate,{acceptedProgress:2});
 }finally{await rm(root,{recursive:true,force:true});}
});
