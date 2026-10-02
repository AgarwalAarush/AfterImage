import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSubjectFigureReferences,subjectPatchSchema,applySubjectPatch } from "../src/lib/subject-repair";
import type { SubjectLesson } from "../src/lib/subjects";

function lesson(references:(string|null)[],identities:string[]):SubjectLesson{
  return {title:"Fixture",summary:"Fixture.",prerequisites:[],objectives:[],claims:[],quiz:[],
    sections:references.map((figureId,index)=>({id:`s${index}`,title:"Fixture",markdown:"Fixture",sourceIds:[],claimIds:[],figureId})),
    figures:identities.map(id=>({id,kind:"noise",title:"Fixture",question:"Fixture",caption:"Fixture",limitation:"Fixture",sourceIds:[],claimIds:[],illustrative:true}))};
}
test("only exact underscore-to-hyphen spellings resolve to existing figures",()=>{
  const draft=lesson(["f_noise","f-attention","unknown",null],["f-noise","f-attention"]);
  assert.deepEqual(normalizeSubjectFigureReferences(draft),[{sectionId:"s0",from:"f_noise",to:"f-noise"}]);
  assert.deepEqual(draft.sections.map(section=>section.figureId),["f-noise","f-attention","unknown",null]);
});
test("figure spelling repair never invents identities or changes source/claim relationships",()=>{
  const draft=lesson(["f_other","fnoise"],["f-noise"]);
  draft.sections[0].sourceIds=["section-1"];draft.sections[0].claimIds=["c1"];
  const before=structuredClone(draft);
  assert.deepEqual(normalizeSubjectFigureReferences(draft),[]);
  assert.deepEqual(draft,before);
});
test("prose patches enforce evidence and paragraph bounds per field",()=>{
  const draft=lesson([null],["f-noise"]);
  draft.claims=[{id:"c1",kind:"mechanism",statement:"A source-supported claim.",conditions:"Defined setting.",sourceIds:["section-1"],evidence:"One exact contiguous supporting passage."}];
  const schema=subjectPatchSchema(draft,["section-1"]);
  assert.equal(schema.safeParse({updates:[{path:"claims.c1.evidence",value:"x".repeat(351)}],answers:[],citations:[]}).success,false);
  assert.equal(schema.safeParse({updates:[{path:"sections.0.markdown",value:"x".repeat(351)}],answers:[],citations:[]}).success,false);
  assert.equal(schema.safeParse({updates:[{path:"sections.0.markdown",value:"x".repeat(500)}],answers:[],citations:[]}).success,true);
  const before=structuredClone(draft);
  assert.throws(()=>applySubjectPatch(draft,{updates:[{path:"claims.c1.evidence",value:"x".repeat(351)}],answers:[],citations:[]},["section-1"]));
  assert.deepEqual(draft,before);
});
test("citation corrections may reference only supplied primary evidence",()=>{
  const draft=lesson([null],["f-noise"]);
  const schema=subjectPatchSchema(draft,["section-1","section-9"]);
  assert.equal(schema.safeParse({updates:[],answers:[],citations:[{path:"sections.0.sourceIds",sourceIds:["section-9"]}]}).success,true);
  assert.equal(schema.safeParse({updates:[],answers:[],citations:[{path:"sections.0.sourceIds",sourceIds:["invented"]}]}).success,false);
});
test("passage-selection generation forbids model-authored quote replacements",()=>{
  const draft=lesson([null],["f-noise"]);
  draft.claims=[{id:"c1",kind:"mechanism",statement:"A source-supported claim.",conditions:"Defined setting.",sourceIds:["section-1"],evidence:"One exact contiguous supporting passage."}];
  const schema=subjectPatchSchema(draft,["section-1"],{allowEvidenceUpdates:false});
  assert.equal(schema.safeParse({updates:[{path:"claims.c1.evidence",value:"Another model-authored quote replacement."}],answers:[],citations:[]}).success,false);
  assert.equal(schema.safeParse({updates:[{path:"claims.c1.statement",value:"A narrower source-supported scientific statement."}],answers:[],citations:[]}).success,true);
});
test("claim-link repairs can only connect existing claims without changing their identities",()=>{
  const draft=lesson([null],["f-noise"]);
  draft.claims=[{id:"c1",kind:"mechanism",statement:"A source-supported claim.",conditions:"Defined setting.",sourceIds:["section-1"],evidence:"One exact contiguous supporting passage."}];
  const schema=subjectPatchSchema(draft,["section-1"],{allowClaimLinks:true});
  assert.equal(schema.safeParse({updates:[],answers:[],citations:[],claimLinks:[{path:"sections.0.claimIds",claimIds:["c1"]}]}).success,true);
  assert.equal(schema.safeParse({updates:[],answers:[],citations:[],claimLinks:[{path:"sections.0.claimIds",claimIds:["invented"]}]}).success,false);
  assert.equal(schema.safeParse({updates:[],answers:[],citations:[],claimLinks:[{path:"claims.c1.id",claimIds:["c1"]}]}).success,false);
});
test("a c11 patch targets that identity rather than array index eleven",()=>{
  const draft=lesson(Array(6).fill(null),["f-noise","f-other"]);
  draft.title="Scientific fixture";draft.summary="This fixture tests exact scientific claim identity mapping.";
  draft.prerequisites=["Vectors"];draft.objectives=["Identify the addressed claim.","Preserve the adjacent claim.","Retain source relationships."];
  draft.claims=Array.from({length:12},(_,i)=>({id:`c${i+1}`,kind:"mechanism" as const,statement:"A supported scientific statement.",conditions:"The original conditions.",sourceIds:["section-1"],evidence:"One exact contiguous supporting passage."}));
  for(const section of draft.sections){section.markdown="A supported explanatory paragraph. ".repeat(15);section.sourceIds=["section-1"];section.claimIds=["c11"];}
  for(const figure of draft.figures){figure.question="What does the control change?";figure.caption="A correctly described illustrative example.";figure.limitation="The example uses a fixed chosen setting.";figure.sourceIds=["section-1"];figure.claimIds=["c11"];}
  draft.quiz=Array.from({length:3},()=>({question:"Which scientific claim was addressed?",options:Array.from({length:3},(_,i)=>({text:`Choice ${i}`,explanation:"This explanation defines the scientific choice."})),answer:0,sourceIds:["section-1"],claimIds:["c11"]}));
  const next=applySubjectPatch(draft,{updates:[{path:"claims.c11.conditions",value:"The corrected scientific conditions."}],answers:[],citations:[]},["section-1"]);
  assert.equal(next.claims[10].conditions,"The corrected scientific conditions.");
  assert.equal(next.claims[11].conditions,"The original conditions.");
  assert.equal(draft.claims[10].conditions,"The original conditions.");
});
