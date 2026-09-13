import { parsePaperId } from '../src/lib/identity';
let apiRetryAfter = 0;

/** Search is optional: metadata must still resolve independently before ranking. */
export async function discoverPapers(query: string, recent: boolean, request: typeof fetch = fetch) {
  const terms = query.replace(/[^\w -]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
  const ids = (text: string) => [...new Set([...text.matchAll(/https?:\/\/arxiv\.org\/abs\/([\w./-]+)/g)]
    .flatMap(match => { try { return [parsePaperId(match[0])]; } catch { return []; } }))].slice(0, 8);
  if (Date.now() >= apiRetryAfter) {
    try {
      const url = new URL('https://export.arxiv.org/api/query');
      url.searchParams.set('search_query', terms.map(term => 'all:' + term).join(' AND '));
      url.searchParams.set('max_results', '8');
      url.searchParams.set('sortBy', recent ? 'submittedDate' : 'relevance');
      url.searchParams.set('sortOrder', 'descending');
      const response = await request(url, {signal: AbortSignal.timeout(15000)});
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        const until = retry && /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry || '');
        apiRetryAfter = Math.max(Date.now() + 10 * 60000, Number.isFinite(until) ? until : 0);
      }
      if (response.ok) {
        const xml = await response.text();
        if (xml.includes('<feed') && !/<id>[^<]*api\/errors/.test(xml))
          return {ids: ids(xml), status: 'ok' as const, source: 'api' as const};
      }
    } catch {}
  }
  // arXiv's public website remains a separate discovery source when its API is unavailable.
  try {
    const url = new URL('https://arxiv.org/search/');
    url.searchParams.set('query', terms.join(' '));
    url.searchParams.set('searchtype', 'all');
    url.searchParams.set('abstracts', 'show');
    url.searchParams.set('order', recent ? '-announced_date_first' : '');
    url.searchParams.set('size', '50');
    const response = await request(url, {signal: AbortSignal.timeout(20000)});
    if (response.ok) {
      const html = await response.text();
      if (html.length < 3_000_000 && (html.includes('arxiv-result') || html.includes('Sorry, your query')))
        return {ids: ids(html), status: 'ok' as const, source: 'website' as const};
    }
  } catch {}
  return {ids: [], status: 'unavailable' as const};
}
