import test from "node:test";
import assert from "node:assert/strict";
import {subjectEvidencePassages,subjectEvidenceSelectionSchema,bindSubjectEvidence} from "../src/lib/subject-evidence";
import type {SubjectLesson} from "../src/lib/subjects";

const sources=[{id:"s1",excerpt:"The optimizer uses a decaying learning rate. The network has a pre-normalized architecture.\n\n"+"A long scientific sentence with several variables and explicitly chosen conditions ".repeat(12)+"ends here."},{id:"s2",excerpt:"Rotary positional embeddings encode relative token positions.\n\n[SOURCE BUDGET TRUNCATED]"}];
function draft():SubjectLesson{return {title:"Fixture",summary:"Fixture.",prerequisites:[],objectives:[],sections:[],figures:[],quiz:[],claims:[{id:"c1",kind:"mechanism",statement:"The optimizer uses a decaying rate.",conditions:"The specified training run.",sourceIds:["s1"],evidence:"An old generated evidence string."},{id:"c2",kind:"mechanism",statement:"Rotary embeddings encode positions.",conditions:"The positional mechanism.",sourceIds:["s2"],evidence:"Another old generated evidence string."}]};}
test("evidence candidates are deterministic bounded literal ranges, including long sentences",()=>{
  const passages=subjectEvidencePassages(sources);
  assert.deepEqual(passages,subjectEvidencePassages(sources));
  assert.equal(new Set(passages.map(p=>p.id)).size,passages.length);
  for(const passage of passages){
    assert.ok(passage.text.length>=20&&passage.text.length<=350);
    assert.equal(passage.text,sources.find(s=>s.id===passage.sourceId)!.excerpt.slice(passage.start,passage.end));
    assert.ok(!passage.text.includes("TRUNCATED"));
  }
  assert.ok(passages.some(p=>p.text.includes("long scientific")));
});
test("selector is scoped to each claim's declared primary citations",()=>{
  const lesson=draft(),passages=subjectEvidencePassages(sources),schema=subjectEvidenceSelectionSchema(lesson,passages);
  const first=passages.find(p=>p.sourceId==="s1")!,second=passages.find(p=>p.sourceId==="s2")!;
  assert.equal(schema.safeParse({selections:[{claimId:"c1",passageId:first.id},{claimId:"c2",passageId:second.id}]}).success,true);
  assert.equal(schema.safeParse({selections:[{claimId:"c1",passageId:second.id},{claimId:"c2",passageId:second.id}]}).success,false);
  assert.equal(schema.safeParse({selections:[{claimId:"c1",passageId:"invented"},{claimId:"c2",passageId:second.id}]}).success,false);
});
test("binding changes only exact evidence and preserves the original draft",()=>{
  const lesson=draft(),before=structuredClone(lesson),passages=subjectEvidencePassages(sources);
  const selections=lesson.claims.map(claim=>({claimId:claim.id,passageId:passages.find(p=>claim.sourceIds.includes(p.sourceId))!.id}));
  const bound=bindSubjectEvidence(lesson,passages,{selections});
  assert.deepEqual(lesson,before);
  assert.deepEqual(bound.claims.map(({evidence,...claim})=>claim),lesson.claims.map(({evidence,...claim})=>claim));
  assert.equal(bound.claims[0].evidence,passages.find(p=>p.id===selections[0].passageId)!.text);
  assert.throws(()=>bindSubjectEvidence(lesson,passages,{selections:[selections[0],selections[0]]}),/repeated/);
  assert.throws(()=>bindSubjectEvidence(lesson,passages,{selections:selections.slice(0,1)}));
});
