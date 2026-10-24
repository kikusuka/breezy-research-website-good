import React, { useMemo, useState } from 'react';
import type { EvidenceGraph, ResearchClaim } from '../../types';
import { Icon } from '../../shell/Icon';
import { buildEvidenceMapSources, claimAssessmentPresentation, claimEvidenceUrls, contradictionResolutionLabel, evidenceMapEmptyState, normalizeEvidenceUrl, safeEvidenceHref } from '../../lib/evidenceMap';

type EvidenceMapProps = { graph?: EvidenceGraph | null };

export function EvidenceMap({ graph }: EvidenceMapProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const claims = graph?.claims ?? [];
  const discoveredSources = graph?.sourcesConsulted ?? [];
  const contradictions = graph?.contradictions ?? [];

  const sources = useMemo(() => buildEvidenceMapSources(discoveredSources, claims), [claims, discoveredSources]);
  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId) ?? null;
  const linkedUrls = claimEvidenceUrls(selectedClaim);

  const claimStatus = (claim: ResearchClaim) => claimAssessmentPresentation(claim);

  const evidenceBasisLabel = (claim: ResearchClaim) => {
    switch (claim.evidenceBasis) {
      case 'referenced_page_text_available':
        return 'Cited page text retrieved · support remains model-assessed';
      case 'search_snippets_only':
        return 'Search snippets only · support unverified';
      case 'unmatched_references':
        return 'References not matched to discovered sources';
      case 'no_references':
        return 'No source references attached';
      default:
        return 'Evidence provenance unavailable for this saved run';
    }
  };

  const passageMatchLabel = (source: { passageMatch?: ResearchClaim['supportingSources'][number]['passageMatch'] }) => {
    switch (source.passageMatch) {
      case 'matched_retrieved_text':
        return 'Excerpt matched retrieved page text; semantic support still unverified';
      case 'not_found_in_retrieved_text':
        return 'Excerpt not found in retrieved page text';
      case 'quote_too_short':
        return 'Excerpt too short for a reliable text match';
      case 'not_checked_no_page_text':
        return 'Excerpt could not be checked against retrieved page text';
      default:
        return 'Excerpt check unavailable for this saved run';
    }
  };

  if (!claims.length && !sources.length && !contradictions.length) {
    const emptyState = evidenceMapEmptyState(graph?.auditStatus);
    return (
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-space-xl text-center">
        <span className="mx-auto mb-space-md flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high text-outline"><Icon name="account_tree" className="text-[24px]" /></span>
        <h3 className="font-headline-sm text-headline-sm">{emptyState.title}</h3>
        <p className="mx-auto mt-space-xs max-w-lg font-body-sm text-body-sm text-on-surface-variant">{emptyState.description}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-space-sm">
        <div>
          <h3 className="font-headline-md text-headline-md">Evidence relationships</h3>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Select a claim to highlight the sources attached to it.</p>
        </div>
        <span className="self-start rounded-full bg-surface-container-high px-space-md py-space-xs font-code-sm text-code-sm text-on-surface-variant">{claims.length} claims · {sources.length} sources</span>
      </div>
      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-space-md py-space-sm font-body-sm text-on-surface-variant">
        <Icon name="info" className="mr-1 text-[16px] align-middle" />Claim labels are model-assisted and are not independent verification. Connections below reflect source references present in this run's data.
      </div>
      {contradictions.length > 0 && (
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container p-space-md">
          <h4 className="font-headline-sm text-headline-sm">Potential contradictions</h4>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Model-identified tensions are not independently verified. Any proposed resolution still needs source review.</p>
          <div className="mt-space-md flex flex-col gap-space-sm">
            {contradictions.map((item, index) => (
              <article key={item.id || `contradiction-${index}`} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-space-md">
                <div className="flex flex-wrap items-center justify-between gap-space-sm">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Tension {index + 1}</span>
                  <span className="rounded-md bg-surface-container-high px-space-sm py-1 font-label-sm text-label-sm text-on-surface-variant">{contradictionResolutionLabel(item.resolutionStatus)}</span>
                </div>
                <div className="mt-space-sm grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  <div className="rounded-lg border border-outline-variant/30 p-space-sm"><p className="font-label-sm text-label-sm text-outline">Position A</p><p className="mt-1 break-words font-body-md text-body-md text-on-surface">{item.claimA || 'Position not supplied'}</p></div>
                  <div className="rounded-lg border border-outline-variant/30 p-space-sm"><p className="font-label-sm text-label-sm text-outline">Position B</p><p className="mt-1 break-words font-body-md text-body-md text-on-surface">{item.claimB || 'Position not supplied'}</p></div>
                </div>
                {item.description && <p className="mt-space-sm whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface-variant">{item.description}</p>}
                {item.resolutionStatus === 'resolved' && <div className="mt-space-sm rounded-lg bg-surface-container-high p-space-sm"><p className="font-label-sm text-label-sm text-outline">Model-assessed reconciliation</p><p className="mt-1 whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface">{item.reconciledResolution || 'No reconciliation details were supplied.'}</p></div>}
                {(item.sourceA || item.sourceB) && <p className="mt-space-sm break-words font-label-sm text-label-sm text-outline">Model-listed source references: {[item.sourceA, item.sourceB].filter(Boolean).join(' · ')}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] gap-space-md items-start">
        <div className="flex min-w-0 flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs px-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline"><Icon name="lightbulb" className="text-[16px]" />Claims / findings</div>
          {claims.length ? claims.map((claim) => {
            const status = claimStatus(claim);
            const active = claim.id === selectedClaimId;
            const evidenceCount = (claim.supportingSources?.length ?? 0) + (claim.counterEvidence?.length ?? 0);
            return (
              <article key={claim.id} className={`min-w-0 rounded-2xl border p-space-md transition-colors ${active ? 'border-primary/70 bg-surface-container-high' : 'border-outline-variant/40 bg-surface-container'}`}>
                <button type="button" aria-pressed={active} onClick={() => setSelectedClaimId(active ? null : claim.id)} className="w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <div className="flex items-start gap-space-sm">
                  <Icon name={status.icon} className={`mt-0.5 text-[19px] shrink-0 ${status.tone}`} />
                  <span className="min-w-0 flex-1 font-body-md text-body-md text-on-surface break-words">{claim.claim}</span>
                  <Icon name={active ? 'expand_less' : 'chevron_right'} className="text-[18px] text-outline shrink-0" />
                </div>
                <div className="mt-space-sm flex flex-wrap items-center gap-space-xs pl-[27px]">
                  <span className={`rounded-md bg-surface-container-low px-space-sm py-1 font-code-sm text-code-sm ${status.tone}`}>{status.label}</span>
                  <span className="font-code-sm text-code-sm text-outline">{evidenceCount} linked references</span>
                </div>
                <p className="mt-1 pl-[27px] font-label-sm text-label-sm text-on-surface-variant">{evidenceBasisLabel(claim)}</p>
                </button>
                {active && (
                  <div className="mt-space-md border-t border-outline-variant/40 pt-space-md pl-[27px] flex flex-col gap-space-sm">
                    {claim.supportingSources?.map((source, i) => (
                      <div key={`support-${source.url}-${i}`} className="rounded-lg bg-surface-container-low p-space-sm">
                        <div className="font-label-sm text-label-sm text-tertiary">Model-listed supporting evidence</div>
                        <div className="mt-1 font-label-sm text-label-sm text-outline">{source.referenceFound === true ? "Reference URL matched a discovered/fetched source; claim support not verified" : source.referenceFound === false ? "Reference URL not matched to discovered results" : "Reference match status unavailable for this saved run"}</div>
                        {source.snippet && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{source.snippet}</p>}
                        <p className="mt-1 font-label-sm text-label-sm text-outline">{passageMatchLabel(source)}</p>
                        {safeEvidenceHref(source.url) ? <a href={safeEvidenceHref(source.url) || undefined} target="_blank" rel="noreferrer noopener" onClick={(event) => event.stopPropagation()} className="mt-1 inline-flex max-w-full items-center gap-space-xs font-body-sm text-primary underline underline-offset-2"><Icon name="open_in_new" className="text-[14px] shrink-0" /><span className="truncate">{source.title || source.domain || source.url}</span></a> : <span className="mt-1 block break-words font-body-sm text-on-surface-variant">{source.title || source.domain || 'Source URL unavailable'}</span>}
                      </div>
                    ))}
                    {claim.counterEvidence?.map((source, i) => (
                      <div key={`counter-${source.url}-${i}`} className="rounded-lg bg-surface-container-low p-space-sm">
                        <div className="font-label-sm text-label-sm text-error">Model-listed counter-evidence</div>
                        <div className="mt-1 font-label-sm text-label-sm text-outline">{source.referenceFound === true ? "Reference URL found in search results; claim support not verified" : source.referenceFound === false ? "Reference URL not matched to discovered results" : "Reference match status unavailable for this saved run"}</div>
                        {source.snippet && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{source.snippet}</p>}
                        <p className="mt-1 font-label-sm text-label-sm text-outline">{passageMatchLabel(source)}</p>
                        {safeEvidenceHref(source.url) ? <a href={safeEvidenceHref(source.url) || undefined} target="_blank" rel="noreferrer noopener" onClick={(event) => event.stopPropagation()} className="mt-1 inline-flex max-w-full items-center gap-space-xs font-body-sm text-primary underline underline-offset-2"><Icon name="open_in_new" className="text-[14px] shrink-0" /><span className="truncate">{source.title || source.domain || source.url}</span></a> : <span className="mt-1 block break-words font-body-sm text-on-surface-variant">{source.title || source.domain || 'Source URL unavailable'}</span>}
                      </div>
                    ))}
                    {!evidenceCount && <p className="font-body-sm text-on-surface-variant">No source references were attached to this claim.</p>}
                  </div>
                )}
              </article>
            );
          }) : <p className="rounded-xl border border-dashed border-outline-variant/50 p-space-md font-body-sm text-on-surface-variant">No structured claims were returned for this run.</p>}
        </div>

        <div className="hidden xl:flex items-center justify-center pt-12 text-outline" aria-hidden="true">
          <Icon name="arrow_left_right" className="text-[22px]" />
        </div>

        <div className="flex min-w-0 flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs px-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline"><Icon name="link" className="text-[16px]" />Source records</div>
          {sources.length ? sources.map((source) => {
            const highlighted = linkedUrls.has(normalizeEvidenceUrl(source.url));
            return (
              <article key={source.id} className={`min-w-0 rounded-2xl border p-space-md transition-colors ${highlighted ? 'border-primary/60 bg-surface-container-high' : 'border-outline-variant/40 bg-surface-container'}`}>
                <div className="flex items-start gap-space-sm">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-secondary"><Icon name="description" className="text-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    {safeEvidenceHref(source.url) ? <a href={safeEvidenceHref(source.url) || undefined} target="_blank" rel="noreferrer noopener" className="font-body-md text-body-md text-on-surface underline decoration-outline-variant underline-offset-2 hover:text-primary break-words">{source.title}</a> : <span className="font-body-md text-body-md text-on-surface break-words">{source.title}</span>}
                    <p className="mt-1 truncate font-code-sm text-code-sm text-outline">{source.domain || source.url}</p>
                    <p className="mt-2 font-label-sm text-label-sm text-outline">{source.discovered ? 'Discovered source record' : 'Referenced by a claim; not in the discovered-source list'}</p>
                    {source.retrievedUrl && source.retrievedUrl !== source.url && <p className="mt-1 break-words font-label-sm text-label-sm text-outline">Fetched after redirect: {source.retrievedUrl}</p>}
                    {source.discovered && <p className="mt-1 font-label-sm text-label-sm text-outline">{source.retrievalStatus === 'retrieved' ? 'Page text retrieved (bounded extract)' : source.retrievalStatus === 'unavailable' ? 'Page text unavailable; search snippet only' : source.retrievalStatus === 'not_attempted' ? 'Page retrieval not attempted' : 'Retrieval status unavailable for this saved run'}</p>}
                  </div>
                </div>
                {source.snippet && <p className="mt-space-sm border-t border-outline-variant/30 pt-space-sm font-body-sm text-body-sm text-on-surface-variant">{source.snippet}</p>}
                {source.pageText && <details className="mt-space-sm rounded-lg bg-surface-container-low p-space-sm"><summary className="cursor-pointer font-label-sm text-label-sm text-primary">Read extracted page text</summary><p className="mt-space-sm whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface-variant">{source.pageText}</p></details>}
                {highlighted && <div className="mt-space-sm inline-flex items-center gap-space-xs rounded-md bg-primary/10 px-space-sm py-1 font-code-sm text-primary"><Icon name="link" className="text-[14px]" />Linked to selected claim</div>}
              </article>
            );
          }) : <p className="rounded-xl border border-dashed border-outline-variant/50 p-space-md font-body-sm text-on-surface-variant">No source records were returned.</p>}
        </div>
      </div>
    </section>
  );
}
