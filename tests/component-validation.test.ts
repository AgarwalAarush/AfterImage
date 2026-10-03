import test from 'node:test';
import assert from 'node:assert/strict';
import { componentValidation } from '../worker/component-pipeline';
import { validationProgress } from '../worker/validation-findings';
import { expertChoiceScene, expertScoresPanel } from './fixtures/expert-choice-scene';
const sources=[{id:'method',label:'Method',url:'https://arxiv.org/html/2202.09368v1',excerpt:'The method uses routing.'}];
test('one panel repair converges while another panel remains invalid',()=>{
 const panel={...expertScoresPanel,sourceIds:['missing']};
 const figure={id:'routing',kind:'illustration',title:'Routing',caption:'A source grounded comparison of independently selected routing assignments.',sourceId:'method',provenance:'illustrative',placement:'mechanism',illustration:{takeaway:'Compare routing.',panels:[panel,structuredClone(panel)]}};
 const before=componentValidation('figure:routing',figure,sources);
 const repaired=structuredClone(figure);repaired.illustration.panels[0].sourceIds=['method'];
 const after=componentValidation('figure:routing',repaired,sources);
 assert.equal(validationProgress(before,after,[{path:'/content/illustration/panels/0/sourceIds'} as any]),true);
 assert.ok(after.some(f=>f.paths.includes('/content/illustration/panels/1')));
});
test('one diagram panel repair converges while another semantic defect remains',()=>{
 const panel={...expertScoresPanel,values:[["1","2"],["3","4"]]};
 const scene={...expertChoiceScene,illustration:{takeaway:'Compare routing.',panels:[panel,structuredClone(panel)]}};
 const before=componentValidation('diagram',scene,sources);
 const repaired=structuredClone(scene);repaired.illustration.panels[0]=expertScoresPanel as any;
 const after=componentValidation('diagram',repaired,sources);
 assert.equal(validationProgress(before,after,[{path:'/content/illustration/panels/0'} as any]),true);
});
