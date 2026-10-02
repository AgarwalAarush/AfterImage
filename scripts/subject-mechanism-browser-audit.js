/** Read-only publication-column inspection. Run after fonts load and a beat is selected.
 * This complements semantic geometry checks with the browser's actual font outlines.
 * It never mutates the DOM, starts jobs, or approves visual quality.
 */
export function inspectSubjectMechanismBrowser() {
  const svg = [...document.querySelectorAll('svg')].find(e => e.querySelector('[data-object]'));
  if (!svg) throw new Error('No rendered mechanism');
  const findings = [], objects = [], texts = [];
  const box = e => { const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}; };
  const inside = (a,b,p=0) => a.x>=b.x+p-.5 && a.y>=b.y+p-.5 && a.x+a.w<=b.x+b.w-p+.5 && a.y+a.h<=b.y+b.h-p+.5;
  const overlaps = (a,b) => a.x<b.x+b.w-1 && a.x+a.w>b.x+1 && a.y<b.y+b.h-1 && a.y+a.h>b.y+1;
  for (const object of svg.querySelectorAll('[data-object]')) {
    const id=object.getAttribute('data-object'), rect=object.querySelector(':scope > rect'), bounds=box(rect);
    const labels=[...object.querySelectorAll(':scope > text')];
    const labelBoxes=labels.map(label=>({text:label.textContent,...box(label)}));
    for (const label of labels) {
      const b=box(label), record={object:id,text:label.textContent,...b}; texts.push(record);
      if(!inside(b,bounds,6))findings.push(`${id}: label exceeds its object inset: ${label.textContent}`);
      if(!b.w||!b.h)findings.push(`${id}: missing browser font outlines`);
    }
    const entities=[];
    for (const entity of object.querySelectorAll('[data-entity]')) {
      const pill=box(entity.querySelector('rect')), label=entity.querySelector('text'), b=box(label);
      entities.push({id:entity.getAttribute('data-entity'),pill,text:label.textContent,...b});
      texts.push({object:id,text:label.textContent,...b});
      if(!inside(pill,bounds,6)||!inside(b,pill,2))findings.push(`${id}: identity exceeds its reserved glyph area: ${label.textContent}`);
    }
    if(labels.length>1&&labels[0].getAttribute('text-anchor')==='start') {
      const origins=labels.map(e=>Number(e.getAttribute('x')));
      if(origins.some(x=>Math.abs(x-origins[0])>.5))findings.push(`${id}: title and detail have different left edges`);
      if(entities.length===1) {
        const left=Math.min(...labelBoxes.map(b=>b.x)), right=Math.max(...labelBoxes.map(b=>b.x+b.w));
        const glyph=entities[0].pill, gap=glyph.x-right;
        if(gap<8||gap>32)findings.push(`${id}: identity is detached from its text group (${gap.toFixed(1)}px)`);
        if(Math.abs((left+glyph.x+glyph.w)/2-(bounds.x+bounds.w/2))>18)findings.push(`${id}: text and identity group is visibly off-center`);
      }
    }
    objects.push({id,status:object.getAttribute('data-state'),bounds,labels:labelBoxes,entities});
  }
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++)if(overlaps(texts[i],texts[j]))findings.push(`Overlapping text: ${texts[i].object}/${texts[i].text} and ${texts[j].object}/${texts[j].text}`);
  const canvas=svg.parentElement, intro=canvas.previousElementSibling, lastParagraph=intro?.lastElementChild;
  const firstRect=svg.querySelector('[data-object] > rect').getBoundingClientRect();
  const introGap=lastParagraph?firstRect.top-lastParagraph.getBoundingClientRect().bottom:null;
  if(introGap!==null&&(introGap<24||introGap>64))findings.push(`Introduction-to-diagram gap is ${introGap.toFixed(1)}px`);
  const fonts=[...new Set([...svg.querySelectorAll('text')].map(e=>getComputedStyle(e).fontFamily))];
  const view=svg.getBoundingClientRect();
  return {theme:document.documentElement.dataset.theme,viewportWidth:innerWidth,canvasWidth:view.width,viewBox:svg.getAttribute('viewBox'),introGap,fonts,objects,findings};
}
