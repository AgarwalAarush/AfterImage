import { parsePaperId } from "../src/lib/identity";

let apiRetryAfter = 0;
let arxivNextRequestAt = 0;

export type DiscoveryProviderResult = {
  provider: "arxiv-api" | "arxiv-website" | "openalex";
  status: "ok" | "unavailable";
  resultCount: number;
  candidateCount: number;
};

export function roundRobinCandidates(lists: string[][], limit: number) {
  const merged: string[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((found) => found.length));
  for (let rank = 0; rank < longest && merged.length < limit; rank++) {
    for (const found of lists) {
      const id = found[rank];
      if (id && !seen.has(id)) {
        seen.add(id);
        merged.push(id);
        if (merged.length === limit) break;
      }
    }
  }
  return merged;
}

function arxivIds(text: string, limit = 30) {
  const candidates = [
    ...text.matchAll(/https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/([\w./-]+)/gi),
    ...text.matchAll(/10\.48550\/arxiv\.([\w./-]+)/gi),
  ];
  return [
    ...new Set(
      candidates.flatMap(
        (match) => {
          try {
            const raw = match[0].startsWith("10.48550/")
              ? match[1]
              : match[0].replace(/^http:/i, "https:").replace(/\.pdf(?:[?#].*)?$/i, "");
            return [parsePaperId(raw)];
          } catch {
            return [];
          }
        },
      ),
    ),
  ].slice(0, limit);
}

function cleanQuery(query: string) {
  return query.replace(/[^\p{L}\p{N} .+_/-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

async function waitForArxiv() {
  const delay = arxivNextRequestAt - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  arxivNextRequestAt = Date.now() + 3000;
}

async function searchArxiv(query: string, recent: boolean, request: typeof fetch) {
  if (Date.now() >= apiRetryAfter) {
    try {
      await waitForArxiv();
      const url = new URL("https://export.arxiv.org/api/query");
      url.searchParams.set("search_query", `all:\"${query}\"`);
      url.searchParams.set("max_results", "20");
      url.searchParams.set("sortBy", recent ? "submittedDate" : "relevance");
      url.searchParams.set("sortOrder", "descending");
      const response = await request(url, {
        headers: { "User-Agent": "AfterImage/0.2 (personal research discovery)" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const until = retry && /^\d+$/.test(retry)
          ? Date.now() + Number(retry) * 1000
          : Date.parse(retry || "");
        apiRetryAfter = Math.max(
          Date.now() + 10 * 60000,
          Number.isFinite(until) ? until : 0,
        );
      }
      if (response.ok) {
        const xml = await response.text();
        if (xml.length < 3_000_000 && xml.includes("<feed") && !/<id>[^<]*api\/errors/.test(xml)) {
          const ids = arxivIds(xml, 20);
          return {
            ids,
            provider: {
              provider: "arxiv-api",
              status: "ok",
              resultCount: ids.length,
              candidateCount: ids.length,
            } satisfies DiscoveryProviderResult,
          };
        }
      }
    } catch {}
  }

  try {
    const url = new URL("https://arxiv.org/search/");
    url.searchParams.set("query", query);
    url.searchParams.set("searchtype", "all");
    url.searchParams.set("abstracts", "show");
    if (recent) url.searchParams.set("order", "-announced_date_first");
    url.searchParams.set("size", "50");
    const response = await request(url, {
      headers: { "User-Agent": "AfterImage/0.2 (personal research discovery)" },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const html = await response.text();
      if (html.length < 3_000_000 && (html.includes("arxiv-result") || html.includes("Sorry, your query"))) {
        const ids = arxivIds(html, 20);
        return {
          ids,
          provider: {
            provider: "arxiv-website",
            status: "ok",
            resultCount: ids.length,
            candidateCount: ids.length,
          } satisfies DiscoveryProviderResult,
        };
      }
    }
  } catch {}
  return {
    ids: [],
    provider: {
      provider: "arxiv-api",
      status: "unavailable",
      resultCount: 0,
      candidateCount: 0,
    } satisfies DiscoveryProviderResult,
  };
}

async function searchOpenAlex(query: string, recent: boolean, request: typeof fetch) {
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", query);
    url.searchParams.set("corpus", "all");
    url.searchParams.set("per_page", "50");
    url.searchParams.set("sort", recent ? "publication_date:desc,relevance_score:desc" : "relevance_score:desc");
    const filters = ["locations.source.id:S4306400194"];
    if (recent) {
      const cutoff = new Date();
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
      filters.push(`from_publication_date:${cutoff.toISOString().slice(0, 10)}`);
    }
    url.searchParams.set("filter", filters.join(","));
    url.searchParams.set("select", "id,title,doi,publication_date,primary_location,best_oa_location,locations");
    if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    const response = await request(url, {
      headers: { "User-Agent": "AfterImage/0.2 (personal research discovery)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("OpenAlex unavailable");
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error("OpenAlex response too large");
    const body = JSON.parse(text) as { results?: unknown[] };
    const works = Array.isArray(body.results) ? body.results : [];
    const ids = [
      ...new Set(works.flatMap((work) => arxivIds(JSON.stringify(work), 4))),
    ].slice(0, 30);
    return {
      ids,
      provider: {
        provider: "openalex",
        status: "ok",
        resultCount: works.length,
        candidateCount: ids.length,
      } satisfies DiscoveryProviderResult,
    };
  } catch {
    return {
      ids: [],
      provider: {
        provider: "openalex",
        status: "unavailable",
        resultCount: 0,
        candidateCount: 0,
      } satisfies DiscoveryProviderResult,
    };
  }
}

/** Search independent scholarly indexes; metadata still resolves separately before ranking. */
export async function discoverPapers(query: string, recent: boolean, request: typeof fetch = fetch) {
  const cleaned = cleanQuery(query);
  if (!cleaned) return { ids: [], status: "unavailable" as const, providers: [] as DiscoveryProviderResult[] };
  const [arxiv, openalex] = await Promise.all([
    searchArxiv(cleaned, recent, request),
    searchOpenAlex(cleaned, recent, request),
  ]);
  const providers = [arxiv.provider, openalex.provider];
  const ids = [...new Set([...arxiv.ids, ...openalex.ids])].slice(0, 40);
  return {
    ids,
    status: providers.some((provider) => provider.status === "ok") ? "ok" as const : "unavailable" as const,
    providers,
  };
}
