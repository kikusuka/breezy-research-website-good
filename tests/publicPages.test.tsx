import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LandingPage } from '../src/landing/LandingPage';
import { PrivacyPage } from '../src/landing/PrivacyPage';

describe('public pages', () => {
  it('landing page links into the app and to privacy', () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain('href="/app"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('Open Breezy');
  });

  it('landing page does not present the unreleased model or invented numbers as live', () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain('in development and is not available yet');
    expect(html).not.toMatch(/\d+\s?(\+|k|M)?\s?(users|downloads|countries)/i);
  });

  it('privacy page states how keys are handled', () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain('Model keys');
    expect(html).toContain('sent with that request');
  });
});
