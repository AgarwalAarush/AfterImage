import test from "node:test";
import assert from "node:assert/strict";
import { smoothQuantInput, smoothQuantScaling, smoothQuantWeights } from "../src/lib/subject-experiments";

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test("SmoothQuant paired scaling preserves every channel contribution and full matrix product",()=>{
  for(let i=0;i<=100;i++){
    const state=smoothQuantScaling(i/100);
    state.scales.forEach((scale,channel)=>{
      assert.ok(scale>0);
      smoothQuantInput.forEach((row,token)=>smoothQuantWeights[channel].forEach((weight,output)=>{
        close(state.activations[token][channel]*state.weights[channel][output],row[channel]*weight);
      }));
    });
    state.output.forEach((row,token)=>row.forEach((value,output)=>close(value,state.scaledOutput[token][output])));
    assert.ok(state.maxProductError<1e-12);
  }
  assert.deepEqual(smoothQuantScaling(.5).output,[[7,-1.5],[-1.5,1.75]]);
});
test("migration strength changes actual activation/weight maxima according to the declared calibration formula",()=>{
  const activationEndpoint=smoothQuantScaling(1),weightEndpoint=smoothQuantScaling(0),balanced=smoothQuantScaling(.5);
  activationEndpoint.activationMaxima.forEach(maximum=>close(maximum,1));
  weightEndpoint.weightMaxima.forEach(maximum=>close(maximum,1));
  balanced.activationMaxima.forEach((maximum,channel)=>{
    close(maximum,balanced.weightMaxima[channel]);
    close(maximum,Math.sqrt(balanced.originalActivationMaxima[channel]*balanced.originalWeightMaxima[channel]));
  });
  assert.deepEqual(balanced.scales,[4,Math.sqrt(2),1]);
  assert.ok(balanced.activationMaxima[0]<balanced.originalActivationMaxima[0]);
  assert.ok(balanced.weightMaxima[0]>balanced.originalWeightMaxima[0]);
  const a=smoothQuantScaling(.41357),b=smoothQuantScaling(.41358);
  assert.equal(a.alpha,.41357);
  assert.ok(b.activationMaxima[0]<a.activationMaxima[0]);
  assert.ok(b.weightMaxima[0]>a.weightMaxima[0]);
});
