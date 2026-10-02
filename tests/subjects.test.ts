import test from "node:test";
import assert from "node:assert/strict";
import { experimentControls, experimentState, onlineAttention, projectShellPoint, rmsShellDirections, shellCanvasHeight, streamingScores, streamingValues } from "../src/lib/subject-experiments";
import { experimentKinds, subjectEntrySchema, subjectPublicLessonSchema, validateSubjectLesson } from "../src/lib/subjects";
import catalog from "../src/content/subjects/catalog.json";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { subjectPublicationDigest } from "../src/lib/subject-publication";

test("catalog has complete unique topic identities and primary-paper links",()=>{
  assert.equal(catalog.entries.length,100);
  assert.equal(new Set(catalog.entries.map(entry=>entry.id)).size,100);
  for(const raw of catalog.entries){const entry=subjectEntrySchema.parse(raw);assert.equal(entry.primaryUrl,`https://arxiv.org/abs/${entry.arxivId}`);assert.equal(new URL(entry.referenceUrl).hostname,"intuitivepapers.ai");}
});
test("all bounded experiments remain deterministic and finite at extrema and midpoints",()=>{
  for(const kind of experimentKinds){const c=experimentControls[kind];for(const value of [c.min,c.initial,c.max,NaN]){
    const state=experimentState(kind,value);
    assert.deepEqual(state,experimentState(kind,value));
    assert.ok([...state.values,...state.reference].every(Number.isFinite),kind);
    assert.ok(state.values.length>0);
    assert.ok(state.selected.every(index=>index>=0&&index<state.values.length));
  }}
});
test("attention and contrastive probabilities preserve their declared normalization",()=>{
  for(const temperature of [.2,1,2]){
    assert.ok(Math.abs(experimentState("attention",temperature).values.reduce((a,b)=>a+b,0)-1)<1e-12);
    const values=experimentState("contrastive",temperature).values;
    for(let row=0;row<3;row++)assert.ok(Math.abs(values.slice(row*3,row*3+3).reduce((a,b)=>a+b,0)-1)<1e-12);
  }
});
test("seeded noise histograms preserve sample count across dimensions and scales",()=>{
  for(const dimension of [3,16,128])for(const sigma of [.1,.6,1.5])assert.equal(experimentState("noise",sigma,dimension).values.reduce((a,b)=>a+b,0),256);
});
test("routing derives selected counts and memory separates live padding and free slots",()=>{
  for(const k of [1,2,3])assert.equal(experimentState("routing",k).selected.length,4*k);
  for(const block of [1,4,8]){
    const state=experimentState("memory",block);
    assert.equal(state.values.filter(x=>x===1).length,9);
    assert.equal(state.values.filter(x=>x===.35).length,Math.ceil(9/block)*block-9);
  }
});
test("illustrative numerical experiments expose their actual computations",()=>{
  assert.equal(experimentState("policy",1.5).values[1],1.2);
  assert.equal(experimentState("policy",.6).values[1],.6);
  assert.deepEqual(experimentState("graph",1).values,[.5,1/3,0]);
  assert.ok(experimentState("quantization",8).values.every(value=>Math.abs(value)<=1));
  assert.deepEqual(experimentState("low-rank",2).values,[6,4,0,0,0,0]);
});
test("online softmax preserves the dense attention result across every tile partition and order",()=>{
  for(const order of ["forward","reverse"] as const)for(const width of [1,2,3,4]){
    const result=onlineAttention(width,order),final=result.steps.at(-1)!;
    assert.ok(Math.abs(final.output!-result.denseOutput)<1e-12);
    assert.deepEqual([...final.visited].sort(),[0,1,2,3]);
    assert.equal(result.steps[0].max,null);
    assert.equal(result.steps[0].output,null);
    for(const step of result.steps.slice(1)){
      const max=Math.max(...step.visited.map(i=>streamingScores[i]));
      const normalizer=step.visited.reduce((sum,i)=>sum+Math.exp(streamingScores[i]-max),0);
      const accumulator=step.visited.reduce((sum,i)=>sum+Math.exp(streamingScores[i]-max)*streamingValues[i],0);
      assert.equal(step.max,max);
      assert.ok(Math.abs(step.normalizer-normalizer)<1e-12);
      assert.ok(Math.abs(step.accumulator-accumulator)<1e-12);
    }
  }
  assert.ok(onlineAttention(1,"reverse").steps.slice(2).every(step=>step.rescale>0&&step.rescale<1));
});
test("RMS shells preserve their seeded sphere identities and bounded projection through rotation",()=>{
  const directions=rmsShellDirections();
  assert.equal(directions.length,240);
  assert.deepEqual(directions,rmsShellDirections());
  for(const point of directions)assert.ok(Math.abs(Math.hypot(...point)-1)<1e-12);
  for(const width of [280,350,660])for(const yaw of [0,.6,Math.PI/2,Math.PI])for(const pitch of [-1.4,.35,1.4])for(const sigma of [.1,.4,.8,1]){
    for(const direction of directions){const point=projectShellPoint(direction.map(coordinate=>coordinate*sigma*Math.sqrt(3)) as [number,number,number],yaw,pitch,width);assert.ok(point.x>0&&point.x<width);assert.ok(point.y>90&&point.y<shellCanvasHeight(width)-25);assert.ok(Number.isFinite(point.depth));}
  }
});
test("bundled lessons have current content fingerprints and no unresolved references",()=>{
  const dir="src/content/subjects/lessons";
  if(!existsSync(dir))return;
  for(const file of readdirSync(dir).filter(name=>name.endsWith(".json"))){
    const data=JSON.parse(readFileSync(`${dir}/${file}`,"utf8"));const lesson=subjectPublicLessonSchema.parse(data);
    assert.equal(data.review.status,"passed");
    assert.ok(data.claims.every((claim:Record<string,unknown>)=>!("evidence" in claim)),"Private audit excerpts must not be bundled for readers");
    assert.equal(data.review.contentDigest,subjectPublicationDigest(lesson,data),file);
    assert.ok(catalog.entries.some(entry=>entry.id===data.id));
    const claims=new Set(lesson.claims.map(claim=>claim.id)), sources=new Set(data.sources.map((source:{id:string})=>source.id));
    for(const section of lesson.sections){assert.ok(section.claimIds.every(id=>claims.has(id)));assert.ok(section.sourceIds.every(id=>sources.has(id)));}
    for(const figure of lesson.figures)assert.equal(lesson.sections.filter(section=>section.figureId===figure.id).length,1);
  }
});

test("publication fingerprints bind the research provenance as well as the lesson",()=>{
  const dir="src/content/subjects/lessons";
  const file=readdirSync(dir).find(name=>name.endsWith(".json"));
  assert.ok(file,"A reviewed lesson is required for the provenance check");
  const published=JSON.parse(readFileSync(`${dir}/${file}`,"utf8"));
  const lesson=subjectPublicLessonSchema.parse(published);
  const original=subjectPublicationDigest(lesson,published);
  for(const mutation of [
    {...published,id:published.id+"-changed"},
    {...published,pipelineVersion:published.pipelineVersion+"-changed"},
    {...published,sources:published.sources.map((source:Record<string,unknown>,index:number)=>index===0?{...source,url:"https://arxiv.org/abs/0000.00000"}:source)},
    {...published,sources:published.sources.map((source:Record<string,unknown>,index:number)=>index===0?{...source,digest:"0".repeat(64)}:source)},
  ])assert.notEqual(subjectPublicationDigest(lesson,mutation),original);
});
