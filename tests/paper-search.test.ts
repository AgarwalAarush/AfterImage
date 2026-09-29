import test from "node:test";
import assert from "node:assert/strict";
import { searchPapers } from "../src/lib/paper-search";

test("live paper search merges providers, deduplicates IDs, and ranks an exact title match", async () => {
  const request = (async (url: URL | RequestInfo) => {
    if (String(url).includes("export.arxiv.org"))
      return new Response(`
        <feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <id>https://arxiv.org/abs/2305.14314v1</id>
          <title>QLoRA: Efficient Finetuning of Quantized LLMs</title>
          <published>2023-05-23T00:00:00Z</published>
          <author><name>Tim Dettmers</name></author>
          <author><name>Artidoro Pagnoni</name></author>
          <author><name>Ari Holtzman</name></author>
        </entry></feed>
      `);
    if (String(url).includes("api.openalex.org"))
      return Response.json({ results: [
        {
          title: "A QLoRA Benchmark for Finance",
          publication_year: 2026,
          authorships: [{ author: { display_name: "Someone Else" } }],
          primary_location: { landing_page_url: "https://arxiv.org/abs/2608.04200" },
        },
        {
          title: "QLoRA: Efficient Finetuning of Quantized LLMs",
          publication_year: 2023,
          authorships: [{ author: { display_name: "Tim Dettmers" } }],
          locations: [{ landing_page_url: "https://arxiv.org/abs/2305.14314" }],
        },
        {
          title: "Journal-only result",
          publication_year: 2024,
          authorships: [],
          doi: "https://doi.org/10.1000/example",
        },
      ] });
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const result = await searchPapers("qlora", request);
  assert.equal(result.results[0].id, "2305.14314");
  assert.deepEqual(result.results[0].foundBy.sort(), ["arxiv", "openalex"]);
  assert.deepEqual(result.results.map((paper) => paper.id), ["2305.14314", "2608.04200"]);
  assert.deepEqual(result.providers, [
    { provider: "arxiv", status: "ok" },
    { provider: "openalex", status: "ok" },
  ]);
});

test("OpenAlex still returns importable results while the arXiv API is rate limited", async () => {
  const request = (async (url: URL | RequestInfo) => {
    if (String(url).includes("export.arxiv.org"))
      return new Response("Rate exceeded.", { status: 429 });
    return Response.json({ results: [{
      title: "QLoRA: Efficient Finetuning of Quantized LLMs",
      publication_year: 2023,
      authorships: [{ author: { display_name: "Tim Dettmers" } }],
      primary_location: { landing_page_url: "https://arxiv.org/abs/2305.14314" },
    }] });
  }) as typeof fetch;
  const result = await searchPapers("qlora", request);
  assert.equal(result.results[0].id, "2305.14314");
  assert.deepEqual(result.providers, [
    { provider: "arxiv", status: "unavailable" },
    { provider: "openalex", status: "ok" },
  ]);
});

test("live paper search returns a bounded empty result for short queries", async () => {
  let called = false;
  const request = (async () => { called = true; return new Response(); }) as typeof fetch;
  assert.deepEqual(await searchPapers("q", request), { results: [], providers: [] });
  assert.equal(called, false);
});
