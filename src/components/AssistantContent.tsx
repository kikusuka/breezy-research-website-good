import React from 'react';
import { Markdown } from '../ui/Markdown';
import { Icon } from '../shell/Icon';
import { parseCanvas } from '../lib/canvas';

/** Assistant reply: normal Markdown, with canvas blocks shown as a card that opens the side panel. */
export const AssistantContent: React.FC<{ content: string; activeDocId: string | null; onOpen: (docId: string) => void }> = ({ content, activeDocId, onOpen }) => {
  if (!content.includes('<breezy-canvas')) return <Markdown>{content}</Markdown>;
  return (
    <>
      {parseCanvas(content).map((seg, i) => seg.type === 'text'
        ? <Markdown key={i}>{seg.text}</Markdown>
        : (
          <button key={i} type="button" disabled={!seg.block.complete} onClick={() => onOpen(seg.block.id)}
            className={`my-space-sm flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${activeDocId === seg.block.id ? 'border-primary bg-surface-container-high' : 'border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high'}`}>
            <Icon name={seg.block.kind === 'document' ? 'description' : seg.block.kind === 'html' ? 'html' : 'code'} className="text-[22px] text-primary shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-headline-sm text-headline-sm">{seg.block.title}</span>
              <span className="block font-code-sm text-code-sm text-outline">{seg.block.complete ? `Open in Canvas · ${seg.block.kind === 'code' ? seg.block.lang || 'code' : seg.block.kind}` : 'Writing…'}</span>
            </span>
          </button>
        ))}
    </>
  );
};
