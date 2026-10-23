import { describe, expect, it } from 'vitest';
import { mergeGroundingResults, selectResearchQueries, shouldPlanResearch } from '../src/server-core/researchRetrieval';
import type { SearchGroundingResult } from '../src/server-core/types';

const result = (query: string, urls: string[]): SearchGroundingResult => ({
  engine: 'duckduckgo',
  engineName: 'DuckDuckGo Keyless Index',
  query,
  results: urls.map((url, index) => ({ title: `Source ${index + 1}`, url, snippet: 'Evidence snippet' })),
});

describe('research retrieval helpers', () => {
  it('skips planning only for non-grounded Solo mode', () => {
    expect(shouldPlanResearch('solo', false)).toBe(false);
    expect(shouldPlanResearch('solo', true)).toBe(true);
    expect(shouldPlanResearch('trio', false)).toBe(true);
    expect(shouldPlanResearch('quad', false)).toBe(true);
  });
  it('uses planned subqueries first, deduplicates, and caps retrieval at three queries', () => {
    expect(selectResearchQueries([' what changed ', 'What Changed', 'why it changed', 'impact'], 'original question'))
      .toEqual(['what changed', 'why it changed', 'impact']);
  });

  it('bounds each query sent to the search provider', () => {
    expect(selectResearchQueries(['x'.repeat(500)], 'fallback')[0]).toHaveLength(300);
  });

  it('uses the original prompt when no planned queries are available', () => {
    expect(selectResearchQueries([], ' original question ')).toEqual(['original question']);
  });

  it('merges results from several queries and deduplicates URL tracking parameters', () => {
    const merged = mergeGroundingResults([
      result('first', ['https://example.com/a?utm_source=one', 'https://example.com/b']),
      result('second', ['https://example.com/a?utm_source=two', 'https://example.org/c']),
    ], ['first', 'second']);

    expect(merged?.results.map((item) => item.url)).toEqual([
      'https://example.com/a?utm_source=one',
      'https://example.com/b',
      'https://example.org/c',
    ]);
    expect(merged?.query).toBe('first | second');
  });

  it('preserves meaningful query parameters while ignoring tracking parameters and fragments', () => {
    const merged = mergeGroundingResults([
      result('first', [
        'https://example.com/manual?version=2&utm_source=one#intro',
        'https://example.com/manual?version=3',
      ]),
      result('second', [
        'https://example.com/manual?utm_source=two&version=2#details',
        'https://example.com/manual?version=4&gclid=click-id',
      ]),
    ], ['first', 'second']);

    expect(merged?.results.map((item) => item.url)).toEqual([
      'https://example.com/manual?version=2&utm_source=one#intro',
      'https://example.com/manual?version=3',
      'https://example.com/manual?version=4&gclid=click-id',
    ]);
  });

  it('interleaves result ranks so one subquery cannot dominate the source list', () => {
    const merged = mergeGroundingResults([
      result('first', ['https://first.example/1', 'https://first.example/2', 'https://first.example/3']),
      result('second', ['https://second.example/1', 'https://second.example/2', 'https://second.example/3']),
      result('third', ['https://third.example/1', 'https://third.example/2', 'https://third.example/3']),
    ], ['first', 'second', 'third'], 6);

    expect(merged?.results.map((item) => item.url)).toEqual([
      'https://first.example/1',
      'https://second.example/1',
      'https://third.example/1',
      'https://first.example/2',
      'https://second.example/2',
      'https://third.example/2',
    ]);
  });

  it('returns null when every search provider failed', () => {
    expect(mergeGroundingResults([null, undefined], ['question'])).toBeNull();
  });

  it('caps the merged source list at ten even when a larger cap is requested', () => {
    const merged = mergeGroundingResults([
      result('one', Array.from({ length: 12 }, (_, index) => `https://example.com/${index}`)),
    ], ['one'], 20);
    expect(merged?.results).toHaveLength(10);
  });

  it('uses the first available engine metadata and summary', () => {
    const first = result('first', ['https://example.com/a']);
    const second = { ...result('second', ['https://example.org/b']), summary: 'Useful search summary' };
    const merged = mergeGroundingResults([first, second], ['first', 'second']);
    expect(merged?.engineName).toBe('DuckDuckGo Keyless Index');
    expect(merged?.summary).toBe('Useful search summary');
  });
});
