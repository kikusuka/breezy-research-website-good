import React from 'react';

/** Shared workspace frame: consistent page width, header rhythm and card treatment. */
export function Page({ crumb, title, subtitle, right, children, narrow = false }: { crumb: string; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`breezy-page ${narrow ? 'breezy-page--narrow' : ''} flex flex-col gap-6 sm:gap-8`}>
      <header className="breezy-page-header">
        <div className="min-w-0">
          <div className="hidden lg:block breezy-eyebrow">Workspace / {crumb}</div>
          <h1 className="mt-1 font-headline-xl-mobile text-headline-xl-mobile tracking-tight text-on-surface lg:font-headline-xl lg:text-headline-xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl font-body-md text-body-md text-on-surface-variant">{subtitle}</p>}
        </div>
        {right && <div className="self-start md:self-auto">{right}</div>}
      </header>
      {children}
    </div>
  );
}

export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`breezy-card ${className}`}>{children}</section>
);

export const fieldCls = 'breezy-control font-body-sm text-body-sm';
