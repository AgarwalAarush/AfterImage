import { test } from "node:test";
import assert from "node:assert/strict";
import { findPdfTextMatches } from "../src/lib/pdf-search";

const pages = [{ page: 1, text: "Policy policy policies. Policy" }, { page: 2, text: "policy" }];
test("PDF find counts occurrences on the same page and across pages", () => {
  assert.deepEqual(findPdfTextMatches(pages, "policy", { matchCase: false, wholeWords: false }), [
    { page: 1, start: 0, end: 6 }, { page: 1, start: 7, end: 13 },
    { page: 1, start: 24, end: 30 }, { page: 2, start: 0, end: 6 },
  ]);
});
test("PDF find respects case and Unicode whole-word boundaries", () => {
  assert.equal(findPdfTextMatches(pages, "Policy", { matchCase: true, wholeWords: true }).length, 2);
  assert.equal(findPdfTextMatches([{ page: 1, text: "π πvalue valueπ π" }], "π", { matchCase: true, wholeWords: true }).length, 2);
});
test("PDF find treats metacharacters literally and normalizes ligatures and whitespace", () => {
  assert.equal(findPdfTextMatches([{ page: 1, text: "efﬁcient\n attention (x+y)" }], "efficient attention", { matchCase: false, wholeWords: false }).length, 1);
  assert.equal(findPdfTextMatches([{ page: 1, text: "(x+y)" }], "(x+y)", { matchCase: false, wholeWords: false }).length, 1);
  assert.deepEqual(findPdfTextMatches(pages, "  ", { matchCase: false, wholeWords: false }), []);
});

test("PDF highlight ranges preserve original ligatures and repeated whitespace", async () => {
  const { pdfSearchOriginalRange } = await import("../src/lib/pdf-search");
  const text = "  efﬁcient   policy";
  const [start, end] = pdfSearchOriginalRange(text, 0, 9);
  assert.equal(text.slice(start, end), "efﬁcient");
  const [nextStart, nextEnd] = pdfSearchOriginalRange(text, 10, 16);
  assert.equal(text.slice(nextStart, nextEnd), "policy");
  const astral = "𐐀 policy";
  const [astralStart, astralEnd] = pdfSearchOriginalRange(astral, 3, 9);
  assert.equal(astral.slice(astralStart, astralEnd), "policy");
});
