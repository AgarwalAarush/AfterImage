import test from "node:test";
import assert from "node:assert/strict";
import { validateSubjectMath } from "../src/lib/subject-math";
import type { SubjectPublicLesson } from "../src/lib/subjects";

function lesson(markdown:string):SubjectPublicLesson{
  return {title:"Math review",summary:"A complete summary.",prerequisites:[],objectives:[],claims:[],
    sections:[{id:"s1",title:"Equation",markdown,sourceIds:[],claimIds:[],figureId:null}],figures:[],quiz:[]};
}
test("math review accepts the same dollar and TeX delimiters used by the reader",()=>{
  assert.doesNotThrow(()=>validateSubjectMath(lesson("Inline $x_i^2$ and \\(x_i^2\\).\n\n\\[y=\\frac{x}{2}\\]")));
});
test("math review rejects a clipped equation even when it has no closing delimiter",()=>{
  assert.throws(()=>validateSubjectMath(lesson("Background $z_{i}=z_{i-1}+f(z_{i-1)")),/Unclosed/);
  assert.throws(()=>validateSubjectMath(lesson("Equation $x_{a$")),/KaTeX/);
  assert.throws(()=>validateSubjectMath(lesson("Equation $$x_i$")),/Mismatched/);
});
test("literal code and escaped prices do not become math",()=>{
  assert.doesNotThrow(()=>validateSubjectMath(lesson("Literal `$x_{` and \\$15.\n\n~~~text\n$x_{\n~~~")));
});
test("math review covers small labels, summaries, quiz feedback and rejects control characters",()=>{
  const candidate=lesson("Valid prose.");candidate.prerequisites=["Bad $x_{$"];
  assert.throws(()=>validateSubjectMath(candidate),/KaTeX/);
  candidate.prerequisites=[];candidate.summary="Bad $x_{$";
  assert.throws(()=>validateSubjectMath(candidate),/KaTeX/);
  candidate.summary="Complete.";candidate.sections[0].markdown="Bad \u007f control.";
  assert.throws(()=>validateSubjectMath(candidate),/control character.*sections\[s1\]\.markdown/);
});
