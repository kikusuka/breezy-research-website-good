/** Helpers for honest, model-assisted evidence assessments. */
export type ClaimAssessmentStatus = 'supported' | 'contradicted' | 'unresolved';

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
