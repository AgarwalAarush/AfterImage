import test from 'node:test';
import assert from 'node:assert/strict';
import { readingContextIds, excludedRecommendations, shouldRefreshRecommendations } from '../src/lib/recommendations';
import type { AppState, Entry } from '../src/lib/types';

test('pasted paths yield canonical source IDs without trusting unrelated links or prose', () => {
  assert.deepEqual(readingContextIds('Read this [paper](https://arxiv.org/abs/2412.19437?utm_source=chatgpt.com), then https://arxiv.org/pdf/2412.19437v2.pdf and https://alphaxiv.org/abs/2401.04088. Ignore https://evil.example/abs/1234.56789 and prose 2510.26692'), ['2412.19437', '2401.04088']);
});

test('discovery excludes every Library status, latest feedback, and the later cooldown', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  const entries = Object.fromEntries(['read','reading','archived','saved'].map(status => [status, {paperId:status,status} as Entry]));
  const feedback: AppState['feedback'] = [
    {paperId:'changed',value:'known',at:'2026-09-01T00:00:00Z'},
    {paperId:'changed',value:'useful',at:'2026-09-02T00:00:00Z'},
    {paperId:'recent',value:'later',at:'2026-09-11T00:00:00Z'},
    {paperId:'older',value:'later',at:'2026-07-01T00:00:00Z'},
    {paperId:'irrelevant',value:'irrelevant',at:'2026-07-01T00:00:00Z'},
    {paperId:'prerequisite',value:'advanced',at:'2026-09-11T00:00:00Z'},
  ];
  assert.deepEqual([...excludedRecommendations({entries,feedback},now)].sort(), ['archived','irrelevant','read','reading','recent','saved']);
});

test('reading activity refreshes suggestions only when direction and worker capacity allow it', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  assert.equal(shouldRefreshRecommendations({direction:{goal:'world models',questions:'',topics:[]},jobs:[]},now),true);
  assert.equal(shouldRefreshRecommendations({direction:{goal:'',questions:'',topics:[]},jobs:[]},now),false);
  assert.equal(shouldRefreshRecommendations({direction:{goal:'world models',questions:'',topics:[]},jobs:[{id:'r',type:'recommend',status:'running',createdAt:'2026-09-12T11:00:00Z',attempts:1}]},now),false);
});

test('discovery merges OpenAlex with the arXiv fallback and records provider coverage', async () => {
  const {discoverPapers, roundRobinCandidates} = await import('../worker/discovery');
  assert.deepEqual(roundRobinCandidates([['broad-1','broad-2','shared'],['recent-1','shared','recent-3']],5), ['broad-1','recent-1','broad-2','shared','recent-3']);
  let apiCalls = 0, recentOpenAlex = false;
  const request = (async (url: URL | RequestInfo) => {
    if (String(url).includes('export.arxiv.org')) {
      apiCalls++;
      return new Response('', {status:429, headers:{'Retry-After':'600'}});
    }
    if (String(url).includes('api.openalex.org')) {
      const parsed = new URL(String(url));
      recentOpenAlex ||= parsed.searchParams.get('filter')?.includes('locations.source.id:S4306400194,from_publication_date:') === true && parsed.searchParams.get('sort')?.startsWith('publication_date:desc') === true;
      return Response.json({results:[
        {id:'https://openalex.org/W1',title:'A recent paper',locations:[{landing_page_url:'https://arxiv.org/abs/2509.01234'}]},
        {id:'https://openalex.org/W2',title:'A journal-only paper',doi:'https://doi.org/10.1000/example'},
      ]});
    }
    return new Response('<li class="arxiv-result"><a href="https://arxiv.org/abs/2401.04088v2">paper</a><a href="https://example.com/abs/9999.99999">untrusted</a></li>');
  }) as typeof fetch;
  assert.deepEqual(await discoverPapers('MoE routing', true, request), {
    ids:['2401.04088','2509.01234'],
    popularity:{},
    status:'ok',
    providers:[
      {provider:'arxiv-website',status:'ok',resultCount:1,candidateCount:1},
      {provider:'openalex',status:'ok',resultCount:2,candidateCount:1},
    ],
  });
  await discoverPapers('conditional compute', false, request);
  assert.equal(apiCalls, 1);
  assert.equal(recentOpenAlex, true);
});
