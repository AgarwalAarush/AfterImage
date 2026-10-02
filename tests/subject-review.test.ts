import assert from "node:assert/strict";
import test from "node:test";
import { requireCleanSubjectReview } from "../src/lib/subject-review";

test("every subject review check must pass with zero findings",()=>{
  const clean={science:{passed:true,findings:[]},teaching:{passed:true,findings:[]},states:{passed:true,findings:[]}};
  assert.doesNotThrow(()=>requireCleanSubjectReview(clean));
  assert.throws(()=>requireCleanSubjectReview({...clean,science:{passed:true,findings:["Unsupported Bellman target condition"]}}),/science: Unsupported Bellman target condition/);
  assert.throws(()=>requireCleanSubjectReview({...clean,states:{passed:false,findings:[]}}),/states: Reviewer rejected/);
  assert.throws(()=>requireCleanSubjectReview({...clean,teaching:{passed:false,findings:["Wrong causal relationship"]}}),/teaching: Wrong causal relationship/);
});
