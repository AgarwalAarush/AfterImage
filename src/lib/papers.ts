import * as cheerio from "cheerio";
import type { Paper, Source } from "./types";
import { sourcesFromHtml } from "./source-extraction";
export async function importPaper(id: string): Promise<Paper> {
  const r = await fetch(`https://arxiv.org/abs/${id}`, {
    headers: { "User-Agent": "AfterImage/0.1 (personal research library)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 404
        ? "That paper could not be found."
        : "arXiv is unavailable. Please try again shortly.",
    );
  const text = await r.text();
  if (text.length > 3_000_000)
    throw new Error("Paper metadata exceeded the size limit.");
  const $ = cheerio.load(text);
  const meta = (n: string) => $(`meta[name="${n}"]`).attr("content") || "";
  const title =
    meta("citation_title") ||
    $("h1.title")
      .text()
      .replace(/^Title:/, "")
      .trim();
  const abstract = $("blockquote.abstract")
    .text()
    .replace(/^\s*Abstract:\s*/, "")
    .trim();
  if (!title || !abstract)
    throw new Error("Could not read the paper metadata. Try again later.");
  const authors = $('meta[name="citation_author"]')
    .map((_, e) => $(e).attr("content"))
    .get();
  return {
    id,
    arxivId: id,
    title,
    authors: authors.length > 2 ? `${authors[0]} et al.` : authors.join(" & "),
    year: Number(meta("citation_date").slice(0, 4)) || new Date().getFullYear(),
    topics: [],
    accent: "violet",
    abstract: abstract.slice(0, 10000),
    recall: null,
    scene: null,
    sources: [
      {
        id: "abstract",
        label: "Original paper · abstract",
        url: `https://arxiv.org/abs/${id}`,
        excerpt: abstract.slice(0, 10000),
      },
    ],
    generationStatus: "idle",
    createdAt: new Date().toISOString(),
  };
}
export async function extractSources(
  paper: Paper,
): Promise<{ scope: "abstract" | "full-text"; sources: Source[] }> {
  try {
    const r = await fetch(`https://arxiv.org/html/${paper.arxivId}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return { scope: "abstract", sources: paper.sources.slice(0, 1) };
    const html = await r.text();
    if (html.length > 12_000_000) throw new Error("Too large");
    const sources = sourcesFromHtml(paper, html);
    return { scope: sources.length > 1 ? "full-text" : "abstract", sources };
  } catch {
    return { scope: "abstract", sources: paper.sources.slice(0, 1) };
  }
}
