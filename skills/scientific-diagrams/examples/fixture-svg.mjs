// Shared presentation/timing primitives for authored evaluation fixtures.
export const duration=16000;
export const escape=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// SVG style elements participate in the embedding document's cascade.
// Scope these authored simple selectors; font-face definitions remain shared.
export function scopeSvg(svg){return svg.replace('<svg xmlns=','<svg class="scientific-fixture" xmlns=').replace(/<style>([\s\S]*?)<\/style>/g,(_,css)=>'<style>'+css.replace(/(^|})\s*([^{}]+)\{/g,(_,prefix,selector)=>prefix+(selector.trim().startsWith('@')?selector:selector.split(',').map(s=>s.trim()==='svg'?'.scientific-fixture':'.scientific-fixture '+s.trim()).join(','))+'{')+'</style>');}
export function at(points,t){let i=0;while(i<points.length-2&&t>points[i+1][0])i++;let [a,v]=points[i],[b,w]=points[i+1],u=Math.max(0,Math.min(1,(t-a)/(b-a)));return v+(w-v)*u;}
export function track(points,t,animated,body,attrs='',attribute='opacity'){
 return `<g ${attrs} ${attribute}="${at(points,t)}">${animated?`<animate attributeName="${attribute}" dur="${duration}ms" repeatCount="indefinite" keyTimes="${points.map(([x])=>x/duration).join(';')}" values="${points.map(([,v])=>v).join(';')}"/>`:''}${body}</g>`;
}
export function reveal(start,t,animated,body,attrs=''){return track([[0,0],[start,0],[start+400,1],[16000,1]],t,animated,body,attrs);}
export function discrete(states,t,animated,attrs=''){
 return states.map(([start,body],i)=>{let end=states[i+1]?.[0]??16000,opacity=t>=start&&t<end?1:0;let times=[0,...(start?[start]:[]),...(end<16000?[end]:[]),16000],values=[start?0:1,...(start?[1]:[]),...(end<16000?[0]:[]),end===16000?1:0];return `<g opacity="${opacity}" ${attrs}>${animated?`<animate attributeName="opacity" calcMode="discrete" dur="16000ms" repeatCount="indefinite" keyTimes="${times.map(x=>x/16000).join(';')}" values="${values.join(';')}"/>`:''}${body}</g>`;}).join('');
}
export function text(x,y,s,cls='label',anchor='middle'){return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${escape(s)}</text>`;}
export function matrix(cx,cy,rows,cols,values,{accent=false}={}){
 let w=cols*38,h=rows*30,x=cx-w/2,y=cy-h/2;
 return `<rect x="${x-5}" y="${y-4}" width="${w+10}" height="${h+8}" rx="5" class="${accent?'active':'box'}"/>`+values.map((v,i)=>text(x+(i%cols)*38+19,y+Math.floor(i/cols)*30+23,v,'number')).join('');
}
export function arrow(d){return `<path d="${d}" class="arrow"/>`;}
export function wrap({time=13000,animated=false,theme='dark',fonts='',poster=false,title,description,body}){
 const colors=theme==='light'?['#f8f6f1','#302e29','#655e52','#aaa295','#705297','#efece5']:['#1d1b18','#e6e2d9','#aaa398','#70695f','#b29bd7','#24211d'];
 const vars=['surface','ink','muted','line','accent','panel'].map((n,i)=>`--${n}:${colors[i]}`).join(';');
 const scene=poster?body:track([[0,0],[300,1],[15600,1],[16000,0]],time,animated,body);
 return scopeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 316" role="img" aria-labelledby="title desc" style="${vars}" data-mode="${animated?'animated':'static'}"><title id="title">${escape(title)}</title><desc id="desc">${escape(description)}</desc><defs><style>${fonts}svg{background:var(--surface)}text{fill:var(--ink);font-family:'DM Sans',Arial,sans-serif}.label{font-size:18px;font-weight:500}.small{font-size:16px;fill:var(--muted)}.caption{font-size:18px;fill:var(--muted)}.number{font-size:24px;font-family:MathMain,Georgia,serif}.math{font-size:25px;font-family:MathItalic,Georgia,serif;font-style:italic;fill:var(--accent)}.box{fill:var(--panel);stroke:var(--line);stroke-width:1}.active{fill:var(--panel);stroke:var(--accent);stroke-width:1.3}.arrow{fill:none;stroke:var(--line);stroke-width:1.3;marker-end:url(#tip)}</style><marker id="tip" viewBox="0 0 7 7" refX="6" refY="3.5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--line)"/></marker></defs><rect width="680" height="316" fill="var(--surface)"/>${scene}</svg>`);
}
