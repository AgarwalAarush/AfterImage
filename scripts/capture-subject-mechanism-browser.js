/** Run from the documented Codex browser runtime with injected browser/tab/fs handles.
 * Captures real pixels only. Independent criticism and approval remain separate.
 */
export async function captureSubjectMechanismView({browser,tab,fs,root,scene,view,bindings,auditSource}) {
  await (await browser.capabilities.get('viewport')).set({width:view.viewportWidth,height:view.viewportHeight});
  const url='http://127.0.0.1:3017/subjects/review/mechanisms/'+scene.lessonId;
  if(await tab.url()===url)await tab.reload();else await tab.goto(url);
  await tab.getAXState({emit:false});
  await tab.playwright.getByRole('button',{name:'Show '+scene.beats[0].title,exact:true}).click();
  await tab.getAXState({emit:false});
  await tab.playwright.getByRole('radio',{name:view.theme==='light'?'Light':'Dark',exact:true}).click();
  await tab.getAXState({emit:false});
  let captures=JSON.parse(await fs.readFile(root+'/capture-manifest.json','utf8'));
  for(let index=0;index<scene.beats.length;index++){
    await tab.playwright.getByRole('button',{name:'Show '+scene.beats[index].title,exact:true}).click();
    await tab.getAXState({emit:false});
    await tab.playwright.getByRole('heading',{name:scene.title,exact:true}).click();
    await tab.getAXState({emit:false});
    // A native full-page snapshot can alter the scrollbar gutter and reflow text.
    // Establish its geometry, then measure and capture without another UI action.
    await tab.screenshot({fullPage:true});
    const audit=await tab.playwright.evaluate(auditSource);
    if(audit.theme!==view.theme||audit.viewportWidth!==view.viewportWidth||audit.findings.length)throw Error('Actual browser view or geometry does not match the requested capture');
    const context=await tab.playwright.locator('svg').filter({has:tab.playwright.locator('[data-object]')}).evaluate(readSubjectCaptureContext);
    assertSubjectCaptureRegions(context);
    const id=scene.lessonId+'-'+view.id+'-'+index,rawPath=root+'/'+id+'-raw.png';
    await fs.writeFile(rawPath,await tab.screenshot({fullPage:true}));
    const after=await tab.playwright.evaluate(auditSource);
    const afterContext=await tab.playwright.locator('svg').filter({has:tab.playwright.locator('[data-object]')}).evaluate(readSubjectCaptureContext);
    assertSubjectCaptureStable(audit,after,context,afterContext);
    captures=captures.filter(capture=>capture.id!==id);
    captures.push({id,lessonId:scene.lessonId,viewId:view.id,beatIndex:index,audit,context,rawPath,capturedAt:new Date().toISOString(),bindings:{...bindings,contentDigest:scene.review.contentDigest,parentContentDigest:scene.parentContentDigest}});
    await fs.writeFile(root+'/capture-manifest.json',JSON.stringify(captures,null,2));
  }
  return {scene:scene.lessonId,view:view.id,frames:scene.beats.length,total:captures.length};
}
export function readSubjectCaptureContext(svg){
  const section=svg.closest('section'),rect=section.getBoundingClientRect();
  const box=element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top+scrollY,width:r.width,height:r.height};};
  return {
    crop:{left:Math.floor(rect.left),top:Math.floor(rect.top+scrollY),width:Math.ceil(rect.width),height:Math.ceil(rect.height)},
    regions:[section.querySelector('h3'),section.querySelector('.icon-button'),svg,section.querySelector('h4'),section.querySelector('[aria-label="Mechanism explanation steps"]')].map(box),
    svgHeight:svg.getBoundingClientRect().height,clientWidth:document.documentElement.clientWidth,
    playing:section.querySelector('.icon-button').getAttribute('aria-pressed'),selected:section.querySelector('[aria-current="step"]')?.getAttribute('aria-label'),
    relationships:[...svg.querySelectorAll('[data-relationship]')].map(g=>({id:g.getAttribute('data-relationship'),active:g.getAttribute('data-active')})),
    transition:[...svg.querySelectorAll('[data-object] > rect,[data-relationship]')].map(g=>({properties:getComputedStyle(g).transitionProperty,duration:getComputedStyle(g).transitionDuration})),
    textMetrics:[...svg.querySelectorAll('[data-object] > text')].map(t=>({text:t.textContent,width:t.getBoundingClientRect().width,fontSize:getComputedStyle(t).fontSize,fontWeight:getComputedStyle(t).fontWeight})),
  };
}
export function assertSubjectCaptureRegions(context){
  if(!context.regions||context.regions.length!==5)throw Error('Capture is missing card regions');
  const c=context.crop;
  for(const r of context.regions)if(r.width<=0||r.height<=0||r.left<c.left-1||r.top<c.top-1||r.left+r.width>c.left+c.width+1||r.top+r.height>c.top+c.height+1)throw Error('Capture crop omits a required card region');
}
export function assertSubjectCaptureStable(before,after,context,next){
  assertSubjectCaptureRegions(next);
  if(before.theme!==after.theme||before.viewportWidth!==after.viewportWidth||Math.abs(before.canvasWidth-after.canvasWidth)>.5||before.viewBox!==after.viewBox||after.findings.length)throw Error('Native capture changed the actual browser view');
  for(const key of ['left','top','width','height'])if(Math.abs(context.crop[key]-next.crop[key])>1)throw Error('Native capture reflowed the measured card crop');
  if(context.clientWidth!==next.clientWidth||context.selected!==next.selected||context.playing!==next.playing)throw Error('Native capture changed viewport or selected controls');
  const signature=objects=>objects.map(object=>[object.id,object.status,object.entities.map(entity=>entity.id)]);
  if(JSON.stringify(signature(before.objects))!==JSON.stringify(signature(after.objects)))throw Error('Native capture changed the selected scientific state');
  const origin=objects=>({x:Math.min(...objects.map(o=>o.bounds.x)),y:Math.min(...objects.map(o=>o.bounds.y))}),a=origin(before.objects),b=origin(after.objects);
  for(const object of before.objects){const other=after.objects.find(o=>o.id===object.id);if(!other||Math.abs(object.bounds.x-a.x-other.bounds.x+b.x)>.5||Math.abs(object.bounds.y-a.y-other.bounds.y+b.y)>.5||Math.abs(object.bounds.w-other.bounds.w)>.5||Math.abs(object.bounds.h-other.bounds.h)>.5)throw Error('Native capture changed diagram geometry');}
}
