import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Diagram } from '../src/components/diagram';
import { expertChoiceScene } from './fixtures/expert-choice-scene';
for(const id of ['2106.09685','2503.01840'])test(`published diagram replaces editorial presentation for ${id}`,()=>{
 const paper={id,accent:'violet',visual:'lora',scene:expertChoiceScene,kit:{version:1,revision:1,components:[{id:'diagram',revision:'approved-replacement',state:'ready',dependencies:{},sourceIds:[]}]}} as any;
 const html=renderToStaticMarkup(createElement(Diagram,{paper}));
 assert.match(html,/diagram generated/);
 assert.match(html,/scene-wide/);
});
