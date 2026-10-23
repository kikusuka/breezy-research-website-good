/**
 * Structured Evidence Graph & Summarizer
 * Runtime-agnostic evidence graph extraction
 * Strict Truthfulness: Metrics come from recorded evidence and execution state.
 */

import { callAgentWithStream } from './providers';
import { BackendEnv } from './types';
import { assessClaimEvidenceBasis, hasDiscoveredReference, normalizeClaimStatus, normalizeEvidenceUrl, normalizeModelConfidence } from './evidenceAssessment';

export async function summarizeStage(
  content: string,
  roleName: string,
  apiKey?: string,
  env: BackendEnv = {},
  provider: 'gemini' | 'anthropic' | 'groq' | 'sambanova' | 'openrouter' = 'gemini',
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  if (!content || content.length < 300) return content;
  try {
    const summaryPrompt = `You are a high-density technical outline compressor.
Your sole job is to compress the "${roleName}" output into a high-density, ultra-compact technical summary.
- Extract only the key technical decisions, designs, identified bugs, or critical objections.
- Do NOT use explanatory narrative, conversational introduction, or polite conclusions.
- Output ONLY a flat, highly compressed list of technical bullets.
- Restrict your output to a maximum of 150 words.

CONTENT TO COMPRESS:
${content}`;

    const summary = await callAgentWithStream({
      provider,
      model,
      apiKey,
      systemInstruction: 'You are a high-density technical outline generator.',
      userPrompt: summaryPrompt,
      temperature: 0.1,
      enableSearchGrounding: false,
      onChunk: () => {},
      env,
    });
    return summary ? summary.trim() : content;
  } catch (err) {
    console.warn(`Failed to condense ${roleName} turn, using raw content:`, err);
    return content;
  }
}

export async function generateRealEvidenceGraph(opts: {
  prompt: string;
  finalSynthexis: string;
  proposalContent: string;
  critiqueContent: string;
  discoveredSources: any[];
  durationMs: number;
  isSolo?: boolean;
  apiKey?: string;
  env?: BackendEnv;
  provider?: 'gemini' | 'anthropic' | 'groq' | 'sambanova' | 'openrouter';
  model?: string;
  researchPlan?: string[];
}): Promise<{ evidenceGraph: any; researchMetrics: any }> {
  const {
    prompt,
    finalSynthexis,
    proposalContent,
    critiqueContent,
    discoveredSources,
    durationMs,
    isSolo = false,
    apiKey,
    env = {},
    provider = 'gemini',
    model = 'gemini-2.5-flash',
    researchPlan: suppliedResearchPlan = [],
  } = opts;

  if (isSolo) {
    return {
      evidenceGraph: {
        researchPlan: suppliedResearchPlan.length > 0 ? suppliedResearchPlan : [`Single-model inquiry: ${prompt.slice(0, 80)}`],
        claims: [],
        contradictions: [],
        sourcesConsulted: discoveredSources,
        auditStatus: 'solo_inquiry',
      },
      researchMetrics: {
        durationMs,
        claimsIdentified: 0,
        claimsSupported: 0,
        claimsContradicted: 0,
        claimsUnresolved: 0,
        sourcesConsulted: discoveredSources.length,
        primarySourcesCount: 0,
      },
    };
  }

  try {
    const extractionPrompt = `You are a rigorous research auditor for an evidence-grounded research platform.
Analyze this technical debate transcript and return a valid JSON object extracting the real evidence graph.

USER QUESTION:
${prompt}

SOURCES DISCOVERED:
${JSON.stringify(discoveredSources.map((s) => ({ title: s.title, url: s.url, domain: s.domain, snippet: s.snippet, pageText: typeof s.pageText === 'string' ? s.pageText.slice(0, 1200) : undefined })))}

ANALYST PROPOSAL EXCERPT:
${proposalContent.slice(0, 1500)}

CRITIC OBJECTIONS EXCERPT:
${critiqueContent.slice(0, 1500)}

FINAL SYNTHEXIS EXCERPT:
${finalSynthexis.slice(0, 2000)}

OUTPUT ONLY A VALID JSON OBJECT WITH THIS EXACT STRUCTURE (no backticks, no markdown):
{
  "researchPlan": [
    "Subquestion 1 investigated",
    "Subquestion 2 investigated"
  ],
  "claims": [
    {
      "id": "claim-1",
      "claim": "Specific assertion extracted from findings",
      "status": "supported",
      "confidence": null,
      "supportingSources": [{"title": "Source name", "url": "https://...", "snippet": "relevant quote"}],
      "counterEvidence": [],
      "analystStance": "Position in proposal",
      "criticStance": "Caveat or objection",
      "reviewerVerdict": "Final resolution"
    }
  ],
  "contradictions": [
    {
      "id": "contra-1",
      "claimA": "Position A",
      "claimB": "Position B",
      "description": "Why these positions were in conflict",
      "resolutionStatus": "resolved",
      "reconciledResolution": "Resolution"
    }
  ]
}

CONFIDENCE RULE: confidence is a model estimate from 0 to 100 only when there is a defensible basis; otherwise return null. Never derive confidence from the number of matching URLs.
`;

    const rawResult = await callAgentWithStream({
      provider,
      model,
      apiKey,
      systemInstruction: 'You extract structured evidence graphs from research transcripts in valid JSON.',
      userPrompt: extractionPrompt,
      temperature: 0.1,
      enableSearchGrounding: false,
      onChunk: () => {},
      env,
    });

    const cleaned = rawResult.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleaned);

    const extractedPlan = Array.isArray(parsed.researchPlan) && parsed.researchPlan.length > 0 ? parsed.researchPlan : [];
    const researchPlan = suppliedResearchPlan.length > 0 ? suppliedResearchPlan : extractedPlan;

    let claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    
    // A matching URL only means the reference appeared in search results. It does not
    // prove that the page was fetched, read, or actually supports the claim.
    const discoveredUrls = new Set(
      discoveredSources.flatMap((source) => [normalizeEvidenceUrl(source?.url), normalizeEvidenceUrl(source?.retrievedUrl)]).filter(Boolean),
    );

    claims = claims.map((claim: any) => {
      const confidence = normalizeModelConfidence(claim.confidence);
      const supportingSources = (Array.isArray(claim.supportingSources) ? claim.supportingSources : []).map((source: any) => ({
        ...source,
        referenceFound: hasDiscoveredReference(source?.url, discoveredUrls),
      }));
      const counterEvidence = (Array.isArray(claim.counterEvidence) ? claim.counterEvidence : []).map((source: any) => ({
        ...source,
        referenceFound: hasDiscoveredReference(source?.url, discoveredUrls),
      }));
      const evidenceBasis = assessClaimEvidenceBasis(
        [...supportingSources, ...counterEvidence],
        discoveredSources,
      );

      return {
        ...claim,
        status: normalizeClaimStatus(claim.status),
        confidence,
        evidenceBasis,
        supportingSources,
        counterEvidence,
      };
    });

    const contradictions = Array.isArray(parsed.contradictions) ? parsed.contradictions : [];

    const claimsIdentified = claims.length;
    const claimsSupported = claims.filter((c: any) => c.status === 'supported').length;
    const claimsContradicted = claims.filter((c: any) => c.status === 'contradicted').length;
    const claimsUnresolved = claims.filter((c: any) => c.status === 'unresolved').length;
    const sourcesConsulted = discoveredSources.length;


    const preferredDomainsRegex = /(\.gov|\.edu|\.org|github\.com|arxiv\.org|apache\.org|ietf\.org|w3\.org|docs?\.)/i;
    const preferredDomainSourcesCount = discoveredSources.filter((s: any) => {
      const url = s.url || s.domain || s.title || '';
      return preferredDomainsRegex.test(url);
    }).length;

    const researchMetrics = {
      durationMs,
      claimsIdentified,
      claimsSupported,
      claimsContradicted,
      claimsUnresolved,
      sourcesConsulted,
      primarySourcesCount: preferredDomainSourcesCount,
      preferredDomainSourcesCount,
    };

    const evidenceGraph = {
      researchPlan,
      claims,
      contradictions,
      sourcesConsulted: discoveredSources,
      auditStatus: claimsIdentified > 0 ? 'audited' : 'insufficient_evidence',
    };

    return { evidenceGraph, researchMetrics };
  } catch (err) {
    console.warn('Evidence graph extraction could not parse structured findings:', err);
    return {
      evidenceGraph: {
        researchPlan: [],
        claims: [],
        contradictions: [],
        sourcesConsulted: discoveredSources,
        auditStatus: 'incomplete',
      },
      researchMetrics: {
        durationMs,
        claimsIdentified: 0,
        claimsSupported: 0,
        claimsContradicted: 0,
        claimsUnresolved: 0,
        sourcesConsulted: discoveredSources.length,
        primarySourcesCount: 0,
      },
    };
  }
}
