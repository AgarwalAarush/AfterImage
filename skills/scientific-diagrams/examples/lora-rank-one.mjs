import {wrap,matrix,text,arrow,reveal,discrete} from './fixture-svg.mjs';
export const duration=16000,posterTime=13000;
export const sampleTimes=[0,1600,2800,3200,4600,5200,6000,6800,8200,9000,13000,15800];
export const reviewFiles=['lora-rank-one.json','fixture-svg.mjs','preview.html'];
export const fixture={x:[2,1],A:[[1,-1]],B:[[3],[2]],W0:[[1,0],[0,1]],alpha:1,rank:1};
export function calculate({x,A,B,W0,alpha,rank}=fixture){const mv=(m,v)=>m.map(row=>row.reduce((s,a,i)=>s+a*v[i],0));let z=mv(A,x),base=mv(W0,x),delta=mv(B,z).map(v=>v*alpha/rank);return {z,base,delta,output:base.map((v,i)=>v+delta[i])};}
export function semanticState(time){return {time,baseVisible:time>=3200,projectedVisible:time>=3200,deltaVisible:time>=6400,outputVisible:time>=8600,...calculate()};}
export function render(options={}){
 const {time=posterTime,animated=false}=options,v=calculate();
 let body=`<g data-concept="input">${text(40,88,'x','math')}${matrix(40,147,2,1,fixture.x)}</g>${arrow('M64 130V78H168M64 164V206H142')}
 <g data-concept="frozen-weight">${text(224,31,'W₀ · frozen')}${matrix(224,78,2,2,fixture.W0.flat())}</g>${arrow('M278 78H453')}
 <g data-concept="A">${text(192,167,'A · 1 × 2')}${matrix(192,206,1,2,fixture.A.flat(),{accent:true})}</g>${arrow('M239 206H271')}
 ${reveal(2800,time,animated,matrix(292,206,1,1,v.z,{accent:true}),'data-concept="projected"')}${arrow('M316 206H342')}
 <g data-concept="B">${text(370,159,'B · 2 × 1')}${matrix(370,206,2,1,fixture.B.flat(),{accent:true})}</g>${arrow('M396 206H453')}
 ${reveal(2800,time,animated,text(486,31,'W₀x')+matrix(486,78,2,1,v.base),'data-concept="base"')}
 ${reveal(6000,time,animated,text(486,159,'BAx')+matrix(486,206,2,1,v.delta,{accent:true}),'data-concept="delta"')}
 ${arrow('M512 78H566V132M512 206H566V164M582 148H599')}<circle cx="566" cy="148" r="15" fill="var(--surface)" stroke="var(--line)"/>${text(566,156,'+','number')}
 ${reveal(8200,time,animated,text(629,88,'h','math')+matrix(629,147,2,1,v.output,{accent:true}),'data-concept="output"')}
 ${discrete([[0,text(340,290,'The same input feeds both branches.','caption')],[2800,text(340,290,'A projects two coordinates into one scalar.','caption')],[4600,text(340,290,'B expands that scalar into the rank-one update.','caption')],[8200,text(340,290,'Add the frozen result and the learned update.','caption')]],time,animated)}`;
 return wrap({...options,time,body,title:'LoRA: a rank-one update',description:'Illustrative learned parameters, not zero initialization. x=[2,1], A=[1,-1], B=[3,2] transpose, W0=identity and alpha/r=1. Both branches use x. Ax=1, BAx=[3,2], W0x=[2,1], h=[5,3]. Timing guides attention, not parallel execution latency.'});
}
