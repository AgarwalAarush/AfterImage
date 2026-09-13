import {mutate} from '../src/lib/store';
process.loadEnvFile('.env.local');
async function main(){
 await mutate(s=>{
  const p=s.papers.find(p=>p.id==='2401.04088')!;
  if(p.recall?.version===2)return;
  if(s.jobs.some(j=>j.paperId===p.id&&['queued','running'].includes(j.status)))return;
  const j=s.jobs.filter(j=>j.paperId===p.id&&j.type==='generate'&&j.status==='failed').at(-1);
  if(!j||j.attempts>=3)throw new Error('No failed upgrade within its retry allowance');
  j.status='queued';delete j.error;delete j.finishedAt;delete j.leaseToken;delete j.leaseUntil;
  p.generationStatus='queued';delete p.generationError;
 });
 console.log('Resumed the existing Mixtral upgrade within its three-attempt allowance.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
