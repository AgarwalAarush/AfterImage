import * as cheerio from "cheerio";
import { parsePaperId } from "./identity";

export type PaperSearchResult = {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  foundBy: ("arxiv" | "openalex")[];
};

export type PaperSearchProvider = {
  provider: "arxiv" | "openalex";
  status: "ok" | "unavailable";
};

type SearchResponse = {
  results: PaperSearchResult[];
  providers: PaperSearchProvider[];
};

function cleanQuery(query: string) {
  return query
    .replace(/[^\p{L}\p{N} .+_:/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function arxivId(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const match = text.match(/https?:\\?\/\\?\/(?:www\.)?arxiv\.org\\?\/(?:abs|pdf|html)\\?\/([^"'<>\s\\?]+)/i);
  if (!match) return null;
  try {
    return parsePaperId(`https://arxiv.org/abs/${match[1].replace(/\\/g, "").replace(/\.pdf$/i, "")}`);
  } catch {
    return null;
  }
}

function authorLine(names: string[]) {
  const clean = names.map(compact).filter(Boolean);
  if (!clean.length) return "Unknown authors";
  if (clean.length > 2) return `${clean[0]} et al.`;
  return clean.join(" & ");
}

async function searchOpenAlex(query: string, request: typeof fetch) {
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", query);
    url.searchParams.set("filter", "locations.source.id:S4306400194");
    url.searchParams.set("per_page", "12");
    url.searchParams.set("sort", "relevance_score:desc");
    url.searchParams.set(
      "select",
      "id,title,display_name,publication_year,authorships,primary_location,best_oa_location,locations",
    );
    if (process.env.OPENALEX_API_KEY)
      url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    const response = await request(url, {
      headers: { "User-Agent": "AfterImage/0.2 (personal research discovery)" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("OpenAlex unavailable");
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("OpenAlex response too large");
    const body = JSON.parse(text) as { results?: unknown[] };
    const works = Array.isArray(body.results) ? body.results : [];
    const results = works.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const work = value as {
        title?: unknown;
        display_name?: unknown;
        publication_year?: unknown;
        authorships?: { author?: { display_name?: unknown } }[];
      };
      const id = arxivId(work);
      const title = compact(String(work.title || work.display_name || ""));
      if (!id || !title) return [];
      const names = Array.isArray(work.authorships)
        ? work.authorships.map((item) => String(item?.author?.display_name || ""))
        : [];
      return [{
        id,
        title,
        authors: authorLine(names),
        year: Number.isInteger(work.publication_year) ? Number(work.publication_year) : null,
        foundBy: ["openalex" as const],
      }];
    });
    return { results, provider: { provider: "openalex", status: "ok" } as const };
  } catch {
    return { results: [], provider: { provider: "openalex", status: "unavailable" } as const };
  }
}

function parseArxivFeed(xml: string) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("entry").map((_, entry) => {
    const item = $(entry);
    const id = arxivId(item.find("id").first().text());
    const title = compact(item.find("title").first().text());
    if (!id || !title) return null;
    const names = item.find("author > name").map((__, author) => $(author).text()).get();
    const published = item.find("published").first().text();
    return {
      id,
      title,
      authors: authorLine(names),
      year: /^\d{4}/.test(published) ? Number(published.slice(0, 4)) : null,
      foundBy: ["arxiv" as const],
    };
  }).get().filter(Boolean) as PaperSearchResult[];
}

async function searchArxiv(query: string, request: typeof fetch) {
  try {
    const api = new URL("https://export.arxiv.org/api/query");
    api.searchParams.set("search_query", `all:\"${query}\"`);
    api.searchParams.set("max_results", "12");
    api.searchParams.set("sortBy", "relevance");
    api.searchParams.set("sortOrder", "descending");
    const response = await request(api, {
      headers: { "User-Agent": "AfterImage/0.2 (personal research discovery)" },
      cache: "no-store",
      // Do not let a throttled arXiv API hold the interactive palette open.
      signal: AbortSignal.timeout(1_200),
    });
    if (response.ok) {
      const xml = await response.text();
      if (xml.length < 2_000_000 && xml.includes("<feed"))
        return { results: parseArxivFeed(xml), provider: { provider: "arxiv", status: "ok" } as const };
    }
  } catch {
    // The interactive palette does not wait on the slower HTML fallback. The
    // background discovery worker retains that lane for deeper shortlist runs.
  }
  return { results: [], provider: { provider: "arxiv", status: "unavailable" } as const };
}

function matchScore(result: PaperSearchResult, query: string) {
  const normalized = query.toLowerCase();
  const title = result.title.toLowerCase();
  if (title === normalized) return 4;
  if (title.startsWith(`${normalized}:`) || title.startsWith(`${normalized} `)) return 3;
  if (title.includes(normalized)) return 2;
  return 1;
}

/** Search independent indexes and return only records that can enter the current arXiv intake path. */
export async function searchPapers(
  rawQuery: string,
  request: typeof fetch = fetch,
): Promise<SearchResponse> {
  const query = cleanQuery(rawQuery);
  if (query.length < 2) return { results: [], providers: [] };
  const [arxiv, openalex] = await Promise.all([
    searchArxiv(query, request),
    searchOpenAlex(query, request),
  ]);
  const merged = new Map<string, PaperSearchResult & { order: number }>();
  [...openalex.results, ...arxiv.results].forEach((result, order) => {
    const existing = merged.get(result.id);
    if (existing) {
      existing.foundBy = [...new Set([...existing.foundBy, ...result.foundBy])];
      if (existing.authors === "Unknown authors" && result.authors !== "Unknown authors")
        existing.authors = result.authors;
      if (!existing.year && result.year) existing.year = result.year;
    } else merged.set(result.id, { ...result, order });
  });
  const results = [...merged.values()]
    .sort((a, b) => matchScore(b, query) - matchScore(a, query) || a.order - b.order)
    .slice(0, 10)
    .map(({ order: _, ...result }) => result);
  return { results, providers: [arxiv.provider, openalex.provider] };
}
