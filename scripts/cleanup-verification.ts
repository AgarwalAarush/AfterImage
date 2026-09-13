import {mutate} from '../src/lib/store';
import {initialState} from '../src/lib/catalog';
async function main(){await mutate(s=>{const e=s.entries['2401.04088'];if(e?.takeaway==='Verification note: active parameters and total model memory are different.'&&!e.why&&!e.question&&!e.nextAction)delete s.entries['2401.04088'];if(s.direction.goal==='Verification goal: understand sparse expert routing and efficient adaptation of language models.'){const seed=initialState();s.direction=seed.direction;s.onboardingDone=false;s.recommendations=seed.recommendations;s.recommendationSource='starter';s.recommendedAt=null;}});console.log('Removed only identified verification notes and goals; generated notecard and job evidence retained.');}
main().catch(e=>{console.error(e.message);process.exitCode=1});
