# Discovery coverage

Status: deployed and production-validated on 2026-09-13. The web release is Vercel deployment `dpl_6zhmAqa9WY4cuawaQeDSDWMwbCB7`; the matching discovery worker modules were synchronized to `macserver` and the LaunchAgent restarted successfully.

AfterImage does not claim to search every scholarly work. That promise is not defensible for any bounded live query: indexes differ, metadata can lag, terminology changes, and some work is not publicly indexed. The product instead makes candidate recall observable and improves it through independent retrieval lanes.

## Current retrieval contract

Each recommendation run now:

1. Plans three to six discriminative queries from the research background, goal, open questions, topics, and pasted reading context.
2. Forces at least two recent-paper lanes, defined as a rolling two-year window.
3. Runs each query against arXiv and OpenAlex. arXiv is sorted separately by relevance or submission date. OpenAlex is sorted separately by relevance or publication date.
4. Merges and deduplicates canonical arXiv IDs across providers and queries.
5. Resolves every candidate against canonical arXiv metadata before it can reach the ranking model.
6. Gives the ranker title, year, abstract, and the retrieval lanes that found the paper. The ranker is told to compare recent candidates on research fit instead of treating age or citation count as quality.
7. Persists an operational report with query lane, provider availability, provider result count, importable arXiv count, unique discovered count, recent-lane count, and unresolved IDs. This diagnostic is intentionally absent from the reader-facing home page.

The home experience foregrounds recommended papers, not retrieval accounting. Reading or completing a paper can queue a fresh shortlist when worker capacity allows, so the profile follows actual reading behavior without presenting a mutable “current direction” block. Discovery also keeps one adjacent world-model/learned-dynamics search lane so a narrow active thread does not monopolize every recommendation.

The arXiv API is paced to its documented three-second guidance and retains Retry-After-aware backoff plus the public search fallback. OpenAlex is an independent broad index; an optional API key increases its request budget. Provider failure is recorded rather than silently converted into an apparently complete shortlist.

## What still limits coverage

The current paper model is arXiv-first. OpenAlex searches a much wider corpus, but DOI-only and repository-only results cannot yet enter the verified ranking pool. The next intake milestone is a source-neutral paper identity with DOI, PubMed/PMC, and repository locations, followed by Crossref metadata resolution and supported PDF/HTML extraction. Uploaded PDFs should be explicit user-provided sources, not treated as globally indexed works.

After source-neutral intake, add citation-neighborhood expansion from seed/library papers: references, newer citing works, and semantically related works. This should be a separate candidate lane so graph proximity never masquerades as textual relevance.

## Evaluation gate

Coverage should be judged with a small owner-curated benchmark, not anecdotes. For representative research questions, record papers that a careful human search considers relevant, then track:

- Recall@20 and Recall@50 before model ranking.
- nDCG@10 after deterministic and model ranking.
- Recent-hit recall for relevant work published in the last 3, 6, 12, and 24 months.
- Provider-only wins, overlap, duplicate rate, unresolved rate, and stale-metadata rate.
- Explanation validity: every why-now claim must be supported by resolved metadata or the abstract.

A release can say which providers and lanes completed and how it scored on this benchmark. It cannot say that it searched all papers.

## Product order

1. Finish source-neutral DOI/repository/PDF intake and citation-graph expansion.
2. Add the retrieval benchmark and regression report.
3. Ship adaptive recall without post-reading capture.
4. Add persistent reading paths.
5. Build cross-paper synthesis from verified paper content, reading state, assistant questions, and recall history—not from a personal-notes model.

Primary API references: [OpenAlex API](https://help.openalex.org/api/), [OpenAlex API recipes](https://help.openalex.org/how-to/api-recipes/), [arXiv API manual](https://info.arxiv.org/help/api/user-manual.html), and [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/).
