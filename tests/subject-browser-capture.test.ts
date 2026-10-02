import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSubjectCaptureRegions,assertSubjectCaptureStable,captureSubjectMechanismView} from '../scripts/capture-subject-mechanism-browser.js';
test('native capture rejects gutter reflow, crop drift and changed state instead of binding stale measurements',()=>{
  const context={crop:{left:10,top:100,width:500,height:1000},clientWidth:900,selected:'first',playing:'false',regions:Array.from({length:5},()=>({left:20,top:110,width:100,height:40}))};
  const audit={theme:'dark',viewportWidth:900,canvasWidth:450,viewBox:'0 0 450 600',findings:[],objects:[{id:'input',status:'active',entities:[{id:'x'}],bounds:{x:20,y:120,w:100,h:80}}]};
  assert.doesNotThrow(()=>assertSubjectCaptureStable(audit,audit,context,context));
  assert.throws(()=>assertSubjectCaptureStable(audit,{...audit,canvasWidth:465},context,context),/changed the actual browser view/);
  assert.throws(()=>assertSubjectCaptureStable(audit,audit,context,{...context,crop:{...context.crop,top:80}}),/reflowed/);
  assert.throws(()=>assertSubjectCaptureStable(audit,audit,context,{...context,clientWidth:885}),/viewport/);
  assert.throws(()=>assertSubjectCaptureStable(audit,{...audit,objects:[{...audit.objects[0],status:'pending'}]},context,context),/scientific state/);
  assert.throws(()=>assertSubjectCaptureRegions({...context,regions:[{left:0,top:90,width:100,height:40},...context.regions.slice(1)]}),/omits/);
});

/** Native capture may reflow layout. It must never adopt a changed player or
 * scientific snapshot as the baseline for its second attempt. */
function captureHarness(onScreenshot:(state:any,index:number)=>void){
  const state={
    audit:{theme:'light',viewportWidth:1440,canvasWidth:450,viewBox:'0 0 450 600',findings:[],objects:[{id:'input',status:'active',entities:[{id:'x'}],bounds:{x:20,y:120,w:100,h:80}}]},
    context:{crop:{left:10,top:100,width:500,height:1000},clientWidth:1440,selected:'Show Beat',playing:'false',regions:Array.from({length:5},()=>({left:20,top:110,width:100,height:40})),relationships:[{id:'read',active:'true'}]},
  };
  let screenshots=0;
  const writes:Array<{file:string;bytes:any}>=[];
  const control={count:async()=>0,click:async()=>{},evaluate:async()=>({top:0,height:20,viewportHeight:900})};
  const locator={filter(){return this;},evaluate:async()=>structuredClone(state.context)};
  const tab={url:async()=>'',goto:async()=>{},getAXState:async()=> '1 button Show Beat',click:async()=>{},getScreenshot:async()=>{},playwright:{domSnapshot:async()=>{},getByRole:()=>control,locator:()=>locator,evaluate:async()=>structuredClone(state.audit)},screenshot:async()=>{onScreenshot(state,++screenshots);return Buffer.from('mock native pixels');}};
  const fs={readFile:async()=> '[]',writeFile:async(file:string,bytes:any)=>{writes.push({file,bytes});}};
  const run=()=>captureSubjectMechanismView({browser:{capabilities:{get:async()=>({set:async()=>{}})}},tab,fs,root:'/private/mock',scene:{lessonId:'example',title:'Example',beats:[{title:'Beat'}],review:{contentDigest:'c'},parentContentDigest:'p'},view:{id:'wide-light',viewportWidth:1440,viewportHeight:900,theme:'light'},bindings:{},auditSource:'audit'});
  return {run,writes,screenshots:()=>screenshots};
}

test('capture orchestration rejects all semantic drift before writing evidence',async()=>{
  const changes=[
    (state:any)=>{state.context.playing='true';},
    (state:any)=>{state.context.selected='Show Other beat';},
    (state:any)=>{state.audit.objects[0].status='pending';},
    (state:any)=>{state.audit.objects[0].entities[0].id='other';},
    (state:any)=>{state.audit.objects[0].id='other-object';},
    (state:any)=>{state.context.relationships[0].active='false';},
    (state:any)=>{state.context.relationships[0].id='other-edge';},
  ];
  for(const change of changes){
    const harness=captureHarness((state,index)=>{if(index===1)change(state);});
    await assert.rejects(harness.run(),/changed the (paused player|requested scientific state|requested relationship state)/);
    assert.equal(harness.screenshots(),1);
    assert.equal(harness.writes.length,0);
  }
});

test('capture orchestration retries geometry reflow with fixed scientific and player state',async()=>{
  const harness=captureHarness((state,index)=>{
    if(index===1){state.context.crop.width=515;state.context.clientWidth=1425;state.audit.canvasWidth=465;state.audit.objects[0].bounds.w=110;}
  });
  await harness.run();
  assert.equal(harness.screenshots(),2);
  assert.equal(harness.writes.length,2);
  const manifest=JSON.parse(harness.writes.find(write=>write.file.endsWith('capture-manifest.json'))!.bytes);
  assert.equal(manifest[0].context.crop.width,515);
  assert.equal(manifest[0].context.playing,'false');
  assert.equal(manifest[0].context.selected,'Show Beat');
  assert.equal(manifest[0].audit.objects[0].entities[0].id,'x');
});

test('second adaptive capture still compares semantics with the original requested state',async()=>{
  const harness=captureHarness((state,index)=>{
    if(index===1)state.context.crop.width=515;
    if(index===2)state.context.relationships[0].active='false';
  });
  await assert.rejects(harness.run(),/requested relationship state/);
  assert.equal(harness.screenshots(),2);
  assert.equal(harness.writes.length,0);
});
