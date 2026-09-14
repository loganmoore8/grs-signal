import { expect, it } from 'vitest';
import { parseSearchHits, searchDateBound } from '../services/research/search';
it('ignores source-less knowledge results and accepts nullable titles from the search API', () => {
  const hits = parseSearchHits({
    results: [
      { text: 'Knowledge result without URL' },
      { url: null, text: 'Another knowledge result' },
      { url: 'https://city.gov/bid', title: null, text: 'An official bid' },
    ],
  });
  expect(hits).toEqual([
    { url: 'https://city.gov/bid', title: '', text: 'An official bid', publishedDate: undefined },
  ]);
});

it('normalizes date filters to the AgentCore whole-second grammar', () => {
  expect(searchDateBound('2026-08-15T08:27:42.123Z')).toBe('2026-08-15T08:27:42Z');
});
