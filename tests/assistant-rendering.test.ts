import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMarkdown } from "../src/components/assistant-answer";
const citation = { show() {}, hide() {}, keep() {}, current: null };
function render(text: string) {
  return renderToStaticMarkup(createElement(AssistantMarkdown, { text, sources: ["evidence"], citation }));
}
test("assistant renders real tables, ordered lists and math with verified citation controls", () => {
  const html = render("| Property | Value |\n|---|---|\n| Capacity | Fixed |\n\n1. Choose $k$ tokens. [source:evidence]\n2. Combine outputs. [notecard]");
  assert.match(html, /<table>/);
  assert.match(html, /<th>Property<\/th>/);
  assert.match(html, /<td>Fixed<\/td>/);
  assert.match(html, /<ol>/);
  assert.match(html, /class="katex"/);
  assert.match(html, /source 1<\/button>/);
  assert.match(html, /notecard<\/button>/);
});
test("assistant Markdown rejects unknown citations, HTML, images and model links", () => {
  const html = render('[source:unknown] <script>alert(1)</script>\n\n[unsafe](javascript:alert(1)) ![tracking](https://example.com/pixel)\n\n[external](https://example.com)');
  assert.match(html, /\[unverified citation\]/);
  assert.doesNotMatch(html, /<script|<img|<a |javascript:/);
  assert.match(html, /external/);
});
test("partial streamed source identifiers do not appear as raw source syntax", () => {
  assert.equal(render("A finding [source:evid"), "<p>A finding</p>");
});
test("citation-like code stays literal and display equations keep their layout", () => {
  const html = render("`[source:evidence]`\n\n```txt\n[source:evidence]\n```\n\n$$x = y$$");
  assert.match(html, /<code>\[source:evidence\]<\/code>/);
  assert.doesNotMatch(html, /assistant-citation/);
  assert.match(html, /katex-display/);
});
