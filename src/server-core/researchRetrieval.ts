import type { SearchGroundingResult, SearchResultItem } from './types.ts';

/** Select up to three distinct retrieval queries, preferring planned subqueries. */
export function selectResearchQueries(plannedQueries: string[], originalPrompt: string, maxQueries = 3): string[] {
  const candidates = [...plannedQueries, originalPrompt];
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const candidate of candidates) {
    const query = candidate.trim();
    const key = query.toLocaleLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    selected.push(query);
    if (selected.length >= Math.max(1, Math.min(3, maxQueries))) break;
  }
  return selected;
}

/** Merge query results, remove duplicate URLs, and cap source volume for model context. */
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
  for (const result of available) {
    for (const item of result.results) {
      if (!item.url) continue;
      let normalizedUrl = item.url;
      try {
        const parsed = new URL(item.url);
        normalizedUrl = parsed.origin + parsed.pathname;
      } catch {}
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      merged.push(item);
      if (merged.length >= limit) break;
    }
    if (merged.length >= limit) break;
  }

  return {
    ...available[0],
    query: queries.join(' | '),
    summary: available.find((result) => result.summary)?.summary,
    results: merged,
  };
}
