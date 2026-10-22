import { describe, expect, it } from 'vitest';
import {
  hasDiscoveredReference,
  normalizeClaimStatus,
  normalizeEvidenceUrl,
  normalizeModelConfidence,
} from '../src/server-core/evidenceAssessment';

describe('honest evidence assessment', () => {
  it('matches a discovered URL while ignoring only the fragment', () => {
    const discovered = new Set([normalizeEvidenceUrl('https://example.com/page?version=2')]);
    expect(hasDiscoveredReference('https://example.com/page?version=2#section', discovered)).toBe(true);
    expect(hasDiscoveredReference('https://example.com/page?version=3', discovered)).toBe(false);
  });

  it('does not treat a matching URL as claim verification', () => {
    const discovered = new Set([normalizeEvidenceUrl('https://example.com/page')]);
    expect(hasDiscoveredReference('https://example.com/page', discovered)).toBe(true);
    // The helper only reports reference presence; it has no claim text or page content to verify.
    expect(Object.keys({ referenceFound: hasDiscoveredReference('https://example.com/page', discovered) })).toEqual(['referenceFound']);
  });

  it('rejects unsafe and malformed URLs as references', () => {
    expect(normalizeEvidenceUrl('javascript:alert(1)')).toBe('');
    expect(normalizeEvidenceUrl('file:///etc/passwd')).toBe('');
    expect(normalizeEvidenceUrl('not a url')).toBe('');
  });

  it('preserves valid model assessments and makes unknown statuses unresolved', () => {
    expect(normalizeClaimStatus('supported')).toBe('supported');
    expect(normalizeClaimStatus('contradicted')).toBe('contradicted');
    expect(normalizeClaimStatus('invented-status')).toBe('unresolved');
    expect(normalizeClaimStatus(undefined)).toBe('unresolved');
  });

  it('clamps only an explicitly supplied finite model confidence and never invents one', () => {
    expect(normalizeModelConfidence(73)).toBe(73);
    expect(normalizeModelConfidence(-5)).toBe(0);
    expect(normalizeModelConfidence(150)).toBe(100);
    expect(normalizeModelConfidence(Number.NaN)).toBeUndefined();
    expect(normalizeModelConfidence(undefined)).toBeUndefined();
    expect(normalizeModelConfidence('90')).toBeUndefined();
  });
});
