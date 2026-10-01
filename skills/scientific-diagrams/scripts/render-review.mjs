#!/usr/bin/env node
// Renderer adapter contract: render({time, theme, poster}), sampleTimes, posterTime.
// This harness never invents a critique or substitutes syntax for source/visual review.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>i%2?a:[...a,[v.replace(/^--/,''),all[i+1]]],[]));
if(!args.scene||!args.out||!args.runtime){console.error('Usage: node render-review.mjs --scene scene.mjs --out review-dir --runtime project-with-node_modules [--review critique.json]');process.exit(2);}
const scenePath=path.resolve(args.scene),out=path.resolve(args.out),require=createRequire(path.resolve(args.runtime,'package.json'));
const {Resvg}=require('@resvg/resvg-js'),sharp=require('sharp'),cheerio=require('cheerio');
const scene=await import(pathToFileURL(scenePath));
if(!scene.sampleTimes?.length||scene.sampleTimes.length>64||!scene.sampleTimes.every(t=>Number.isFinite(t)&&t>=0))throw Error('Invalid bounded frame schedule');
const width=534,views=[{theme:'dark',width:720},{theme:'light',width:720},{theme:'dark',width}],renders=[];
await fs.mkdir(out,{recursive:true});
let sheets=[],issues=[];
for(const view of views){
  let tiles=[];
  for(let i=0;i<scene.sampleTimes.length;i++){
    const time=scene.sampleTimes[i],svg=scene.render({time,theme:view.theme});
    const $=cheerio.load(svg,{xml:true});
    if($('script,foreignObject,image').length||$('*').toArray().some(el=>Object.keys(el.attribs||{}).some(a=>a.startsWith('on'))))issues.push({category:'executable-content',severity:'must-fix',location:String(time),evidence:'Unsafe authored frame',repair:'Remove executable/remote content'});
    const baked=svg.replace(/var\(--(\w+)\)/g,(match,name)=>svg.match(new RegExp(`--${name}:([^;\"]+)`))?.[1]||match).replaceAll('MathItalic','KaTeX_Math').replaceAll('MathMain','KaTeX_Main');
    const fontFiles=['KaTeX_Math-Italic.ttf','KaTeX_Main-Regular.ttf'].map(f=>path.resolve(args.runtime,'node_modules/katex/dist/fonts',f));
    fontFiles.push(path.resolve(args.runtime,'worker/fonts/IBMPlexMono-Regular.ttf'));
    const rendered=new Resvg(baked,{fitTo:{mode:'width',value:view.width},font:{loadSystemFonts:false,fontFiles,defaultFontFamily:'IBM Plex Mono',sansSerifFamily:'IBM Plex Mono'}}).render().asPng();
    const stem=`${view.theme}-${view.width}-${String(time).padStart(5,'0')}`;
    await fs.writeFile(path.join(out,stem+'.svg'),svg);await fs.writeFile(path.join(out,stem+'.png'),rendered);
    renders.push({stem,time,theme:view.theme,width:view.width,hash:crypto.createHash('sha256').update(svg).digest('hex')});
    // Review filmstrip is a contact sheet. Inspect individual native-size PNGs for type.
    const label=Buffer.from(`<svg width="340" height="24"><rect width="340" height="24" fill="#ddd9d0"/><text x="8" y="17" font-size="12" fill="#302e29">${time} ms · ${view.theme} · ${view.width}px</text></svg>`);
    const tile=await sharp({create:{width:340,height:182,channels:4,background:view.theme==='dark'?'#1d1b18':'#f8f6f1'}}).composite([{input:await sharp(rendered).resize({width:340}).png().toBuffer(),top:24,left:0},{input:label,top:0,left:0}]).png().toBuffer();
    tiles.push({input:tile,left:(i%2)*350,top:Math.floor(i/2)*192});
  }
  const sheet=`filmstrip-${view.theme}-${view.width}.png`;
  await sharp({create:{width:700,height:Math.ceil(tiles.length/2)*192,channels:4,background:'#aaa398'}}).composite(tiles).png().toFile(path.join(out,sheet));sheets.push(sheet);
}
const digest=crypto.createHash('sha256').update(await fs.readFile(scenePath)).update(await fs.readFile(fileURLToPath(import.meta.url))).update(JSON.stringify(renders));
for(const file of scene.reviewFiles||[])digest.update(await fs.readFile(path.resolve(path.dirname(scenePath),file)));
const fingerprint=digest.digest('hex');
let review=null,status='needs-review';
if(args.review){
  review=JSON.parse(await fs.readFile(args.review,'utf8'));
  if(review.fingerprint!==fingerprint)throw Error('Stale critique: inspect the current rendered frames');
  if(!['source','geometry','visual','temporal'].every(g=>typeof review.gates?.[g]==='boolean'))throw Error('Missing review gate');
  if(!Array.isArray(review.issues)||review.issues.length>32||!review.issues.every(i=>['must-fix','suggestion'].includes(i.severity)&&['category','location','evidence','repair'].every(k=>typeof i[k]==='string'&&i[k].length>0&&i[k].length<2000)))throw Error('Invalid critique defects');
  if(Object.values(review.gates).some(v=>!v)&&!review.issues.some(i=>i.severity==='must-fix'))throw Error('A failed review gate requires an actionable defect');
  if(!scene.sampleTimes.every(t=>review.reviewedTimes?.includes(t))||!views.every(v=>review.reviewedViews?.includes(`${v.theme}-${v.width}`)))throw Error('Incomplete temporal/view coverage');
  issues.push(...review.issues);
  status=issues.some(i=>i.severity==='must-fix')||Object.values(review.gates).some(v=>!v)?'repair-required':'approved';
}
const historyPath=path.join(out,'history.json');let history=[];
try{history=JSON.parse(await fs.readFile(historyPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(review&&!history.some(h=>h.fingerprint===fingerprint&&h.status===status)){
  if(history.filter(h=>h.status==='repair-required').length>=4&&status!=='approved')status='repair-limit';
  history.push({round:history.length+1,fingerprint,status,issues});await fs.writeFile(historyPath,JSON.stringify(history,null,2));
}
const report={fingerprint,status,reviewMode:'explicit critique; no automatic scientific approval',fontNote:'Offline frames use IBM Plex Mono fallback plus KaTeX outlines. Browser screenshots establish final DM Sans typography.',views,times:scene.sampleTimes,sheets,issues,semanticStates:scene.semanticState?scene.sampleTimes.map(scene.semanticState):[],review,history};
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status,fingerprint,report:path.join(out,'report.json'),sheets}));
if(status==='repair-limit')process.exitCode=1;
