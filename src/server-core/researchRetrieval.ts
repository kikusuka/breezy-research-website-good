import type { SearchGroundingResult, SearchResultItem } from './types.ts';

/** Select up to three distinct retrieval queries, preferring planned subqueries. */
export function shouldPlanResearch(protocol: string, enableSearchGrounding: boolean): boolean {
  return enableSearchGrounding || protocol !== 'solo';
}

export function selectResearchQueries(plannedQueries: string[], originalPrompt: string, maxQueries = 3): string[] {
  const candidates = [...plannedQueries, originalPrompt];
  const seen = new Set<string>();
  const merged: SearchResultItem[] = [];
  const limit = Math.max(1, Math.min(10, maxResults));
  const maxRank = Math.max(0, ...available.map((result) => result.results.length));

  // Round-robin by result rank so the first query cannot crowd out later subquestions.
  for (let rank = 0; rank < maxRank && merged.length < limit; rank += 1) {
    for (const result of available) {
      const item = result.results[rank];
      if (!item?.url) continue;
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
  }

  return {
    ...available[0],
    query: queries.join(' | '),
    summary: available.find((result) => result.summary)?.summary,
    results: merged,
  };
}
