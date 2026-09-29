import {mutate} from '../src/lib/store';
import {initialState} from '../src/lib/catalog';
async function main(){await mutate(s=>{if(s.direction.goal==='Verification goal: understand sparse expert routing and efficient adaptation of language models.'){const seed=initialState();s.direction=seed.direction;s.onboardingDone=false;s.recommendations=seed.recommendations;s.recommendationSource='starter';s.recommendedAt=null;}});console.log('Removed only the identified verification goal; generated notecard and job evidence retained.');}
main().catch(e=>{console.error(e.message);process.exitCode=1});
