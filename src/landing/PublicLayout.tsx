import React from 'react';
import { BreezyLogo } from '../components/BreezyLogo';

const link = 'min-h-11 inline-flex items-center px-3 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors';

/** Header and footer shared by the public pages. Uses the same theme tokens as the app. */
export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[100dvh] bg-background text-on-surface flex flex-col">
    <header className="sticky top-0 z-30 border-b border-outline-variant/40 bg-background/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 font-headline-sm text-headline-sm" aria-label="Breezy home">
          <BreezyLogo size={32} /> Breezy
        </a>
        <nav aria-label="Site" className="ml-auto hidden sm:flex items-center font-label-md text-label-md">
          <a href="/#features" className={link}>Features</a>
          <a href="/#data" className={link}>Your data</a>
          <a href="/privacy" className={link}>Privacy</a>
        </nav>
        <a href="/app" className="ml-auto sm:ml-2 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-label-md text-label-md text-on-primary hover:brightness-105 transition">Open Breezy</a>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="border-t border-outline-variant/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 sm:px-6 font-body-sm text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-2"><BreezyLogo size={20} /> Breezy</span>
        <a href="/privacy" className="hover:text-on-surface">Privacy</a>
        <span className="ml-auto text-outline">Early access: features change as Breezy grows.</span>
      </div>
    </footer>
  </div>
);
