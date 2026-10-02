import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { volumeBackground, volumeRendering } from "../src/lib/subject-experiments";
import { VolumeRenderingDrawing } from "../src/components/subject-volume-rendering";

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test("volume rendering obeys the alpha/prefix recurrence and conserves sample plus background weight",()=>{
  for(const density of [0,.00001,.41357,1,2.5,4]){
    const ray=volumeRendering(density);let opticalDepth=0;
    ray.samples.forEach(sample=>{
      close(sample.alpha,1-Math.exp(-sample.sigma*sample.delta));
      close(sample.transmittance,Math.exp(-opticalDepth));
      close(sample.weight,sample.transmittance*sample.alpha);
      opticalDepth+=sample.sigma*sample.delta;
    });
    close(ray.backgroundWeight,Math.exp(-opticalDepth));
    close(ray.samples.reduce((sum,sample)=>sum+sample.weight,0)+ray.backgroundWeight,1);
    ray.pixel.forEach((channel,c)=>{
      close(channel,ray.samples.reduce((sum,sample)=>sum+sample.weight*sample.color[c],0)+ray.backgroundWeight*volumeBackground[c]);
      assert.ok(channel>=0&&channel<=1);
    });
  }
});
test("front density changes occlusion continuously while fixed samples retain colors and identities",()=>{
  const clear=volumeRendering(0),a=volumeRendering(.41357),b=volumeRendering(.41358),opaque=volumeRendering(4);
  assert.equal(clear.samples[0].weight,0);
  assert.equal(a.samples[0].sigma,.41357);
  assert.ok(b.samples[0].weight>a.samples[0].weight);
  assert.ok(b.samples[1].weight<a.samples[1].weight);
  assert.ok(opaque.backgroundWeight<clear.backgroundWeight);
  assert.deepEqual(a.samples.map(({id,position,delta,color})=>({id,position,delta,color})),opaque.samples.map(({id,position,delta,color})=>({id,position,delta,color})));
  for(let i=1;i<4;i++)assert.ok(opaque.samples[i].weight<clear.samples[i].weight);
});
test("the ray drawing retains fixed sample positions and partitions its contribution strip by exact weights",()=>{
  const render=(density:number)=>load(renderToStaticMarkup(React.createElement("svg",null,React.createElement(VolumeRenderingDrawing,{width:660,density}))),{xml:true});
  const clear=render(0),dense=render(4);
  for(const id of ["S1","S2","S3","S4"]){
    const a=clear(`[data-sample='${id}'] circle`),b=dense(`[data-sample='${id}'] circle`);
    assert.equal(a.attr("cx"),b.attr("cx"));assert.equal(a.attr("cy"),b.attr("cy"));assert.equal(a.attr("fill"),b.attr("fill"));
  }
  for(const $ of [clear,dense]){
    const segments=$("[data-contribution]").toArray();assert.equal(segments.length,5);
    const widths=segments.map(element=>Number($(element).attr("width")));
    assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-624)<.0003);
  }
  assert.notEqual(clear("[data-final-pixel]").attr("fill"),dense("[data-final-pixel]").attr("fill"));
});
