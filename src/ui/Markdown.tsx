import React from 'react';
import ReactMarkdown from 'react-markdown';
/** Markdown in the Stitch type scale. */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`font-body-md text-body-md text-on-surface leading-[1.65] break-words ${className}`}>
      <ReactMarkdown components={{
        h1: (p) => <h1 className="font-headline-lg text-headline-lg mt-space-lg mb-space-sm first:mt-0" {...p} />,
        h2: (p) => <h2 className="font-headline-md text-headline-md mt-space-lg mb-space-xs first:mt-0" {...p} />,
        h3: (p) => <h3 className="font-headline-sm text-headline-sm mt-space-md mb-space-xs first:mt-0" {...p} />,
        p: (p) => <p className="mb-space-md last:mb-0" {...p} />,
        ul: (p) => <ul className="list-disc pl-space-lg mb-space-md space-y-space-xs marker:text-outline" {...p} />,
        ol: (p) => <ol className="list-decimal pl-space-lg mb-space-md space-y-space-xs marker:text-outline" {...p} />,
        a: (p) => <a className="text-secondary hover:text-primary underline underline-offset-2 decoration-outline-variant" target="_blank" rel="noreferrer noopener" {...p} />,
        strong: (p) => <strong className="font-semibold" {...p} />,
        blockquote: (p) => <blockquote className="border-l-2 border-outline-variant pl-space-md my-space-md text-on-surface-variant" {...p} />,
        hr: () => <hr className="my-space-lg border-outline-variant/40" />,
        code: ({ className: c, children: ch, ...r }) => (/language-/.test(c || '') || String(ch).includes('\n')
          ? <code className={`font-code-md text-code-md ${c || ''}`} {...r}>{ch}</code>
          : <code className="font-code-md text-code-sm bg-surface-container-high text-primary-fixed-dim px-1 py-0.5 rounded" {...r}>{ch}</code>),
        pre: (p) => <pre className="bg-surface-container-lowest rounded-xl p-space-md my-space-md overflow-x-auto font-code-md text-code-md" {...p} />,
        table: (p) => <div className="overflow-x-auto my-space-md"><table className="w-full text-left font-body-sm text-body-sm border-collapse" {...p} /></div>,
        th: (p) => <th className="font-label-md text-label-md text-on-surface-variant px-space-sm py-space-xs border-b border-outline-variant/50" {...p} />,
        td: (p) => <td className="px-space-sm py-space-xs border-b border-outline-variant/20 align-top" {...p} />,
      }}>{children}</ReactMarkdown>
    </div>
  );
}
