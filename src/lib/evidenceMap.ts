import type { EvidenceSource, ResearchClaim } from '../types';

export type EvidenceMapSourceNode = {
  id: string;
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
  discovered: boolean;
};

/** Normalize fragments only: query parameters may change the resource and must not be discarded. */
export function normalizeEvidenceUrl(value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
}

/** Build map source nodes only from real discovered records or explicit claim references. */
export function buildEvidenceMapSources(
  discoveredSources: EvidenceSource[] = [],
  claims: ResearchClaim[] = [],
): EvidenceMapSourceNode[] {
  const byUrl = new Map<string, EvidenceMapSourceNode>();

  for (const source of discoveredSources) {
    const key = normalizeEvidenceUrl(source.url);
    if (!key) continue;
    byUrl.set(key, {
      id: key,
      title: source.title || source.domain || source.url,
      url: source.url,
      domain: source.domain,
      snippet: source.snippet,
      discovered: true,
    });
  }

  for (const claim of claims) {
    for (const evidence of [...(claim.supportingSources ?? []), ...(claim.counterEvidence ?? [])]) {
      const key = normalizeEvidenceUrl(evidence.url);
      if (!key || byUrl.has(key)) continue;
      byUrl.set(key, {
        id: key,
        title: evidence.title || evidence.domain || evidence.url,
        url: evidence.url,
        domain: evidence.domain,
        snippet: evidence.snippet,
        discovered: false,
      });
    }
  }

  return [...byUrl.values()];
}

export function claimEvidenceUrls(claim?: ResearchClaim | null): Set<string> {
  if (!claim) return new Set();
  return new Set(
    [...(claim.supportingSources ?? []), ...(claim.counterEvidence ?? [])]
      .map((source) => normalizeEvidenceUrl(source.url))
      .filter(Boolean),
  );
}
