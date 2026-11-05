import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GuestWorkspacePreview } from '../src/components/GuestWorkspacePreview';

describe('guest workspace preview', () => {
  it('renders Library preview content for the library tab', () => {
    const html = renderToStaticMarkup(<GuestWorkspacePreview tab="library" />);
    expect(html).toContain('Saved history');
    expect(html).toContain('Notes');
    expect(html).toContain('Your own history appears here after sign-in.');
    expect(html).toContain('No guest notes are created.');
  });
});
