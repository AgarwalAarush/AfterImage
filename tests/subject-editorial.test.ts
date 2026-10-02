import test from "node:test";
import assert from "node:assert/strict";
import {assertSubjectPrimarySources,subjectNarrationFindings,removeSubjectFigures,applySubjectNarrationEdits} from "../src/lib/subject-editorial";
import {readFileSync} from "node:fs";
import {subjectPublicLessonSchema,subjectLessonSchema} from "../src/lib/subjects";

test("primary review admits bounded exact arXiv identities and refuses other documents or disguised paths",()=>{
  const primary={id:"section-2",url:"https://arxiv.org/html/1312.6114v2#S2",excerpt:"A public primary scientific passage."};
  assert.doesNotThrow(()=>assertSubjectPrimarySources("1312.6114",[primary]));
  for(const url of ["http://arxiv.org/html/1312.6114","https://arxiv.org/html/1312.6114-other","https://arxiv.org/html/9999.9999","https://owner.example/document","https://user:secret@arxiv.org/html/1312.6114","https://arxiv.org/html/1312.6114?owner=private"]){
    assert.throws(()=>assertSubjectPrimarySources("1312.6114",[{...primary,url}]));
  }
  assert.throws(()=>assertSubjectPrimarySources("1312.6114",[primary,primary]));
  assert.throws(()=>assertSubjectPrimarySources("1312.6114",[{...primary,excerpt:"x".repeat(20001)}]));
});

test("editorial detection separates extraction narration from useful scientific scope",()=>{
  for(const value of ["The supplied primary evidence omits Appendix C.","The supplied main text does not provide appendix details.","The appendix is not supplied here.","The excerpts do not specify the scheduler.","Missing implementation details cannot be inferred."]){assert.ok(subjectNarrationFindings(value).length);}
  for(const value of ["The theorem assumes positive variance; zero variance makes the displayed division undefined.","System prompting changes the instructions supplied to the model.","The appendix reports a 500-unit hidden layer.","Feature extraction uses a learned encoder."]){assert.deepEqual(subjectNarrationFindings(value),[]);}
});

test("a two-figure editorial removal clears only its anchors and preserves the remaining lesson",()=>{
  const content=subjectPublicLessonSchema.parse(JSON.parse(readFileSync(new URL("../src/content/subjects/lessons/vae.json",import.meta.url),"utf8")));
  const identities=["retained-kl","remove-noise","remove-optimizer"];
  const lesson=subjectLessonSchema.parse({...content,claims:content.claims.map(claim=>({...claim,evidence:"Synthetic private evidence used only for a relationship test."})),figures:identities.map(id=>({...content.figures[0],id})),sections:content.sections.map((section,index)=>({...section,figureId:index<3?identities[index]:null}))});
  const original=structuredClone(lesson),next=removeSubjectFigures(lesson,["remove-noise","remove-optimizer"]);
  assert.deepEqual(lesson,original);
  assert.deepEqual(next.figures,lesson.figures.slice(0,1));
  assert.equal(next.sections[0].figureId,"retained-kl");
  assert.equal(next.sections[1].figureId,null);assert.equal(next.sections[2].figureId,null);
  assert.deepEqual(next.claims,lesson.claims);assert.deepEqual(next.quiz,lesson.quiz);
  assert.deepEqual(next.sections.map(({figureId,...section})=>section),lesson.sections.map(({figureId,...section})=>section));
  assert.throws(()=>removeSubjectFigures(lesson,["not-declared"]));
  assert.throws(()=>removeSubjectFigures(lesson,["remove-noise","remove-noise"]));
  assert.throws(()=>removeSubjectFigures(lesson,identities));
});

test("selected narration edits preserve scientific identity and reject unrelated or unresolved edits",()=>{
  const content=subjectPublicLessonSchema.parse(JSON.parse(readFileSync(new URL("../src/content/subjects/lessons/vae.json",import.meta.url),"utf8")));
  const lesson=subjectLessonSchema.parse({...content,claims:content.claims.map(claim=>({...claim,evidence:"Synthetic private evidence used only for an editorial boundary test."}))});
  const selected=lesson.sections[0].id,markdown=lesson.sections[0].markdown+"\n\nThe comparison retains the experiment's model and dataset conditions.";
  const next=applySubjectNarrationEdits(lesson,[selected],[{sectionId:selected,markdown}]);
  assert.deepEqual(next.claims,lesson.claims);assert.deepEqual(next.figures,lesson.figures);assert.deepEqual(next.quiz,lesson.quiz);
  assert.deepEqual(next.sections.slice(1),lesson.sections.slice(1));
  assert.deepEqual({...next.sections[0],markdown:lesson.sections[0].markdown},lesson.sections[0]);
  assert.throws(()=>applySubjectNarrationEdits(lesson,[selected],[]));
  assert.throws(()=>applySubjectNarrationEdits(lesson,[selected],[{sectionId:lesson.sections[1].id,markdown}]));
  assert.throws(()=>applySubjectNarrationEdits(lesson,[selected],[{sectionId:selected,markdown:markdown+" The supplied excerpts omit these details."}]));
});
