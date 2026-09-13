import test from 'node:test';
import assert from 'node:assert/strict';
import { readingContextIds, excludedRecommendations } from '../src/lib/recommendations';
import type { AppState, Entry } from '../src/lib/types';

test('pasted paths yield canonical source IDs without trusting unrelated links or prose', () => {
  assert.deepEqual(readingContextIds('Read this [paper](https://arxiv.org/abs/2412.19437?utm_source=chatgpt.com), then https://arxiv.org/pdf/2412.19437v2.pdf and https://alphaxiv.org/abs/2401.04088. Ignore https://evil.example/abs/1234.56789 and prose 2510.26692'), ['2412.19437', '2401.04088']);
});

test('reading exclusions honor current progress, latest feedback, and the later cooldown', () => {
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
  assert.deepEqual([...excludedRecommendations({entries,feedback},now)].sort(), ['archived','irrelevant','read','reading','recent']);
});

test('discovery falls back to public website results and backs off a rate-limited API', async () => {
  const {discoverPapers} = await import('../worker/discovery');
  let apiCalls = 0;
  const request = (async (url: URL | RequestInfo) => {
    if (String(url).includes('export.arxiv.org')) {
      apiCalls++;
      return new Response('', {status:429, headers:{'Retry-After':'600'}});
    }
    return new Response('<li class="arxiv-result"><a href="https://arxiv.org/abs/2401.04088v2">paper</a><a href="https://example.com/abs/9999.99999">untrusted</a></li>');
  }) as typeof fetch;
  assert.deepEqual(await discoverPapers('MoE routing', true, request), {ids:['2401.04088'],status:'ok',source:'website'});
  await discoverPapers('conditional compute', false, request);
  assert.equal(apiCalls, 1);
});
