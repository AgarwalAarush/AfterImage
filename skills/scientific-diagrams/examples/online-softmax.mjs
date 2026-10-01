import {wrap,text,arrow,discrete,reveal,track} from './fixture-svg.mjs';
export const duration=16000,posterTime=13000;
export const sampleTimes=[0,1600,2500,2900,4800,5500,6500,7500,7900,9200,9800,13000,15800];
export const reviewFiles=['online-softmax.json','fixture-svg.mjs','preview.html'];
export const fixture={scores:[0,Math.log(2)],values:[4,8]};
export function accumulate(scores,values){let m=-Infinity,l=0,u=0;return scores.map((s,i)=>{const next=Math.max(m,s),scale=Math.exp(m-next),weight=Math.exp(s-next);let previous={m,l,u},rescaled={m:next,l:l*scale,u:u*scale};m=next;l=rescaled.l+weight;u=rescaled.u+weight*values[i];return {previous,rescaled,scale,weight,m,l,u,output:u/l};});}
export function semanticState(time){const states=accumulate(fixture.scores,fixture.values);return {time,phase:time<2500?'initial':time<5500?'first-block':time<7500?'rescale-previous':time<9200?'add-second':'normalize',states,outputVisible:time>=9600};}
function totals(m,l,u){return text(285,120,'m','math','start')+text(448,120,m,'number')+text(285,160,'ℓ','math','start')+text(448,160,l,'number')+text(285,200,'u','math','start')+text(448,200,u,'number');}
const fmt=n=>n===-Infinity?'−∞':Math.abs(n-Math.log(2))<1e-12?'ln 2':n===.5?'½':n===1.5?'1½':String(n);
export function outputLabel(){const {u,l}=accumulate(fixture.scores,fixture.values).at(-1);return `${u*2}/${l*2}`;}
export function render(options={}){
 const {time=posterTime,animated=false}=options;
 const [first,second]=accumulate(fixture.scores,fixture.values),initial=first.previous,old=second.rescaled;
 let body=`${text(106,51,'Block 1')}${text(106,165,'Block 2')}<g data-concept="block-1"><rect x="29" y="70" width="154" height="65" rx="6" class="box"/>${text(106,97,`s = ${fmt(fixture.scores[0])}`,'number')}${text(106,125,`v = ${fixture.values[0]}`,'number')}</g><g data-concept="block-2"><rect x="29" y="184" width="154" height="65" rx="6" class="box"/>${text(106,211,`s = ${fmt(fixture.scores[1])}`,'number')}${text(106,239,`v = ${fixture.values[1]}`,'number')}</g>
 ${arrow('M188 104H243M188 216H210V160H243')}${text(380,51,'Running row state')}<rect x="253" y="77" width="255" height="149" rx="6" class="active"/>
 ${track([[0,0],[2200,0],[2500,1],[5100,1],[5500,0],[16000,0]],time,animated,'<rect x="29" y="70" width="154" height="65" rx="6" fill="none" stroke="var(--accent)"/>')}
 ${track([[0,0],[5100,0],[5500,1],[15200,1],[15600,0],[16000,0]],time,animated,'<rect x="29" y="184" width="154" height="65" rx="6" fill="none" stroke="var(--accent)"/>')}
 ${discrete([[0,totals(fmt(initial.m),fmt(initial.l),fmt(initial.u))],[2500,totals(fmt(first.m),fmt(first.l),fmt(first.u))],[5500,totals(fmt(old.m),fmt(old.l),fmt(old.u))],[7500,totals(fmt(second.m),fmt(second.l),fmt(second.u))]],time,animated,'data-concept="accumulator"')}
 ${discrete([[0,''],[5500,text(380,252,`Rescale ℓ and u by ${fmt(second.scale)}`,'small')],[7500,text(380,252,`Add (ℓ, u) = (${fmt(second.weight)}, ${second.weight*fixture.values[1]})`,'small')]],time,animated)}
 ${reveal(9200,time,animated,arrow('M513 160H552')+text(606,102,'u / ℓ')+'<rect x="559" y="120" width="95" height="78" rx="6" class="active"/>'+text(606,169,outputLabel(),'number'),'data-concept="output"')}
 ${discrete([[0,text(340,295,'Start with an empty accumulator.','caption')],[2500,text(340,295,'The first block contributes weight 1 and value 4.','caption')],[5500,text(340,295,'A larger maximum rescales the previous totals.','caption')],[7500,text(340,295,'Keep the totals; incorporate the next block.','caption')],[9200,text(340,295,'Normalize: 10 ÷ 1½ = 20/3.','caption')]],time,animated)}`;
 return wrap({...options,time,body,title:'Online softmax: rescale and retain the accumulator',description:'Illustrative one-row values: logits 0 and ln2, values 4 and 8. Equivalent numerator form u=ell times O of FlashAttention Algorithm1. Initial m=-infinity, ell=0,u=0. First totals 0,1,4. New max ln2 rescales previous ell and u by 1/2; adding the second block gives ell=1.5,u=10 and output 20/3. The rescale-only frame is an intermediate calculation, not a separate storage write. GPU storage and latency are omitted.'});
}
