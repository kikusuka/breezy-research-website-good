import { describe, expect, it } from 'vitest';
import { deduplicateAndRank } from '../src/server-core/search';

describe('search result deduplication', () => {
  const item = (url: string) => ({ title: url, url, snippet: 'result' });

  it('removes fragments and common tracking parameters without merging distinct resources', () => {
    const results = deduplicateAndRank([
      item('https://example.com/manual?version=2&utm_source=one#intro'),
      item('https://example.com/manual?utm_source=two&version=2#details'),
      item('https://example.com/manual?version=3'),
      item('https://example.com/manual?version=4&gclid=click-id'),
    ]);

    expect(results.map((result) => result.url)).toEqual([
      'https://example.com/manual?version=2&utm_source=one#intro',
      'https://example.com/manual?version=3',
      'https://example.com/manual?version=4&gclid=click-id',
    ]);
  });

  it('sorts meaningful query parameters when comparing URLs', () => {
    const results = deduplicateAndRank([
      item('https://example.com/page?b=2&a=1'),
      item('https://example.com/page?a=1&b=2'),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/page?b=2&a=1');
  });

  it('keeps separate paths and drops entries without URLs', () => {
    const results = deduplicateAndRank([
      item('https://example.com/a'),
      item('https://example.com/b'),
      { title: 'missing', url: '', snippet: '' },
    ]);

    expect(results.map((result) => result.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });
});
