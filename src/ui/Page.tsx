import React from 'react';
/** Standard Stitch page frame: breadcrumb, headline, optional right slot. */
export function Page({ crumb, title, subtitle, right, children, narrow = false }: { crumb: string; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`w-full ${narrow ? 'max-w-3xl' : 'max-w-5xl'} mx-auto px-gutter lg:px-space-lg py-space-lg lg:py-space-xl flex flex-col gap-space-lg lg:gap-space-xl`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="min-w-0"><div className="hidden lg:block font-code-sm text-code-sm uppercase tracking-wider text-outline">Workspace / {crumb}</div>
          <h1 className="font-headline-xl-mobile lg:font-headline-xl text-headline-xl-mobile lg:text-headline-xl tracking-tight mt-1">{title}</h1>
          {subtitle && <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xl">{subtitle}</p>}</div>
        {right && <div className="self-start md:self-auto">{right}</div>}
      </div>
      {children}
    </div>
  );
}
export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`bg-surface-container rounded-3xl p-space-lg coat ${className}`}>{children}</div>;
export const fieldCls = 'w-full bg-surface-container-lowest rounded-xl hairline px-space-md min-h-[44px] font-body-sm text-body-sm focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]';
