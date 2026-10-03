import test from "node:test";
import assert from "node:assert/strict";
import { openAlexPopularity, discoverPapers } from "../worker/discovery";
import { popularityScore, rankRecommendations } from "../worker/recommendation-ranking";

const assessment = (paperId: string, relevance = 0.8, thread: "main" | "adjacent" = "main") => ({paperId, relevance, nextStep: 0.8, thread,
  role: "Next step", reason: "A relevant mechanism.", focus: "The method", depth: "Technical"});

test("measured popularity wins between equally relevant papers but cannot rescue an irrelevant paper", () => {
  const picks = rankRecommendations([assessment("niche"), assessment("popular"), assessment("unrelated", 0.4)], {
    niche: {citedByCount: 10, normalizedPercentile: 0.2}, popular: {citedByCount: 10000, normalizedPercentile: 0.99},
    unrelated: {citedByCount: 1000000, normalizedPercentile: 1},
  }, new Set());
  assert.deepEqual(picks.map(pick => pick.paperId), ["popular", "niche"]);
  assert.equal("relevance" in picks[0], false);
  assert.equal("score" in picks[0], false);
});

test("influence is bounded, missing coverage is neutral, and fresh strong matches retain a place", () => {
  assert.equal(popularityScore(), 0.5);
  assert.equal(popularityScore({citedByCount: 0, normalizedPercentile: null}), 0);
  assert.ok(popularityScore({citedByCount: 1000000, normalizedPercentile: 1}) <= 1);
  const assessments = ["a", "b", "c", "d"].map(id => assessment(id, 0.95));
  assessments.push(assessment("new", 0.9), assessment("explore", 0.85, "adjacent"));
  const popularity = Object.fromEntries(["a", "b", "c", "d"].map(id => [id, {citedByCount: 10000, normalizedPercentile: 1}]));
  const picks = rankRecommendations(assessments, popularity, new Set(["new"]));
  assert.equal(picks.length, 3);
  assert.ok(picks.some(pick => pick.paperId === "new"));
  assert.ok(picks.some(pick => pick.paperId === "explore"));
});

test("citation data attaches only to one canonical source identity; malformed counts stay unknown", () => {
  const work = {locations: [{landing_page_url: "https://arxiv.org/abs/2401.04088v2"}], cited_by_count: 400, citation_normalized_percentile: {value: 0.95}};
  assert.deepEqual(openAlexPopularity([work, {...work, cited_by_count: 10}, {...work, cited_by_count: -1}]), {
    "2401.04088": {citedByCount: 400, normalizedPercentile: 0.95},
  });
  assert.deepEqual(openAlexPopularity([{...work, locations: [...work.locations, {landing_page_url: "https://arxiv.org/abs/2509.01234"}]},
    {...work, cited_by_count: "400"}, {...work, cited_by_count: Infinity}]), {});
  assert.deepEqual(openAlexPopularity([{...work, citation_normalized_percentile: {value: 95}}]), {"2401.04088": {citedByCount: 400, normalizedPercentile: null}});
});

test("discovery retrieves citation-ranked matches and passes real counts through the merged pool", async () => {
  const sorts: string[] = [];
  const request = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (url.hostname === "api.openalex.org") {
      sorts.push(url.searchParams.get("sort") || "");
      assert.match(url.searchParams.get("select") || "", /cited_by_count/);
      const popular = url.searchParams.get("sort") === "cited_by_count:desc";
      return Response.json({results: [{locations: [{landing_page_url: `https://arxiv.org/abs/${popular ? "2401.04088" : "2509.01234"}`}],
        cited_by_count: popular ? 3000 : 12, citation_normalized_percentile: {value: popular ? 0.98 : 0.5}}]});
    }
    return new Response('<feed><entry><id>https://arxiv.org/abs/2509.01234</id></entry></feed>');
  }) as typeof fetch;
  const result = await discoverPapers("conditional compute", false, request);
  assert.ok(sorts.includes("cited_by_count:desc"));
  assert.ok(sorts.includes("relevance_score:desc"));
  assert.ok(result.ids.includes("2401.04088"));
  assert.equal(result.popularity["2401.04088"].citedByCount, 3000);
});
