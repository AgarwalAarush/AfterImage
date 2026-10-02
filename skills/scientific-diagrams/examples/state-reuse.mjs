// Authored deterministic geometry. Models supply semantic scenes, never this code.
import {scopeSvg} from './fixture-svg.mjs';
export const duration = 16000;
export const reviewFiles = ['eagle-state-reuse.json','preview.html','fixture-svg.mjs'];
export const sampleTimes = [0,1600,3200,4200,5200,6400,7200,8200,9000,10000,11200,13200,15200,15800];
export const posterTime = 13200;
const tracks = {
  scene: [[0,0],[300,1],[15600,1],[16000,0]],
  inputOld: [[0,1],[8200,1],[8500,0],[16000,0]],
  inputNew: [[0,0],[11000,0],[11300,1],[16000,1]],
  compute: [[0,0],[2800,0],[3200,1],[4700,1],[5200,0],[16000,0]],
  output: [[0,0],[4400,0],[4900,1],[16000,1]],
  proposal: [[0,0],[6500,0],[7000,1],[16000,1]],
  forward: [[0,1],[7900,1],[8400,.35],[16000,.35]],
  reuse: [[0,0],[7900,0],[8300,1],[16000,1]],
  copy: [[0,0],[8200,0],[8350,1],[10900,1],[11200,0],[16000,0]],
  copyPosition: [[0,[486,118]],[8200,[486,118]],[8650,[486,222]],[10500,[70,222]],[11000,[70,118]],[16000,[70,118]]],
  inputLabel: [[0,1],[11149,1],[11150,0],[16000,0]],
  nextLabel: [[0,0],[11149,0],[11150,1],[16000,1]],
};
export function valueAt(points,time){
  let i=0;while(i<points.length-2 && time>points[i+1][0])i++;
  const [a,v]=points[i],[b,w]=points[i+1],u=Math.max(0,Math.min(1,(time-a)/(b-a)));
  return Array.isArray(v)?v.map((x,j)=>x+(w[j]-x)*u):v+(w-v)*u;
}
const escapeXml=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function animate(name,attribute='opacity'){
  const p=tracks[name];return `<${attribute==='transform'?'animateTransform':'animate'} attributeName="${attribute}" ${attribute==='transform'?'type="translate" ':''}dur="${duration}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${p.map(([t])=>t/duration).join(';')}" values="${p.map(([,v])=>Array.isArray(v)?v.join(' '):v).join(';')}"/>`;
}
function group(name,content,time,animated,attrs=''){
  const transform=name==='copyPosition',v=valueAt(tracks[name],time);
  return `<g ${attrs} ${transform?`transform="translate(${v.join(' ')})"`:`opacity="${v}"`}>${animated?animate(name,transform?'transform':'opacity'):''}${content}</g>`;
}
function math(x,y,base,index){return `<text x="${x}" y="${y}" text-anchor="middle" class="math">${base}<tspan class="sub" dy="7">${index}</tspan></text>`;}
function state(x,y,index){return `<rect x="${x-34}" y="${y-30}" width="68" height="60" rx="7" class="state"/>${math(x-4,y+9,'a',index)}`;}
function embedding(token){return `<rect x="126" y="88" width="88" height="60" rx="7" class="embedding"/><text x="170" y="128" text-anchor="middle" class="math">e<tspan class="roman">(${token})</tspan></text>`;}
const captions=[
  [0,2800,'Concatenate the state and the token embedding.'],
  [2800,6100,'The draft decoder computes a new state.'],
  [6100,7900,'The LM head proposes “it”.'],
  [7900,16000,'Reuse that state for the following draft step.']
];
export function render({time=posterTime,animated=false,theme='dark',fonts='',poster=false}={}){
  const light=theme==='light',palette=light?['#f8f6f1','#302e29','#655e52','#aaa295','#705297','#efece5']:['#1d1b18','#e6e2d9','#aaa398','#70695f','#b29bd7','#24211d'];
  const colorNames=['surface','ink','muted','line','accent','panel'];
  const vars=colorNames.map((n,i)=>`--${n}:${palette[i]}`).join(';');
  const trackGroup=(name,body,attrs='')=>group(name,body,time,animated,attrs);
  const captionSvg=captions.map(([a,b,text],i)=>{
    let opacity=(time>=a&&time<b)?1:0;
    const points=[[0,a===0?1:0],...(a?[[a/duration,1]]:[]),[b/duration,i===3?1:0],...(b<duration?[[1,0]]:[])];
    return `<text x="340" y="290" text-anchor="middle" class="caption" opacity="${opacity}">${escapeXml(text)}${animated?`<animate attributeName="opacity" dur="${duration}ms" repeatCount="indefinite" calcMode="discrete" keyTimes="${points.map(p=>p[0]).join(';')}" values="${points.map(p=>p[1]).join(';')}"/>`:''}</text>`;
  }).join('');
  const input=`${trackGroup('inputOld',state(70,118,'I')+embedding('do'),'data-concept="draft-input" data-state="current"')}${trackGroup('inputNew',state(70,118,'do')+embedding('it'),'data-concept="draft-input" data-state="next"')}<path d="M30 87H25V149H30M219 87H224V149H219" fill="none" stroke="var(--line)"/><text x="115" y="125" text-anchor="middle" class="symbol" style="font-size:20px">;</text>`;
  const content=`<g class="label"><text x="122" y="45" text-anchor="middle" opacity="${valueAt(tracks.inputLabel,time)}">Input${animated?animate('inputLabel'):''}</text><text x="122" y="45" text-anchor="middle" opacity="${valueAt(tracks.nextLabel,time)}">Next input${animated?animate('nextLabel'):''}</text><text x="337" y="45" text-anchor="middle">Draft model</text><text x="619" y="45" text-anchor="middle">Proposal</text></g>${input}
    ${trackGroup('forward','<path d="M226 118H261M413 118H442" class="arrow"/>','data-concept="draft-computation"')}
    <g data-concept="decoder"><rect x="267" y="78" width="140" height="80" rx="7" class="decoder"/>${trackGroup('compute','<rect x="267" y="78" width="140" height="80" rx="7" class="compute"/>')}<text x="337" y="108" text-anchor="middle" class="small">FC projection</text><text x="337" y="136" text-anchor="middle" class="label">Draft decoder</text></g>
    ${trackGroup('output',state(486,118,'do'),'data-concept="draft-output"')}
    ${trackGroup('proposal','<path d="M526 118H577" class="arrow"/><text x="551" y="86" text-anchor="middle" class="small">LM head</text><rect x="587" y="88" width="64" height="60" rx="7" class="token"/><text x="619" y="127" text-anchor="middle" class="token-label">it</text>','data-concept="proposal" data-status="unverified"')}
    ${trackGroup('reuse','<path d="M486 154V208Q486 222 472 222H84Q70 222 70 208V159" class="reuse-arrow"/><text x="278" y="183" text-anchor="middle" class="small">Reuse draft state</text>','data-concept="reuse"')}
    ${poster?'':trackGroup('copy',trackGroup('copyPosition',state(0,0,'do')),'data-concept="draft-output" data-instance="copy"')}
    ${captionSvg}`;
  return scopeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 316" role="img" aria-labelledby="title desc" style="${vars}" data-mode="${animated?'animated':'static'}"><title id="title">Reuse a draft state to propose the next token</title><desc id="desc">After proposing do, combine a_I and e(do). FC and the draft decoder produce a_do. Its LM head proposes it. Copy a_do into the next input with e(it). Target features for this new step are unavailable; tokens remain proposals until target verification. The pauseable sequence uses illustrative pacing.</desc><defs><style>${fonts}
    svg{background:var(--surface)}text{fill:var(--ink);font-family:'DM Sans',Arial,sans-serif}.label{font-size:18px;font-weight:500}.small{font-size:16px;fill:var(--muted)}.caption{font-size:18px;fill:var(--muted)}.math{font-size:30px;font-family:MathItalic,Georgia,serif;font-style:italic;fill:var(--accent)}.roman{font-family:MathMain,Georgia,serif;font-style:normal;fill:var(--ink)}.sub{font-size:16px;font-family:MathMain,Georgia,serif;font-style:normal}.symbol{font-size:24px;font-family:MathMain,serif;fill:var(--muted)}.token-label{font-size:24px;font-weight:500}.state{fill:var(--panel);stroke:var(--accent);stroke-width:1.3}.embedding,.decoder{fill:var(--panel);stroke:var(--line);stroke-width:1}.token{fill:var(--panel);stroke:var(--accent);stroke-width:1.3;stroke-dasharray:4 3}.compute{fill:var(--accent);fill-opacity:.1;stroke:var(--accent);stroke-width:1.3}.arrow,.reuse-arrow{fill:none;stroke:var(--line);stroke-width:1.3;marker-end:url(#tip)}.reuse-arrow{stroke:var(--accent);marker-end:url(#reuse-tip)}</style><marker id="tip" viewBox="0 0 7 7" refX="6" refY="3.5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--line)"/></marker><marker id="reuse-tip" viewBox="0 0 7 7" refX="6" refY="3.5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--accent)"/></marker></defs><rect width="680" height="316" fill="var(--surface)"/>${poster?content:trackGroup('scene',content)}</svg>`);
}
export function semanticState(time){return {time,outputVisible:valueAt(tracks.output,time)>.99,proposalVisible:valueAt(tracks.proposal,time)>.99,nextInputVisible:valueAt(tracks.inputNew,time)>.99,copyPosition:valueAt(tracks.copyPosition,time),copyVisible:valueAt(tracks.copy,time)>.1};}
