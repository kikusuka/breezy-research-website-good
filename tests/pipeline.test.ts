import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/server-core/providers', () => ({
  callAgentWithStream: vi.fn(),
}));

import { callAgentWithStream } from '../src/server-core/providers';
import { generateRealEvidenceGraph } from '../src/server-core/evidence';

const baseOptions = {
  prompt: 'What does the evidence say?',
  finalSynthexis: 'The final synthesis.',
  proposalContent: 'The analyst proposal.',
  critiqueContent: 'The critic objections.',
  discoveredSources: [],
  durationMs: 1250,
};

describe('Evidence & Pipeline Truthfulness', () => {
  beforeEach(() => {
    vi.mocked(callAgentWithStream).mockReset();
  });

  it('reports preferred-domain matches without calling them primary sources', async () => {
    vi.mocked(callAgentWithStream).mockResolvedValue(JSON.stringify({
      researchPlan: [],
      claims: [],
      contradictions: [],
    }));

    const result = await generateRealEvidenceGraph({
      ...baseOptions,
      discoveredSources: [
        { url: 'https://arxiv.org/abs/2301.00001' },
        { url: 'https://github.com/example/project' },
        { url: 'https://docs.python.org/3/' },
        { url: 'https://random-tech-blog.example/post' },
      ],
    });

    expect(result.researchMetrics.preferredDomainSourcesCount).toBe(3);
    expect(result.researchMetrics).not.toHaveProperty('primarySourcesCount');
  });
});
