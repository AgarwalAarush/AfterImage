import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { outputSchema } from '../worker/output-schema';
import { candidateSchema, textBoundFindings } from '../worker/text-bounds';
import { parseModelOutput } from '../worker/repair-model';
test('wire schemas describe native text limits without forcing a clipped sentence',()=>{
 const native=z.object({text:z.string().max(10),count:z.number().int().max(2)}),wire=outputSchema(native) as any;
 assert.equal(wire.properties.text.maxLength,20000);assert.match(wire.properties.text.description,/Native maximum: 10/);assert.equal(wire.properties.count.maximum,2);
 const data={text:'A complete sentence.',count:1};assert.deepEqual(parseModelOutput(JSON.stringify(data),native,true),data);assert.throws(()=>parseModelOutput(JSON.stringify(data),native));
 assert.equal(textBoundFindings(data,native)[0].paths[0],'/text');assert.throws(()=>candidateSchema(native).parse({...data,count:4}));assert.throws(()=>candidateSchema(native).parse({text:5,count:1}));
});
