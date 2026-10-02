import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyAuthoredMechanismLabels } from "../scripts/generate-subject-mechanisms";
import { subjectMechanismSchema } from "../src/lib/subject-mechanism";

const scene=subjectMechanismSchema.parse(JSON.parse(readFileSync(new URL("../src/content/subjects/mechanisms/megatron-lm.json",import.meta.url),"utf8")));
test("authored prose patches preserve every scientific identity and temporal relationship",()=>{
  const next=applyAuthoredMechanismLabels(scene,{updates:[{path:"takeaway",value:"Each worker preserves its own activation identities until partial outputs are combined at the shared block boundary."}]});
  assert.deepEqual(next.beats,scene.beats);assert.deepEqual(next.entities,scene.entities);assert.deepEqual(next.relationships,scene.relationships);assert.deepEqual(next.objects,scene.objects);
  assert.notEqual(next.takeaway,scene.takeaway);assert.equal(scene.takeaway,subjectMechanismSchema.parse(scene).takeaway);
});
test("authored label repair cannot alter identities, references or state snapshots",()=>{
  for(const path of ["objects.0.id","sourceIds","beats.0.objects","relationships.0.from"]){
    assert.throws(()=>applyAuthoredMechanismLabels(scene,{updates:[{path,value:"invented"}]}));
  }
});
