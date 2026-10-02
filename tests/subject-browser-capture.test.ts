import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSubjectCaptureRegions,assertSubjectCaptureStable} from '../scripts/capture-subject-mechanism-browser.js';
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
