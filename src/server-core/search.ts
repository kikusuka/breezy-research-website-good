/**
 * Web Search Grounding Providers
 * Universal fetch-based search integration
 */

import type { SearchResultItem, SearchGroundingResult, SearchEngineProvider, BackendEnv } from './types.ts';

export async function searchDuckDuckGoKeyless(query: string): Promise<SearchResultItem[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const results: SearchResultItem[] = [];

    const containers = html.split('class="result results_links results_links_deep web-result');
    for (let i = 1; i < containers.length; i++) {
      if (results.length >= 5) break;
      const block = containers[i];

      const linkMatch = block.match(/<a\s+class="result__a"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      let rawUrl = linkMatch[1];
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      let finalUrl = rawUrl;
      if (finalUrl.startsWith('//')) {
        finalUrl = 'https:' + finalUrl;
      }
      if (finalUrl.includes('uddg=')) {
        try {
          const parts = finalUrl.split('uddg=');
          if (parts[1]) {
            const encodedUrl = parts[1].split('&')[0];
            finalUrl = decodeURIComponent(encodedUrl);
          }
        } catch {}
      }

      const snippetMatch = block.match(/<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
                           block.match(/<div\s+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
      let snippet = '';
      if (snippetMatch) {
        snippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim();
      }

      if (title && finalUrl) {
        results.push({
          title,
          url: finalUrl,
          snippet: snippet || 'No snippet available.',
          source: 'DuckDuckGo Index',
        });
      }
    }

    return results;
  } catch (err) {
    console.warn('Error fetching keyless DuckDuckGo search:', err);
    return [];
  }
}

export async function searchTavily(query: string, apiKey: string): Promise<SearchResultItem[]> {
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return (data.results || []).map((r: any) => ({
        title: r.title || 'Source Document',
        url: r.url || '',
        snippet: r.content || '',
        source: 'Tavily AI Search',
      }));
    }
  } catch (err) {
    console.warn('Tavily search failed:', err);
  }
  return [];
}

export async function searchSerper(query: string, apiKey: string): Promise<SearchResultItem[]> {
  try {
    const resp = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const results: SearchResultItem[] = [];
      if (data.organic && Array.isArray(data.organic)) {
        data.organic.slice(0, 5).forEach((r: any) => {
          results.push({
            title: r.title || 'Web Result',
            url: r.link || '',
            snippet: r.snippet || '',
            source: 'Serper (Google SERP)',
          });
        });
      }
      return results;
    }
  } catch (err) {
    console.warn('Serper search failed:', err);
  }
  return [];
}

export async function searchBrave(query: string, apiKey: string): Promise<SearchResultItem[]> {
  try {
    const resp = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      const results: SearchResultItem[] = [];
      if (data.web?.results && Array.isArray(data.web.results)) {
        data.web.results.slice(0, 5).forEach((r: any) => {
          results.push({
            title: r.title || 'Brave Result',
            url: r.url || '',
            snippet: r.description || '',
            source: 'Brave Search',
          });
        });
      }
      return results;
    }
  } catch (err) {
    console.warn('Brave search failed:', err);
  }
  return [];
}

export async function searchSearXNG(query: string, baseUrl: string): Promise<SearchResultItem[]> {
  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`, {
      headers: { Accept: 'application/json' },
    });
    if (resp.ok) {
      const data = await resp.json();
      return (data.results || []).slice(0, 5).map((r: any) => ({
        title: r.title || 'Source Document',
        url: r.url || '',
        snippet: r.content || r.snippet || '',
        source: 'SearXNG Self-Hosted',
      }));
    }
  } catch (err) {
    console.warn('SearXNG search failed:', err);
  }
  return [];
}

export function deduplicateAndRank(results: SearchResultItem[]): SearchResultItem[] {
  const seenUrls = new Set<string>();
  const unique: SearchResultItem[] = [];
  for (const item of results) {
    if (!item.url) continue;
    let cleanUrl = item.url;
    try {
      const parsed = new URL(item.url);
      cleanUrl = parsed.origin + parsed.pathname;
    } catch {}
    if (!seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);
      unique.push(item);
    }
  }
  return unique;
}

export async function performSearchGrounding(
  query: string,
  engine: SearchEngineProvider = 'google',
  keys: Record<string, string> = {},
  env: BackendEnv = {}
): Promise<SearchGroundingResult | null> {
  const trimmedQuery = query.slice(0, 300);

  if (engine === 'google') {
    const fallbackResults = await searchDuckDuckGoKeyless(trimmedQuery);
    return {
      engine: 'duckduckgo',
      engineName: 'DuckDuckGo Keyless Index',
      query: trimmedQuery,
      results: fallbackResults,
    };
  }

  let rawResults: SearchResultItem[] = [];

  if (engine === 'tavily') {
    const tavilyKey = keys.tavily?.trim() || env.TAVILY_API_KEY || '';
    if (tavilyKey) rawResults = await searchTavily(trimmedQuery, tavilyKey);
  } else if (engine === 'serper') {
    const serperKey = keys.serper?.trim() || env.SERPER_API_KEY || '';
    if (serperKey) rawResults = await searchSerper(trimmedQuery, serperKey);
  } else if (engine === 'brave') {
    const braveKey = keys.brave?.trim() || env.BRAVE_API_KEY || '';
    if (braveKey) rawResults = await searchBrave(trimmedQuery, braveKey);
  } else if (engine === 'searxng') {
    const searxngUrl = env.SEARXNG_URL || 'http://localhost:8080';
    rawResults = await searchSearXNG(trimmedQuery, searxngUrl);
  } else {
    rawResults = await searchDuckDuckGoKeyless(trimmedQuery);
  }

  let usedEngine = engine;
  let usedEngineName = engine === 'searxng' ? 'SearXNG Self-Hosted' : engine.toUpperCase();

  if (rawResults.length === 0 && engine !== 'duckduckgo') {
    // Fallback to DuckDuckGo keyless
    rawResults = await searchDuckDuckGoKeyless(trimmedQuery);
    usedEngine = 'duckduckgo';
    usedEngineName = 'DuckDuckGo Keyless Index (Fallback)';
  }

  const deduplicated = deduplicateAndRank(rawResults);

  return {
    engine: usedEngine,
    engineName: usedEngineName,
    query: trimmedQuery,
    results: deduplicated,
  };
}
