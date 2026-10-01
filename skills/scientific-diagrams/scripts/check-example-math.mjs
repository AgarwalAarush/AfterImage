import assert from 'node:assert/strict';
import {calculate,fixture as lora,semanticState as loraState} from '../examples/lora-rank-one.mjs';
import {accumulate,fixture as softmax,outputLabel,render,semanticState as softmaxState} from '../examples/online-softmax.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(a),Math.abs(b)));
assert.deepEqual(calculate(),{z:[1],base:[2,1],delta:[3,2],output:[5,3]});
// Independent merged-matrix formulation, including non-unit alpha/r.
const cases=[lora,{x:[2,-1,3],W0:[[1,2,0],[0,-1,2]],A:[[2,0,-1],[1,3,2]],B:[[2,-1],[0,3]],alpha:3,rank:2}];
for(const f of cases){const frozen=JSON.stringify(f),result=calculate(f);let merged=f.W0.map((row,i)=>row.map((w,j)=>w+f.alpha/f.rank*f.B[i].reduce((s,b,k)=>s+b*f.A[k][j],0)));let expected=merged.map(row=>row.reduce((s,w,i)=>s+w*f.x[i],0));expected.forEach((v,i)=>near(v,result.output[i]));assert.equal(JSON.stringify(f),frozen);}
const cases2=[softmax,{scores:[1000,1001,-1000],values:[-2,8,4]},{scores:[-1000,-1001,-999],values:[1,-3,5]},{scores:[0,0,0],values:[2,4,9]}];
for(const f of cases2){let max=Math.max(...f.scores),weights=f.scores.map(s=>Math.exp(s-max)),den=weights.reduce((a,b)=>a+b),expected=weights.reduce((sum,w,i)=>sum+w*f.values[i],0)/den,states=accumulate(f.scores,f.values);near(states.at(-1).output,expected);states.forEach((s,i)=>{assert(Number.isFinite(s.output));let sm=Math.max(...f.scores.slice(0,i+1));near(s.m,sm);near(s.l,f.scores.slice(0,i+1).reduce((sum,v)=>sum+Math.exp(v-sm),0));});}
const states=accumulate(softmax.scores,softmax.values);assert.equal(states[1].scale,.5);assert.equal(states[1].rescaled.u,2);assert.equal(states[1].l,1.5);assert.equal(states[1].u,10);near(states[1].output,20/3);assert.equal(outputLabel(),'20/3');assert(render({time:13000}).includes('20/3'));
for(let t=0;t<=16000;t+=100){let s=loraState(t);assert(!s.outputVisible||(s.baseVisible&&s.deltaVisible));assert(!s.deltaVisible||s.projectedVisible);assert(!softmaxState(t).outputVisible||softmaxState(t).phase==='normalize');}
console.log('Pass: LoRA branch/merged equivalence with scaling; stable online-softmax equivalence including extreme logits; displayed arithmetic and temporal dependency checks.');
