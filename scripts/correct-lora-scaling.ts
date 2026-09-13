import {snapshot,mutate} from '../src/lib/store';
import {validateRecall} from '../src/lib/recall-validation';
import {writeFile} from 'node:fs/promises';
process.loadEnvFile('.env.local');
async function main(){
 const before=(await snapshot()).data.papers.find(p=>p.id==='2106.09685')!;
 await writeFile('.data/lora-before-scaling-correction.json',JSON.stringify(before.recall,null,2),{flag:'wx'});
 await mutate(state=>{
  const p=state.papers.find(p=>p.id==='2106.09685')!,r=p.recall!;
  const merged=r.equations?.find(eq=>eq.latex==='W=W_0+BA');
  if(!merged)throw new Error('Expected equation changed; no correction applied');
  merged.latex='W=W_0+\\frac{\\alpha}{r}BA';
  merged.explanation='$W\\in\\mathbb{R}^{d\\times k}$ is the deployment weight and $W_0$ is the frozen pretrained matrix. The merged update retains the same $\\alpha/r$ scaling as the forward equation above, where $\\alpha$ is the fixed scaling constant and $r$ is the chosen rank. Inference with $Wx$ is therefore algebraically equivalent to the two-branch computation, with the original dense-layer structure.';
  r.equations![0].explanation=r.equations![0].explanation.replace('$\\Delta W$ is its task-specific update','$\\Delta W$ is its unscaled low-rank update');
  r.mechanism=r.mechanism.replace('constrains the task-specific update to','parameterizes the unscaled task-specific update as').replace('$W=W_0+BA$','$W=W_0+(\\alpha/r)BA$');
  validateRecall(r,p.sources);
 });
 console.log('Corrected LoRA merge scaling; original recall backed up and source citations preserved.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
