import type { SubjectFigure } from "./subjects";

export const experimentContracts = {
  "rolling-window": "Original sequential read-before-write instance of Mistral section-2 causal window and rolling cache, not weights, GQA, byte capacity or measured speed. Fixed12positions0..11 and W=4 previous-token cache slots. Continuous raw slider is interpreted as whole query position i0..11. Before query i, cache holds max(0,i-W)..i-1 at position moduloW; current K/V i is separate and locally available. Eligible attention positions are max(0,i-W)..i including current, preserving the primary inclusive i-W..i rule. Read previous cache and current state before writing current into slot i modW, overwriting i-W only after reading it when i>=W. Updatedcache stores latestWpositions max(0,i-W+1)..i. Show fixed token identities, previous/current/expired/future distinction, before/after slots, write slot and evicted identity. Do not conflate W previous positions plus current with W slots already including current; this read-before-write convention is explicitly constructed to teach both cited formulas. No attention probabilities, layered reach, prompt chunking, measured memory/runtime or output-quality claims.",
  "paired-scaling": "Original constructed SmoothQuant paired channel scaling, section-4 equations (3),(4), before quantization. Fixed X=[[8,2,-1],[-4,1,0.5]] (two tokens,three channels) and W=[[0.5,-0.25],[1,0.5],[-1,0.5]] (three input channels,two outputs). Activation-channel maxima a=[8,2,1], weight-row maxima b=[0.5,1,1]. Continuous migration alpha0..1 determines s_j=a_j^alpha/b_j^(1-alpha). Xprime columns divide by s_j; Wprime corresponding rows multiply by s_j. Actual matrix products Y=XW and Yprime=XprimeWprime agree up to floating-point roundoff at every alpha. Y=[[7,-1.5],[-1.5,1.75]]. Plot actual channel maxima of original/transformed X and W on fixed0..8 amplitude axes; show scales and full numeric table. Atalpha0 weight maxima all1, atalpha1 activation maxima all1; atalpha0.5 each paired channel max matches sqrt(a_j*b_j). Chosen maxima/values are constructed arithmetic, not calibration or empirical accuracy; no INT8 rounding or quantization-error measurement is implemented.",
  "volume-rendering": "Original constructed four-interval 1D ray illustrating NeRF section-4 equation (3), not a trained field or empirical scene. Fixed delta=1 for each interval; density slider 0..4 changes only sample S1, with S2..S4 densities [0.5,1.5,0.75]. Fixed sample RGB colors are [[0.85,0.25,0.15],[0.2,0.65,0.35],[0.2,0.35,0.85],[0.8,0.65,0.2]] and background [1,1,1]. Each alpha=1-exp(-sigma*delta); T1=1, wi=Ti*alpha_i, Tnext=Ti*(1-alpha_i). Final RGB=sum wi*ci+Tafter4*background. Stable sample positions/identities and colors; show alpha, prefix T, weight, remaining background, and final pixel. Increasing front density occludes later samples. Constructed colors/densities are not paper measurements; no learned NeRF, stratified/hierarchical sampling or reconstruction-quality claim.",
  "streaming-attention": "Exact online softmax for one query, four keys with fixed scores [2,1,0,-1] and scalar values [3,5,-2,1]. Tile width 1..4 and explicit forward/reverse visit order change the partitions and intermediate state, never the final dense attention output. At each tile update m'=max(m,max(scores)), rescale=exp(m-m') (0 for initial empty state), ell'=rescale*ell+sum exp(score-m'), u'=rescale*u+sum exp(score-m')*value, output=u'/ell'. Steps show only visited keys, carried maximum, normalizer, weighted accumulator and partial/final output. No measured memory traffic or runtime claim.",
  "noise-shells": "Original deterministic 3D projection of two ideal thin RMS spheres about a single data point (D=3,d=0). Outer sigma=1 gives radius sqrt(3); inner sigma control 0.1..0.8 gives radius sigma*sqrt(3). Each sphere uses 240 seeded uniform directions scaled to its declared radius. Drag/keyboard/play rotates the shared camera only; both/inner/outer visibility switches preserve coordinates and sigma. Ideal surfaces represent RMS radii, not actual Gaussian draws or high-dimensional coordinates. No concentration or disjoint-shell claim in D=3.",
  noise: "A seeded Gaussian sample in D dimensions: histogram of sample norm, RMS radius sigma*sqrt(D), and measured mean radius. Sigma changes lengths; dimension changes concentration. D is not plotted as three physical dimensions.",
  attention: "Four illustrative fixed scores [2,1,0,-1] divided by a positive temperature, then softmax. Shows normalized attention weights, not a measured head or learned token similarity.",
  "low-rank": "Retain the first r singular components of a fixed diagonal 6x6 example with singular values [6,4,3,2,1,0.5]. Shows retained energy and rank; not a trained LoRA update or a reported compression result.",
  normalization: "Five fixed activations [-2,-1,0,2,6]. Offset changes raw activations; standardization subtracts their mean and divides by population standard deviation. One illustrative vector, not a full BatchNorm/LayerNorm training implementation.",
  optimizer: "Gradient descent on the illustrative scalar quadratic f(x)=x^2/2 from x=3. Learning rate changes 12 update iterates. This is plain gradient descent, not an Adam/RMSProp simulator.",
  policy: "PPO clipped surrogate for positive illustrative advantage A=1: min(r,clip(r,1-epsilon,1+epsilon)). Ratio changes the current objective; epsilon=0.2. Not the full RL algorithm or a bound on the actual KL.",
  quantization: "Round a fixed vector [-0.8,-0.3,0.1,0.7] to uniformly spaced levels on [-1,1]. Bits changes available levels and reconstruction MSE. Uniform scalar quantization, not NF4 or a trained/codebook-specific codec.",
  memory: "A 16-slot illustrative KV block layout with 9 live tokens. Block width changes allocation padding, compared with a fixed 16-slot reservation. No physical byte/latency measurements or allocator implementation.",
  routing: "A four-token, three-expert illustrative affinity grid. Each token selects top-k experts along its row. k changes selected cells and derived expert load. This is token-choice routing, not expert-choice or a load-balancing training objective.",
  patches: "An 8x8 illustrative image grid. A deterministic mask hides a controlled fraction of cells. Shows visible and masked patch count, not reconstruction quality or a real encoder.",
  state: "Scalar illustrative recurrence h_t=a*h_(t-1)+u_t with a single initial impulse u_0=1. Retention a changes decay over 12 steps. Not a selective/complex Mamba or a learned world-model rollout.",
  contrastive: "A fixed 3x3 illustrative image/text similarity matrix. Temperature changes row-softmax match probabilities. Diagonal represents declared paired examples; no claims about actual embedding similarity.",
  graph: "Three-node chain with scalar node features [1,0,0]. Repeated self-inclusive neighbor mean aggregation changes the displayed features. Not a full trained GCN; symmetric degree normalization is outside scope.",
  search: "A fixed binary tree with four illustrative terminal values [0.2,0.8,0.4,0.6]. Expanding a frontier changes which terminal values are revealed. Equal-cost breadth-first exploration, not MCTS, learned search, or a guarantee of improved policy.",
  latent: "Scalar illustrative posterior q=N(mu,1) versus standard normal p=N(0,1). Mean changes the two density curves and KL=mu^2/2. No learned posterior or reconstruction likelihood is simulated.",
  ode: "Forward Euler for dx/dt=-x from x(0)=1 over t in [0,3]. Step size changes numerical trajectory versus exp(-t). Not an adaptive solver, adjoint implementation, or learned vector field.",
  scaling: "Illustrative power law L(N)=1+4*N^(-0.3). Resource multiplier N changes the excess-loss term. Coefficients are invented for teaching, not fitted scaling laws or an optimal compute allocation.",
  guidance: "Two illustrative scalar fields: unconditional velocity -x and conditional velocity -(x-1). Linear extrapolation v=v_uncond+w*(v_cond-v_uncond) moves the equilibrium to x=w. This is a toy field, not actual image sampling or an empirical quality/diversity curve.",
  retrieval: "Four explicitly illustrative candidate scores [0.9,0.7,0.5,0.2]. Top-k reveals ranked contexts while preserving scores. No actual corpus, embeddings, retrieval quality, or generated answer.",
  spatial: "A fixed Gaussian radial footprint exp(-r^2/(2*sigma^2)) across a 2D grid. Width changes the footprint, not a trained 3D scene, ray integral, or measured rendering performance.",
} satisfies Record<SubjectFigure["kind"], string>;

export const experimentControls: Record<SubjectFigure["kind"], {label: string; min: number; max: number; step: number; initial: number}> = {
  "rolling-window": {label:"Query position i",min:0,max:11,step:1,initial:5},
  "paired-scaling": {label:"Migration strength α",min:0,max:1,step:0.05,initial:0.5},
  "volume-rendering": {label:"Front-sample density σ₁",min:0,max:4,step:0.1,initial:1},
  "streaming-attention": {label: "Scores per tile", min:1,max:4,step:1,initial:2},
  "noise-shells": {label: "Inner noise σ",min:0.1,max:0.8,step:0.01,initial:0.4},
  noise: {label: "Noise scale σ", min: 0.1, max: 1.5, step: 0.05, initial: 0.6},
  attention: {label: "Temperature", min: 0.2, max: 3, step: 0.1, initial: 1},
  "low-rank": {label: "Retained rank", min: 1, max: 6, step: 1, initial: 2},
  normalization: {label: "Input offset", min: -4, max: 4, step: 0.2, initial: 0},
  optimizer: {label: "Learning rate", min: 0.05, max: 1.8, step: 0.05, initial: 0.4},
  policy: {label: "Policy ratio r", min: 0.5, max: 1.6, step: 0.02, initial: 1},
  quantization: {label: "Bits per value", min: 1, max: 8, step: 1, initial: 3},
  memory: {label: "Slots per block", min: 1, max: 8, step: 1, initial: 4},
  routing: {label: "Experts per token k", min: 1, max: 3, step: 1, initial: 1},
  patches: {label: "Masked fraction", min: 0, max: 1, step: 0.0625, initial: 0.75},
  state: {label: "State retention a", min: 0, max: 1, step: 0.05, initial: 0.8},
  contrastive: {label: "Temperature", min: 0.2, max: 2, step: 0.1, initial: 0.7},
  graph: {label: "Aggregation steps", min: 0, max: 6, step: 1, initial: 1},
  search: {label: "Revealed leaves", min: 1, max: 4, step: 1, initial: 2},
  latent: {label: "Posterior mean μ", min: -2, max: 2, step: 0.1, initial: 1},
  ode: {label: "Euler step size", min: 0.1, max: 1, step: 0.1, initial: 0.5},
  scaling: {label: "Resource multiplier N", min: 1, max: 32, step: 1, initial: 4},
  guidance: {label: "Guidance weight w", min: 0, max: 3, step: 0.1, initial: 1},
  retrieval: {label: "Retrieved contexts k", min: 1, max: 4, step: 1, initial: 2},
  spatial: {label: "Gaussian width σ", min: 0.3, max: 2, step: 0.1, initial: 0.8},
};
export type ExperimentResult = {
  values: number[]; reference: number[]; labels: string[]; coordinates?: number[];
  metric: string; detail: string; grid: boolean; selected: number[];
};
/** Fixed display domains keep the same quantity comparable throughout a parameter sweep. */
export const experimentPlotDomains: Partial<Record<SubjectFigure["kind"], [number, number]>> = {
  noise: [0,256], attention:[0,1], "low-rank":[0,6], normalization:[-6,10],
  optimizer:[-3,3], policy:[0,1.6], quantization:[-1,1], state:[0,1],
  graph:[0,1], search:[0,1], latent:[0,.4], ode:[0,1], scaling:[0,4],
  guidance:[-3,4], retrieval:[0,1],
};
const softmax = (scores: number[]) => { const largest = Math.max(...scores); const e = scores.map(x => Math.exp(x - largest)); const sum = e.reduce((a,b) => a+b,0); return e.map(x => x/sum); };
const gaussianRadiusSamples=new Map<number,readonly number[]>();
function seededGaussianRadii(d:number){
  const cached=gaussianRadiusSamples.get(d);if(cached)return cached;
  let seed=1234567;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return (seed+1)/4294967297;};
  const radii=Object.freeze(Array.from({length:256},()=>Math.sqrt(Array.from({length:d},()=>{const z=Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());return z*z;}).reduce((a,b)=>a+b,0))));
  gaussianRadiusSamples.set(d,radii);return radii;
}

export const streamingScores=[2,1,0,-1] as const, streamingValues=[3,5,-2,1] as const;
export type OnlineAttentionStep={indices:number[];visited:number[];max:number|null;normalizer:number;accumulator:number;rescale:number;output:number|null};
export function onlineAttention(tileWidth:number,order:"forward"|"reverse"="forward"){
  const width=Math.round(Math.max(1,Math.min(4,Number.isFinite(tileWidth)?tileWidth:2)));
  const indices=order==="forward"?[0,1,2,3]:[3,2,1,0];
  const weights=softmax([...streamingScores]);
  const denseOutput=weights.reduce((sum,weight,i)=>sum+weight*streamingValues[i],0);
  const steps:OnlineAttentionStep[]=[{indices:[],visited:[],max:null,normalizer:0,accumulator:0,rescale:0,output:null}];
  for(let start=0;start<indices.length;start+=width){
    const tile=indices.slice(start,start+width),previous=steps.at(-1)!;
    const max=Math.max(previous.max??-Infinity,...tile.map(i=>streamingScores[i]));
    const rescale=previous.max===null?0:Math.exp(previous.max-max);
    const normalizer=rescale*previous.normalizer+tile.reduce((sum,i)=>sum+Math.exp(streamingScores[i]-max),0);
    const accumulator=rescale*previous.accumulator+tile.reduce((sum,i)=>sum+Math.exp(streamingScores[i]-max)*streamingValues[i],0);
    steps.push({indices:tile,visited:[...previous.visited,...tile],max,normalizer,accumulator,rescale,output:accumulator/normalizer});
  }
  return {steps,weights,denseOutput};
}

/** One seeded unit direction per identity, shared by both RMS spheres and every camera pose. */
export function rmsShellDirections(count=240):[number,number,number][]{
  let seed=0x516b27;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return (seed+.5)/4294967296;};
  return Array.from({length:count},()=>{const z=2*random()-1,angle=2*Math.PI*random(),radial=Math.sqrt(1-z*z);return [radial*Math.cos(angle),radial*Math.sin(angle),z];});
}

export const shellCanvasHeight=(width:number)=>width<500?350:420;
export function projectShellPoint(point:readonly[number,number,number],yaw:number,pitch:number,width:number,height=shellCanvasHeight(width)):{x:number;y:number;depth:number}{
  const [x,y,z]=point,rx=x*Math.cos(yaw)+z*Math.sin(yaw),rz=-x*Math.sin(yaw)+z*Math.cos(yaw);
  const ry=y*Math.cos(pitch)-rz*Math.sin(pitch),depth=y*Math.sin(pitch)+rz*Math.cos(pitch);
  const scale=Math.min((width-56)/2,140,(height-140)/2)/Math.sqrt(3),perspective=3/(3-depth*.28);
  return {x:width/2+rx*scale*perspective,y:(height+70)/2-ry*scale*perspective,depth};
}
export function experimentState(kind: SubjectFigure["kind"], input: number, dimension = 3): ExperimentResult {
  const control = experimentControls[kind];
  const value = Math.max(control.min, Math.min(control.max, Number.isFinite(input) ? input : control.initial));
  const base: ExperimentResult = {values: [], reference: [], labels: [], metric: "", detail: "", grid: false, selected: []};
  if(kind==="rolling-window"){
    const state=rollingCausalWindow(value);return {...base,values:state.after.map(position=>position??-1),reference:state.before.map(position=>position??-1),labels:state.after.map((_,slot)=>`slot ${slot}`),selected:[state.writeSlot],metric:`Position ${state.query} writes slot ${state.writeSlot}`,detail:`Read previous positions ${state.previous.length?state.previous.join(", "):"none"} plus current ${state.query}, then update the four-slot cache.${state.evicted===null?" No earlier slot is overwritten.":` Position ${state.evicted} is overwritten after this read.`}`};
  }
  if(kind==="paired-scaling"){
    const state=smoothQuantScaling(value);return {...base,values:state.activationMaxima,reference:state.originalActivationMaxima,labels:["C1","C2","C3"],metric:"XW = X′W′ before rounding",detail:`Output [[${state.output[0].join(", ")}], [${state.output[1].join(", ")}]] stays fixed. Scale each activation column down and its matching weight row up.`};
  }
  if(kind==="volume-rendering"){
    const rendered=volumeRendering(value);return {...base,values:rendered.samples.map(sample=>sample.weight),reference:rendered.samples.map(sample=>sample.transmittance),labels:rendered.samples.map(sample=>sample.id),metric:`Pixel RGB (${rendered.pixel.map(channel=>channel.toFixed(2)).join(", ")})`,detail:`Four constructed ray intervals, Δ=1. Remaining background weight ${rendered.backgroundWeight.toFixed(3)}; increasing front density reduces later contributions.`};
  }
  if(kind==="streaming-attention"){
    const state=onlineAttention(value);return {...base,values:state.weights,labels:["K₁","K₂","K₃","K₄"],metric:`Exact output ${state.denseOutput.toFixed(4)}`,detail:`${state.steps.length-1} tiles, ${Math.round(value)} scores per tile. The final output equals the dense softmax-weighted sum.`};
  }
  if(kind==="noise-shells")return {...base,values:[value*Math.sqrt(3),Math.sqrt(3)],labels:["Inner radius","Outer radius"],metric:`RMS radii ${(value*Math.sqrt(3)).toFixed(2)} / ${Math.sqrt(3).toFixed(2)}`,detail:"Ideal spheres about one data point, D=3 and d=0. Rotation changes the view while every point stays on its sphere."};
  if (kind === "noise") {
    const d = [3,16,128].includes(dimension) ? dimension : 3;
    const radii=seededGaussianRadii(d).map(radius=>radius*value);
    const rms = value*Math.sqrt(d), extent = control.max*(Math.sqrt(d)+3), bins = 18;
    const counts = Array.from({length:bins}, (_,i) => radii.filter(r=>Math.min(bins-1,Math.floor(r/extent*bins))===i).length);
    return {...base,values:counts, labels:counts.map((_,i)=>(extent*(i+0.5)/bins).toFixed(1)), metric:`RMS radius ${rms.toFixed(2)}`,detail:`D=${d}; mean sample radius ${(radii.reduce((a,b)=>a+b,0)/radii.length).toFixed(2)}. 256 seeded samples.`};
  }
  if (kind === "attention") return {...base,values:softmax([2,1,0,-1].map(x=>x/value)), labels:["K₁","K₂","K₃","K₄"],metric:"Weights sum to 1",detail:"Scores [2, 1, 0, −1] stay fixed. Lower temperature concentrates weight on the highest score."};
  if (kind === "low-rank") { const singular=[6,4,3,2,1,0.5], retained=singular.map((x,i)=>i<value?x:0); return {...base,values:retained, reference:singular,labels:singular.map((_,i)=>`s${i+1}`),metric:`${(retained.reduce((a,b)=>a+b*b,0)/singular.reduce((a,b)=>a+b*b,0)*100).toFixed(1)}% spectral energy`,detail:"Singular components remain ordered. Pale bars show the original vector; colored bars show retained components."}; }
  if (kind === "normalization") { const raw=[-2,-1,0,2,6].map(x=>x+value),mean=raw.reduce((a,b)=>a+b,0)/5,sd=Math.sqrt(raw.reduce((a,b)=>a+(b-mean)**2,0)/5);return {...base,values:raw.map(x=>(x-mean)/sd), reference:raw,labels:raw.map((_,i)=>`x${i+1}`),metric:`Raw mean ${mean.toFixed(2)}`,detail:"Foreground: standardized values (mean 0, population variance 1). Background: raw input."}; }
  if (kind === "optimizer") { const trajectory=[3];for(let i=0;i<12;i++)trajectory.push(trajectory.at(-1)!*(1-value));return {...base,values:trajectory,labels:trajectory.map((_,i)=>String(i)),metric:`Final x ${trajectory.at(-1)!.toFixed(3)}`,detail:"Plain gradient descent on x²/2. Signed values show oscillation when the learning rate exceeds 1."}; }
  if (kind === "policy") return {...base,values:[value,Math.min(value,1.2)],labels:["r × A","clipped"],metric:`Surrogate ${Math.min(value,1.2).toFixed(2)}`,detail:"A=+1 and ε=0.2. The positive-advantage objective stops increasing above r=1.2."};
  if (kind === "quantization") {const raw=[-0.8,-0.3,0.1,0.7],levels=2**value,quantized=raw.map(x=>Math.round((x+1)/2*(levels-1))/(levels-1)*2-1),mse=raw.reduce((a,x,i)=>a+(x-quantized[i])**2,0)/4;return {...base,values:quantized,reference:raw,labels:["x₁","x₂","x₃","x₄"],metric:`MSE ${mse.toFixed(5)}`,detail:`${levels} uniform levels on [−1,1]. Finer spacing reduces rounding error.`};}
  if (kind === "memory") {const allocated=Math.ceil(9/value)*value;return {...base,values:Array.from({length:16},(_,i)=>i<9?1:i<allocated?0.35:0),grid:true,selected:Array.from({length:9},(_,i)=>i),metric:`${9}/${allocated} allocated slots occupied`,detail:`9 live tokens, ${allocated-9} padding slots, ${16-allocated} unallocated slots. Lines group slots into allocation blocks.`};}
  if (kind === "routing") {const scores=[[.8,.4,.1],[.2,.9,.5],[.6,.3,.7],[.4,.5,.3]],selected=scores.flatMap((row,r)=>row.map((score,c)=>({score,index:r*3+c})).sort((a,b)=>b.score-a.score).slice(0,value).map(x=>x.index));const loads=[0,1,2].map(c=>selected.filter(i=>i%3===c).length);return {...base,values:scores.flat(),labels:scores.flatMap((row,r)=>row.map((_,c)=>`T${r+1} → E${c+1}`)),grid:true,selected,metric:`Expert loads ${loads.join(" / ")}`,detail:"Each token row chooses its top-k experts. Selected affinity cells determine every displayed load; this is token-choice."};}
  if (kind === "patches") {const masked=Math.round(64*value);return {...base,values:Array.from({length:64},(_,i)=>((i*17)%64)<masked?0.12:1),grid:true,metric:`${64-masked} visible / ${masked} masked`,detail:"A deterministic 8×8 patch mask. The same mask order is used at every setting."};}
  if (kind === "state") {const values=Array.from({length:13},(_,i)=>value**i);return {...base,values,labels:values.map((_,i)=>String(i)),metric:`h₁₂=${values[12].toFixed(3)}`,detail:"One initial impulse, then zero inputs. hₜ=a hₜ₋₁; a=1 preserves this scalar state."};}
  if (kind === "contrastive") {const scores=[[2,0,-1],[-1,2,.2],[0,-1,2]],values=scores.flatMap(row=>softmax(row.map(x=>x/value)));return {...base,values,labels:values.map((_,i)=>`Image ${Math.floor(i/3)+1} → text ${i%3+1}`),grid:true,selected:[0,4,8],metric:`Mean paired probability ${((values[0]+values[4]+values[8])/3).toFixed(3)}`,detail:"Each image row sums to 1; its diagonal text is the declared paired example. Temperature changes confidence while the similarity scores stay fixed."};}
  if (kind === "graph") {let values=[1,0,0];for(let i=0;i<value;i++)values=[(values[0]+values[1])/2,(values[0]+values[1]+values[2])/3,(values[1]+values[2])/2];return {...base,values,labels:["node A","node B","node C"],metric:`Steps ${value}`,detail:"Chain A—B—C, initial scalar features [1,0,0], self-inclusive neighbor means. Each step uses the preceding values simultaneously."};}
  if (kind === "search") return {...base,values:[.2,.8,.4,.6].map((x,i)=>i<value?x:0),labels:["leaf A","leaf B","leaf C","leaf D"],selected:Array.from({length:value},(_,i)=>i),metric:`${value} of 4 leaves revealed`,detail:"Leaves are revealed from left to right; question marks mark unexplored outcomes."};
  if (kind === "latent") {const xs=Array.from({length:25},(_,i)=>-3+i*.25),density=(x:number,mu:number)=>Math.exp(-.5*(x-mu)**2)/Math.sqrt(2*Math.PI);return {...base,values:xs.map(x=>density(x,value)),reference:xs.map(x=>density(x,0)),labels:xs.map(x=>String(x)),coordinates:xs,metric:`KL(q‖p)=${(value*value/2).toFixed(3)}`,detail:"q=N(μ,1), p=N(0,1). Both variances stay fixed at 1. Changing μ shifts the posterior and increases its distance from the prior."};}
  if (kind === "ode") {const times=[0],values=[1];while(times.at(-1)!<3-1e-9){const dt=Math.min(value,3-times.at(-1)!);times.push(times.at(-1)!+dt);values.push(values.at(-1)!*(1-dt));}return {...base,values,reference:times.map(t=>Math.exp(-t)),labels:times.map(t=>String(Number(t.toFixed(4)))),coordinates:times,metric:`Endpoint error ${Math.abs(values.at(-1)!-Math.exp(-3)).toFixed(4)}`,detail:"Foreground: Euler for dx/dt=−x. Background: exact exp(−t). Step size changes approximation error."};}
  if (kind === "scaling") return {...base,values:[1,4*value**-.3],labels:["floor","excess loss"],metric:`Loss ${(1+4*value**-.3).toFixed(3)}`,detail:"L(N)=1+4N⁻⁰·³. The floor stays at 1 while the resource-dependent term falls."};
  if (kind === "guidance") {const xs=[-1,0,1,2,3];return {...base,values:xs.map(x=>-x+value),labels:xs.map(x=>`x=${x}`),metric:`Equilibrium x=${value.toFixed(1)}`,detail:"vᵤ=−x; v꜀=−(x−1); v=vᵤ+w(v꜀−vᵤ). The zero crossing gives the equilibrium."};}
  if (kind === "retrieval") return {...base,values:[.9,.7,.5,.2],labels:["doc A","doc B","doc C","doc D"],selected:Array.from({length:value},(_,i)=>i),metric:`${value} contexts selected`,detail:"Highlighted documents enter the context. Ranking scores stay fixed as k changes."};
  const values=Array.from({length:49},(_,i)=>{const x=i%7-3,y=Math.floor(i/7)-3;return Math.exp(-(x*x+y*y)/(2*value*value));});
  return {...base,values,grid:true,metric:`Width σ=${value.toFixed(1)}`,detail:"A 2D radial Gaussian footprint with fixed peak 1. Darker cells carry more of the footprint; increasing σ spreads it farther from the center."};
}

export type RayRgb=readonly [number,number,number];
export const volumeSampleColors:readonly RayRgb[]=[[.85,.25,.15],[.2,.65,.35],[.2,.35,.85],[.8,.65,.2]];
export const volumeBackground:RayRgb=[1,1,1];
/** NeRF Eq. (3) evaluated on one declared piecewise-constant, finite constructed ray. */
export function volumeRendering(frontDensity:number){
  const density=Math.max(0,Math.min(4,Number.isFinite(frontDensity)?frontDensity:1));
  let transmittance=1;
  const samples=[density,.5,1.5,.75].map((sigma,i)=>{
    const delta=1,alpha=-Math.expm1(-sigma*delta),weight=transmittance*alpha;
    const sample={id:`S${i+1}`,position:i+.5,delta,sigma,alpha,transmittance,weight,color:volumeSampleColors[i]};
    transmittance*=1-alpha;return sample;
  });
  const backgroundWeight=transmittance;
  const pixel=volumeBackground.map((channel,c)=>backgroundWeight*channel+samples.reduce((sum,sample)=>sum+sample.weight*sample.color[c],0)) as [number,number,number];
  return {samples,backgroundWeight,pixel};
}

export const smoothQuantInput=[[8,2,-1],[-4,1,.5]] as const;
export const smoothQuantWeights=[[.5,-.25],[1,.5],[-1,.5]] as const;
function smallMatrixProduct(x:readonly (readonly number[])[],w:readonly (readonly number[])[]){
  return x.map(row=>w[0].map((_,column)=>row.reduce((sum,value,channel)=>sum+value*w[channel][column],0)));
}
/** SmoothQuant Eqs. (3),(4), evaluated before rounding on declared tiny matrices. */
export function smoothQuantScaling(inputAlpha:number){
  const alpha=Math.max(0,Math.min(1,Number.isFinite(inputAlpha)?inputAlpha:.5));
  const originalActivationMaxima=smoothQuantInput[0].map((_,channel)=>Math.max(...smoothQuantInput.map(row=>Math.abs(row[channel]))));
  const originalWeightMaxima=smoothQuantWeights.map(row=>Math.max(...row.map(Math.abs)));
  const scales=originalActivationMaxima.map((maximum,channel)=>maximum**alpha/originalWeightMaxima[channel]**(1-alpha));
  const activations=smoothQuantInput.map(row=>row.map((value,channel)=>value/scales[channel]));
  const weights=smoothQuantWeights.map((row,channel)=>row.map(value=>value*scales[channel]));
  const activationMaxima=activations[0].map((_,channel)=>Math.max(...activations.map(row=>Math.abs(row[channel]))));
  const weightMaxima=weights.map(row=>Math.max(...row.map(Math.abs)));
  const output=smallMatrixProduct(smoothQuantInput,smoothQuantWeights),scaledOutput=smallMatrixProduct(activations,weights);
  const maxProductError=Math.max(...output.flatMap((row,i)=>row.map((value,j)=>Math.abs(value-scaledOutput[i][j]))));
  return {alpha,scales,activations,weights,activationMaxima,weightMaxima,originalActivationMaxima,originalWeightMaxima,output,scaledOutput,maxProductError};
}

/** Four cached previous states plus the current local state, read before the modulo write. */
export function rollingCausalWindow(inputQuery:number){
  const query=Math.round(Math.max(0,Math.min(11,Number.isFinite(inputQuery)?inputQuery:5))),capacity=4;
  const previous=Array.from({length:Math.min(query,capacity)},(_,i)=>Math.max(0,query-capacity)+i);
  const before:(number|null)[]=Array(capacity).fill(null);
  previous.forEach(position=>{before[position%capacity]=position;});
  const writeSlot=query%capacity,evicted=before[writeSlot],after=[...before];after[writeSlot]=query;
  return {query,capacity,previous,eligible:[...previous,query],before,after,writeSlot,evicted};
}
