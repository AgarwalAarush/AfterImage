import {validateRecall} from '../src/lib/recall-validation';
import {sceneSvg,sceneSvgMobile} from '../src/lib/scene';
import {inspectSvg} from '../worker/diagram-review';
import type {AppState} from '../src/lib/types';
process.loadEnvFile('.env.local');
async function main(){
 const base='https://afterimage.aarushagarwal.dev';
 const auth=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({key:process.env.AFTERIMAGE_ACCESS_KEY})});
 if(!auth.ok)throw new Error('Sign-in failed');
 const response=await fetch(base+'/api/state',{headers:{Cookie:auth.headers.get('set-cookie')!.split(';')[0]}});
 if(!response.ok)throw new Error('State unavailable');
 const state:AppState=await response.json();
 let failed=false;
 for(const p of state.papers){
  const issues:string[]=[];
  if(p.recall?.version!==2)issues.push('Recall not yet upgraded');
  else try{validateRecall(p.recall,p.sources)}catch(e){issues.push((e as Error).message)}
  if(p.scene&&p.visual!=='lora')issues.push(...inspectSvg(sceneSvg(p.scene)),...inspectSvg(sceneSvgMobile(p.scene)).map(s=>'Mobile: '+s));
  if(issues.length)failed=true;
  console.log(JSON.stringify({paper:p.id,status:p.generationStatus,equations:p.recall?.equations?.length||0,issues}));
 }
 if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
