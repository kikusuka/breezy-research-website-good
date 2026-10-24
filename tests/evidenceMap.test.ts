import { describe, expect, it } from 'vitest';
import type { EvidenceSource, ResearchClaim } from '../src/types';
import { buildEvidenceMapSources, claimAssessmentPresentation, claimEvidenceUrls, contradictionResolutionLabel, evidenceMapEmptyState, normalizeEvidenceUrl } from '../src/lib/evidenceMap';

const source = (overrides: Partial<EvidenceSource> = {}): EvidenceSource => ({
  id: 'source-1',
  title: 'Documentation',
  url: 'https://example.com/docs',
  domain: 'example.com',
  isPrimary: false,
  snippet: 'Actual source snippet',
  ...overrides,
});

const claim = (overrides: Partial<ResearchClaim> = {}): ResearchClaim => ({
  id: 'claim-1',
  claim: 'The documented behavior is supported.',
  status: 'unresolved',
  confidence: 50,
  supportingSources: [],
  counterEvidence: [],
  ...overrides,
});

describe('evidence map model', () => {
  it('explains why single-model research has no claim nodes without implying research failed', () => {
    expect(evidenceMapEmptyState('solo_inquiry')).toEqual({
      title: 'Source records for this investigation',
      description: 'Breezy used one configured research-model call for the answer and did not make a second model call to extract claim nodes. Source records appear here when search returned them; no claim relationships are generated for this run.',
    });
  });

  it('distinguishes incomplete evidence extraction from an intentional single-model run', () => {
    expect(evidenceMapEmptyState('incomplete').title).toBe('Evidence map unavailable');
    expect(evidenceMapEmptyState('insufficient_evidence').title).toBe('No structured claims identified');
    expect(evidenceMapEmptyState(undefined).title).toBe('No evidence map for this run');
  });
  it('uses discovered source records without inventing extra nodes', () => {
    const result = buildEvidenceMapSources([source()], []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'Documentation', url: 'https://example.com/docs', discovered: true });
  });

  it('includes explicit claim references missing from the discovered-source list and marks them honestly', () => {
    const item = claim({
      supportingSources: [{ title: 'Referenced page', url: 'https://example.org/guide', snippet: 'A quoted passage' }],
    });
    const result = buildEvidenceMapSources([], [item]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'Referenced page', discovered: false, snippet: 'A quoted passage' });
  });

  it('deduplicates fragments but preserves distinct query-string resources', () => {
    const result = buildEvidenceMapSources([
      source({ url: 'https://example.com/docs#intro' }),
      source({ id: 'source-2', url: 'https://example.com/docs#details', title: 'Second record' }),
      source({ id: 'source-3', url: 'https://example.com/docs?version=2', title: 'Version two' }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Second record');
    expect(result[1].url).toBe('https://example.com/docs?version=2');
  });

  it('links a selected claim only to its explicit support and counter-evidence references', () => {
    const item = claim({
      supportingSources: [{ title: 'Support', url: 'https://example.com/a#passage' }],
      counterEvidence: [{ title: 'Counter', url: 'https://example.com/b' }],
    });
    expect([...claimEvidenceUrls(item)]).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(claimEvidenceUrls(null).size).toBe(0);
  });

  it('does not label claims as supported when references are absent or unmatched', () => {
    expect(claimAssessmentPresentation(claim({
      status: 'supported',
      evidenceBasis: 'no_references',
    }))).toMatchObject({
      label: 'Model assessment · no matched references',
      icon: 'help',
    });

    expect(claimAssessmentPresentation(claim({
      status: 'contradicted',
      evidenceBasis: 'unmatched_references',
    }))).toMatchObject({
      label: 'Model assessment · no matched references',
      icon: 'help',
    });
  });

  it('makes limited provenance visible for snippet-only and legacy claims', () => {
    expect(claimAssessmentPresentation(claim({
      status: 'supported',
      evidenceBasis: 'search_snippets_only',
    })).label).toBe('Model-assessed support · snippets only');

    expect(claimAssessmentPresentation(claim({
      status: 'supported',
    })).label).toBe('Model-assessed support · provenance unavailable');
  });

  it('retains the existing model-assisted label when bounded page text was retrieved', () => {
    expect(claimAssessmentPresentation(claim({
      status: 'supported',
      evidenceBasis: 'referenced_page_text_available',
    })).label).toBe('Model-assessed support');
  });

  it('labels model-generated contradiction statuses cautiously', () => {
    expect(contradictionResolutionLabel('resolved')).toBe('Model-assessed resolution');
    expect(contradictionResolutionLabel('contested')).toBe('Contested');
    expect(contradictionResolutionLabel('unclear')).toBe('Unclear');
    expect(contradictionResolutionLabel('unexpected-status')).toBe('Unclear');
    expect(contradictionResolutionLabel(undefined)).toBe('Unclear');
  });

  it('does not invent a URL for missing source references', () => {
    expect(normalizeEvidenceUrl('')).toBe('');
    expect(normalizeEvidenceUrl('javascript:alert(1)')).toBe('');
    expect(normalizeEvidenceUrl('file:///etc/passwd')).toBe('');
    expect(buildEvidenceMapSources([source({ url: '' })], [])).toHaveLength(0);
  });
});
