import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLessonCitations } from "../src/lib/assistant";

test("lesson shorthand is normalized only against the turn's known evidence", () => {
  assert.equal(normalizeLessonCitations("Lesson [lesson-s4], unknown [lesson-s9], paper [source:section-4].", ["lesson-s4", "section-4"]),
    "Lesson [source:lesson-s4], unknown [lesson-s9], paper [source:section-4].");
  assert.equal(normalizeLessonCitations("[source:lesson-s4] [lesson-s4", ["lesson-s4"]), "[source:lesson-s4] [lesson-s4");
});

test("lesson normalization preserves code samples and existing Markdown links", () => {
  const text = "`[lesson-s4]`\n```text\n[lesson-s4]\n```\n[lesson-s4](https://example.com) [lesson-s4][ref]\nActual citation [lesson-s4]";
  assert.equal(normalizeLessonCitations(text, ["lesson-s4"]), text.replace("Actual citation [lesson-s4]", "Actual citation [source:lesson-s4]"));
});
