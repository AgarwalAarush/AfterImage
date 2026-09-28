import { strict as assert } from "node:assert";
import { test } from "node:test";
import { prepareDocument } from "../src/lib/documents";

test("Markdown upload keeps the original bytes and extracts a reading title", () => {
  const bytes = Buffer.from("# My guide\n\nA long explanation of the research question and the experiments that followed it.\n\n\\[x^2\\]\n");
  const document = prepareDocument("my-guide.md", bytes);
  assert.equal(document.kind, "markdown");
  assert.equal(document.title, "My guide");
  assert.equal(Buffer.from(document.content, "base64").compare(bytes), 0);
  assert.ok(document.word_count && document.word_count > 10);
});

test("upload rejects a disguised PDF and invalid Markdown bytes", () => {
  assert.throws(() => prepareDocument("fake.pdf", Buffer.from("not a PDF")), /does not appear to be a PDF/);
  assert.throws(() => prepareDocument("bad.md", Buffer.from([0xff, 0xfe])), /UTF-8/);
  assert.throws(() => prepareDocument("notes.html", Buffer.from("hello")), /Markdown.*PDF/);
});
