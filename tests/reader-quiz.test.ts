import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ReaderQuiz, type ReaderQuizProps, type ReaderQuizQuestion } from "../src/components/reader-quiz";

const question: ReaderQuizQuestion = {
  id: "q1", question: "Which value is retained?", answer: 1,
  options: [
    { text: "The temporary value", explanation: "The temporary value is consumed." },
    { text: "The saved value", explanation: "The saved value survives the operation." },
    { text: "Neither value", explanation: "That would discard required context." },
  ],
  source: { url: "https://arxiv.org/abs/1234.5678", label: "Primary source" },
};
function render(props: Partial<ReaderQuizProps> = {}) {
  return load(renderToStaticMarkup(React.createElement(ReaderQuiz, {
    questions: [question], answers: {}, checked: {}, onSelect() {}, onCheck() {}, onRetry() {}, ...props,
  })));
}

test("stale saved answer indices cannot crash feedback or certify completion", () => {
  for (const choice of [-1, 3, 100, 1.5, NaN, Infinity, "1", null] as unknown as number[]) {
    const $ = render({ answers: { q1: choice }, checked: { q1: true } });
    assert.equal($(".quiz-feedback,.quiz-score").length, 0);
    assert.equal($("input:checked,input[disabled]").length, 0);
    assert.equal($("button").filter((_, e) => $(e).text() === "Check answer").attr("disabled"), "disabled");
  }
});

test("checked feedback explains selected and correct options without unrelated answers", () => {
  const $ = render({ answers: { q1: 0 }, checked: { q1: true } });
  assert.equal($(".quiz-feedback").attr("role"), "status");
  assert.equal($(".quiz-feedback p").length, 2);
  assert.match($(".quiz-feedback").text(), /temporary value is consumed/);
  assert.match($(".quiz-feedback").text(), /saved value survives/);
  assert.doesNotMatch($(".quiz-feedback").text(), /discard required context/);
  assert.equal($("input[disabled]").length, 3);
  assert.equal($(".quiz-option.incorrect input").attr("checked"), "checked");
  assert.equal($(".quiz-option.correct").text(), "The saved value");
  assert.equal($(".quiz-feedback a").attr("href"), question.source!.url);
  assert.match($(".quiz-score").text(), /0 of 1 correct/);
  assert.match($(".quiz-actions").text(), /Try again/);
});

test("correct feedback appears once and current questions alone determine the score", () => {
  const $ = render({ answers: { q1: 1, obsolete: 0 }, checked: { q1: true, obsolete: true } });
  assert.equal($(".quiz-feedback p").length, 1);
  assert.match($(".quiz-feedback").text(), /Exactly/);
  assert.match($(".quiz-score").text(), /1 of 1 correct/);
  const partial = render({ questions: [question, { ...question, id: "q2" }], answers: { q1: 1 }, checked: { q1: true, q2: true } });
  assert.equal(partial(".quiz-score").length, 0);
  assert.equal(partial(".quiz-heading").text(), "CHECK YOUR UNDERSTANDING01 / 02");
  assert.match(partial(".quiz-actions").text(), /Next question/);
});

test("shared layout keeps native radio grouping and the caller's text renderer", () => {
  const $ = render({ id: "subject-quiz", "aria-label": "Lesson quiz", Text: ({ text }) => React.createElement("em", null, text) });
  assert.equal($("section#subject-quiz").attr("aria-label"), "Lesson quiz");
  assert.equal($("fieldset legend").text(), question.question);
  assert.equal($("input[type=radio]").length, 3);
  assert.equal(new Set($("input").toArray().map(e => $(e).attr("name"))).size, 1);
  assert.equal($("label.quiz-option input").length, 3);
  assert.equal($("h2 em,.quiz-option em").length, 4);
  assert.equal($("h2").attr("tabindex"), "-1");
});

test("simultaneous quiz instances do not share native radio group names", () => {
  const props = { questions: [question], answers: {}, checked: {}, onSelect() {}, onCheck() {}, onRetry() {} };
  const $ = load(renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(ReaderQuiz, props), React.createElement(ReaderQuiz, props))));
  assert.equal(new Set($("input").toArray().map(e => $(e).attr("name"))).size, 2);
});
