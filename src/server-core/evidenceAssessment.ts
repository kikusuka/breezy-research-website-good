/** Helpers for honest, model-assisted evidence assessments. */
export type ClaimAssessmentStatus = 'supported' | 'contradicted' | 'unresolved';
export type ClaimEvidenceBasis =
  | 'referenced_page_text_available'
  | 'search_snippets_only'
  | 'unmatched_references'
  | 'no_references';

/** A URL match establishes that a reference was discovered, not that it supports a claim. */
export function normalizeEvidenceUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function hasDiscoveredReference(value: unknown, discoveredUrls: Set<string>): boolean {
  const normalized = normalizeEvidenceUrl(value);
  return Boolean(normalized && discoveredUrls.has(normalized));
}

/**
 * Describes retrieval provenance for a claim's references only. It deliberately does
 * not attempt to decide whether the text semantically supports or contradicts a claim.
 */
export function assessClaimEvidenceBasis(
  references: Array<{ url?: unknown }> = [],
  discoveredSources: Array<{
    url?: unknown;
    retrievedUrl?: unknown;
    retrievalStatus?: unknown;
    pageText?: unknown;
  }> = [],
): ClaimEvidenceBasis {
  const referenceUrls = references.map((reference) => normalizeEvidenceUrl(reference.url)).filter(Boolean);
  if (!referenceUrls.length) return 'no_references';

  const normalizedReferenceUrls = new Set(referenceUrls);
  const matchingSources = discoveredSources.filter((source) => {
    const urls = [normalizeEvidenceUrl(source.url), normalizeEvidenceUrl(source.retrievedUrl)].filter(Boolean);
    return urls.some((url) => normalizedReferenceUrls.has(url));
  });

  if (matchingSources.some((source) =>
    source.retrievalStatus === 'retrieved' &&
    typeof source.pageText === 'string' &&
    source.pageText.trim().length > 0
  )) return 'referenced_page_text_available';

  if (matchingSources.length) return 'search_snippets_only';
  return 'unmatched_references';
}

/** Keep the model's assessment, but never manufacture a confidence percentage from URL counts. */
export function normalizeClaimStatus(value: unknown): ClaimAssessmentStatus {
  return value === 'supported' || value === 'contradicted' || value === 'unresolved'
    ? value
    : 'unresolved';
}

export function normalizeModelConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, value));
}
