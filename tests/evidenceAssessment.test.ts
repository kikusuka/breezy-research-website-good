import { describe, expect, it } from 'vitest';
import {
  assessClaimEvidenceBasis,
  assessSourcePassageMatch,
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

  it('marks referenced page text as available without claiming semantic support', () => {
    expect(assessClaimEvidenceBasis(
      [{ url: 'https://example.com/page#claim' }],
      [{ url: 'https://example.com/page', retrievalStatus: 'retrieved', pageText: 'The actual bounded page text.' }],
    )).toBe('referenced_page_text_available');
  });

  it('distinguishes snippet-only matches from unmatched references', () => {
    expect(assessClaimEvidenceBasis(
      [{ url: 'https://example.com/page' }],
      [{ url: 'https://example.com/page', retrievalStatus: 'unavailable', pageText: '' }],
    )).toBe('search_snippets_only');
    expect(assessClaimEvidenceBasis(
      [{ url: 'https://not-found.example/page' }],
      [{ url: 'https://example.com/page', retrievalStatus: 'retrieved', pageText: 'Page text' }],
    )).toBe('unmatched_references');
  });

  it('reports when a claim has no source references', () => {
    expect(assessClaimEvidenceBasis([], [{ url: 'https://example.com/page', retrievalStatus: 'retrieved', pageText: 'Page text' }]))
      .toBe('no_references');
    expect(assessClaimEvidenceBasis([{ url: 'javascript:alert(1)' }], []))
      .toBe('no_references');
  });

  it('matches references against the validated final URL after redirects', () => {
    expect(assessClaimEvidenceBasis(
      [{ url: 'https://redirect.example/old' }],
      [{ url: 'https://redirect.example/old', retrievedUrl: 'https://docs.example/new', retrievalStatus: 'retrieved', pageText: 'Page text' }],
    )).toBe('referenced_page_text_available');
    expect(assessClaimEvidenceBasis(
      [{ url: 'https://docs.example/new' }],
      [{ url: 'https://redirect.example/old', retrievedUrl: 'https://docs.example/new', retrievalStatus: 'retrieved', pageText: 'Page text' }],
    )).toBe('referenced_page_text_available');
  });

  it('matches an excerpt against retrieved text after whitespace and case normalization', () => {
    expect(assessSourcePassageMatch(
      { url: 'https://example.com/page', snippet: 'THE documented behavior\\nuses a stable key for each record.' },
      [{ url: 'https://example.com/page', retrievalStatus: 'retrieved', pageText: 'The documented behavior uses a stable key for each record.' }],
    )).toBe('matched_retrieved_text');
  });

  it('flags a model-listed excerpt that is absent from the retrieved page', () => {
    expect(assessSourcePassageMatch(
      { url: 'https://example.com/page', snippet: 'This invented sentence is not in the actual page content.' },
      [{ url: 'https://example.com/page', retrievalStatus: 'retrieved', pageText: 'The actual page content discusses a different subject entirely.' }],
    )).toBe('not_found_in_retrieved_text');
  });

  it('does not claim to check excerpts when page text is unavailable or the quote is too short', () => {
    expect(assessSourcePassageMatch(
      { url: 'https://example.com/page', snippet: 'A sufficiently long excerpt that cannot be checked.' },
      [{ url: 'https://example.com/page', retrievalStatus: 'unavailable', pageText: '' }],
    )).toBe('not_checked_no_page_text');
    expect(assessSourcePassageMatch(
      { url: 'https://example.com/page', snippet: 'the docs say yes' },
      [{ url: 'https://example.com/page', retrievalStatus: 'retrieved', pageText: 'The docs say yes, and more information follows.' }],
    )).toBe('quote_too_short');
  });

  it('matches excerpts against a validated final URL after redirects', () => {
    expect(assessSourcePassageMatch(
      { url: 'https://docs.example/new', snippet: 'A sufficiently long excerpt from the final destination.' },
      [{ url: 'https://redirect.example/old', retrievedUrl: 'https://docs.example/new', retrievalStatus: 'retrieved', pageText: 'A sufficiently long excerpt from the final destination.' }],
    )).toBe('matched_retrieved_text');
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
