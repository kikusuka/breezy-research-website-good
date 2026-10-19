import { describe, it, expect } from 'vitest';

describe('Evidence & Pipeline Truthfulness', () => {
  it('calculates primarySourcesCount correctly from domain indicators', () => {
    const primaryDomainsRegex = /(\.gov|\.edu|\.org|github\.com|arxiv\.org|apache\.org|ietf\.org|w3\.org|docs?\.)/i;
    const sources = [
      { url: 'https://arxiv.org/abs/2301.00001' },
      { url: 'https://github.com/facebook/react' },
      { url: 'https://random-tech-blog.com/post' },
      { url: 'https://docs.python.org/3/' }
    ];

    const count = sources.filter((s) => primaryDomainsRegex.test(s.url)).length;
    expect(count).toBe(3); // arxiv.org, github.com, docs.python.org
  });

});
