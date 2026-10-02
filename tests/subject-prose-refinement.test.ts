import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { restoreAuditLedger, applySectionRefinements, dropSubjectFigure,dropSubjectFigures, rebindSubjectMechanism,applyAuthoredSubjectRefinement } from "../scripts/refine-subject-prose";
import { subjectPublicLessonSchema, type PublishedLesson } from "../src/lib/subjects";

const published=JSON.parse(readFileSync(new URL("../src/content/subjects/lessons/flashattention-fast-and-memory-efficient-exact.json",import.meta.url),"utf8")) as PublishedLesson;
const privateDraft={...subjectPublicLessonSchema.parse(published),claims:published.claims.map(claim=>({...claim,evidence:"This is a synthetic evidence passage for provenance testing."}))};

test("editorial refinement restores only an unchanged private claim ledger",()=>{
  const restored=restoreAuditLedger(published,[privateDraft]);
  assert.equal(restored.claims[0].evidence,privateDraft.claims[0].evidence);
  const changed=structuredClone(privateDraft);changed.claims[0].statement+=" A changed assertion.";
  assert.throws(()=>restoreAuditLedger(published,[changed]),/No unchanged private evidence ledger/);
});

test("source-bound ledger restoration skips normalized quotations and fails closed without literal evidence",()=>{
  const literal="This is a synthetic evidence passage for provenance testing.";
  const altered=structuredClone(privateDraft);altered.claims.forEach(claim=>{claim.evidence="Normalized evidence absent from the actual source excerpt.";});
  const sources=[...new Set(published.claims.flatMap(claim=>claim.sourceIds))].map(id=>({id,excerpt:literal}));
  const restored=restoreAuditLedger(published,[altered,privateDraft],sources);
  assert.ok(restored.claims.every(claim=>claim.evidence===literal));
  assert.throws(()=>restoreAuditLedger(published,[altered],sources),/No unchanged private evidence ledger/);
});

test("editorial updates preserve source relationships, quiz answers and figure contracts",()=>{
  const lesson=restoreAuditLedger(published,[privateDraft]);
  const section=lesson.sections.find(section=>section.figureId!==null)!;
  const next=applySectionRefinements(lesson,[{sectionId:section.id,markdown:section.markdown+"\n\nThe selected control changes the displayed calculation."}]);
  assert.deepEqual(next.figures,lesson.figures);assert.deepEqual(next.quiz,lesson.quiz);assert.deepEqual(next.claims,lesson.claims);
  assert.deepEqual(next.sections.map(section=>({id:section.id,sourceIds:section.sourceIds,claimIds:section.claimIds,figureId:section.figureId})),lesson.sections.map(section=>({id:section.id,sourceIds:section.sourceIds,claimIds:section.claimIds,figureId:section.figureId})));
  assert.notEqual(next.sections.find(candidate=>candidate.id===section.id)!.markdown,section.markdown);
  assert.equal(lesson.sections.find(candidate=>candidate.id===section.id)!.markdown,section.markdown);
});

test("editorial refinement refuses repeated updates and unrelated sections",()=>{
  const lesson=restoreAuditLedger(published,[privateDraft]);
  const figureSection=lesson.sections.find(section=>section.figureId!==null)!;
  const unrelated=lesson.sections.find(section=>section.figureId===null)!;
  assert.throws(()=>applySectionRefinements(lesson,[{sectionId:unrelated.id,markdown:unrelated.markdown}]),/Invalid or duplicate/);
  assert.throws(()=>applySectionRefinements(lesson,[{sectionId:figureSection.id,markdown:figureSection.markdown},{sectionId:figureSection.id,markdown:figureSection.markdown}]),/Invalid or duplicate/);
});

test("explicit editorial selection can remove one obsolete figure but cannot leave zero",()=>{
  const lesson=restoreAuditLedger(published,[privateDraft]);
  const removed=lesson.figures[0].id,next=dropSubjectFigure(lesson,removed);
  assert.equal(next.figures.length,lesson.figures.length-1);
  assert.ok(next.sections.filter(section=>section.figureId===removed).length===0);
  assert.deepEqual(next.claims,lesson.claims);assert.deepEqual(next.quiz,lesson.quiz);
  const selected=next.sections.find(section=>section.figureId===null)!;
  assert.doesNotThrow(()=>applySectionRefinements(next,[{sectionId:selected.id,markdown:selected.markdown}],[selected.id]));
  assert.throws(()=>applySectionRefinements(next,[],["nonexistent"]),/Unknown explicitly/);
  let one=next;while(one.figures.length>1)one=dropSubjectFigure(one,one.figures[0].id);
  assert.throws(()=>dropSubjectFigure(one,one.figures[0].id));
});

test("prose-only mechanism rebinding resets visual approval and requires identical source ledger",()=>{
  const parent=JSON.parse(readFileSync(new URL("../src/content/subjects/lessons/playing-atari-with-deep-reinforcement-learning.json",import.meta.url),"utf8")) as PublishedLesson;
  const scene=JSON.parse(readFileSync(new URL("../src/content/subjects/mechanisms/playing-atari-with-deep-reinforcement-learning.json",import.meta.url),"utf8"));
  const next=structuredClone(parent);next.review.contentDigest="a".repeat(64);
  const rebound=rebindSubjectMechanism({...scene,parentContentDigest:parent.review.contentDigest,review:{...scene.review,status:"passed",visualReviewedAt:new Date().toISOString()}},parent,next,"b".repeat(64));
  assert.equal(rebound.parentContentDigest,next.review.contentDigest);assert.equal(rebound.review.status,"source-passed");assert.equal(rebound.review.visualReviewedAt,null);
  next.claims[0].statement+=" A changed assertion.";
  assert.throws(()=>rebindSubjectMechanism(scene,parent,next,"b".repeat(64)),/unchanged source and claim identities/);
});
test("authored candidates preserve untouched prose, quiz, and claim identities before independent review",()=>{
  const lesson=restoreAuditLedger(published,[privateDraft]),candidate=structuredClone(lesson);
  candidate.sections[0].markdown+="\n\nAn authored explanation connects this equation to the mechanism.";
  assert.doesNotThrow(()=>applyAuthoredSubjectRefinement(lesson,candidate,[lesson.sections[0].id]));
  assert.throws(()=>applyAuthoredSubjectRefinement(lesson,candidate,[lesson.sections[1].id]),/unselected section/);
  candidate.quiz[0].answer=(candidate.quiz[0].answer+1)%3;
  assert.throws(()=>applyAuthoredSubjectRefinement(lesson,candidate,[lesson.sections[0].id]),/immutable quiz/);
});
test("appendix claim corrections cannot change assertions or remove primary references",()=>{
  const lesson=restoreAuditLedger(published,[privateDraft]),candidate=structuredClone(lesson);
  candidate.claims[0].sourceIds.push("appendix-3");candidate.claims[0].conditions="A newly captured appendix supports the existing assertion.";
  assert.throws(()=>applyAuthoredSubjectRefinement(lesson,candidate,[],[]),/unsupported claim/);
  assert.doesNotThrow(()=>applyAuthoredSubjectRefinement(lesson,candidate,[],["appendix-3"]));
  candidate.claims[0].statement+=" A new unsupported assertion.";
  assert.throws(()=>applyAuthoredSubjectRefinement(lesson,candidate,[],["appendix-3"]),/unsupported claim/);
});
test("multiple explicit figure removals retain one figure and preserve source and quiz ledgers",()=>{
  const lesson=restoreAuditLedger(published,[privateDraft]);
  const retained=structuredClone(lesson.figures[0]);
  lesson.figures=[retained,{...structuredClone(retained),id:"figure-extra-1"},{...structuredClone(retained),id:"figure-extra-2"}];
  lesson.sections=lesson.sections.map((section,index)=>({...section,figureId:index===0?"figure-extra-1":index===1?"figure-extra-2":retained.id}));
  const next=dropSubjectFigures(lesson,["figure-extra-1","figure-extra-2"]);
  assert.deepEqual(next.figures.map(figure=>figure.id),[retained.id]);
  assert.ok(next.sections.filter(section=>section.figureId!==null).every(section=>section.figureId===retained.id));
  assert.deepEqual(next.claims,lesson.claims);assert.deepEqual(next.quiz,lesson.quiz);
  assert.deepEqual(next.sections.map(section=>section.sourceIds),lesson.sections.map(section=>section.sourceIds));
  assert.throws(()=>dropSubjectFigures(lesson,["figure-extra-1","figure-extra-1"]),/unique identities/);
  assert.throws(()=>dropSubjectFigures(lesson,["figure-extra-1","figure-extra-2",retained.id]));
  assert.equal(lesson.figures.length,3);
});
