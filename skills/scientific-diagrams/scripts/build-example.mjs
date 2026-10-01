import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../examples/',import.meta.url);
const fontSpecs=[['DM Sans','dm-sans.woff2','normal','100 1000'],['MathItalic','math-italic.woff2','italic','400'],['MathMain','math-main.woff2','normal','400']];
let fonts='';
for(const [family,file,style,weight] of fontSpecs){const bytes=await fs.readFile(new URL('fonts/'+file,root));fonts+=`@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');font-style:${style};font-weight:${weight}}`;}
for(const [slug,module] of [['eagle-state-reuse','state-reuse'],['lora-rank-one','lora-rank-one'],['online-softmax','online-softmax']]){
 const {render,posterTime}=await import(new URL(module+'.mjs',root));
 await fs.writeFile(new URL(slug+'.svg',root),render({time:0,animated:true,fonts}));
 await fs.writeFile(new URL(slug+'-poster.svg',root),render({time:posterTime,poster:true,fonts}));
}
console.log('Built three animations and posters: '+fileURLToPath(root));
