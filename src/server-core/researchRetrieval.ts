import type { SearchGroundingResult, SearchResultItem } from './types.ts';

/** Whether this run benefits from a separate planning model call. */
export function shouldPlanResearch(protocol: string, enableSearchGrounding: boolean): boolean {
  return enableSearchGrounding || protocol !== 'solo';
}

/** Select up to three distinct retrieval queries, preferring planned subqueries. */
export function selectResearchQueries(plannedQueries: string[], originalPrompt: string, maxQueries = 3): string[] {
  const candidates = [...plannedQueries, originalPrompt];
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const candidate of candidates) {
    const query = candidate.trim().slice(0, 300);
    const key = query.toLocaleLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    selected.push(query);
    if (selected.length >= Math.max(1, Math.min(3, maxQueries))) break;
  }
  return selected;
}

const TRACKING_QUERY_PARAMS = new Set([
  'gclid', 'dclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'ref_src', 'yclid', '_hsenc', '_hsmi', 'vero_id',
  'oly_anon_id', 'oly_enc_id', 'mkt_tok',
]);

/** Remove fragments and known tracking parameters without merging distinct query-string resources. */
function normalizeSearchResultUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return value;
  }
}

/** Merge results round-robin across queries, remove duplicate URLs, and cap context volume. */
export function mergeGroundingResults(
  results: Array<SearchGroundingResult | null | undefined>,
  queries: string[],
  maxResults = 10,
): SearchGroundingResult | null {
  const available = results.filter((result): result is SearchGroundingResult => Boolean(result));
  if (!available.length) return null;

  const seen = new Set<string>();
  const merged: SearchResultItem[] = [];
  const limit = Math.max(1, Math.min(10, maxResults));
  const maxRank = Math.max(0, ...available.map((result) => result.results.length));

  // Round-robin by result rank so the first query cannot crowd out later subquestions.
  for (let rank = 0; rank < maxRank && merged.length < limit; rank += 1) {
    for (const result of available) {
      const item = result.results[rank];
      if (!item?.url) continue;
      const normalizedUrl = normalizeSearchResultUrl(item.url);
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      merged.push(item);
      if (merged.length >= limit) break;
    }
  }

  return {
    ...available[0],
    query: queries.join(' | '),
    summary: available.find((result) => result.summary)?.summary,
    results: merged,
  };
}
