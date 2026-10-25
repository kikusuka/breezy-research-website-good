import React, { useState } from 'react';
import { Icon } from '../shell/Icon';
import { Card } from '../ui/Page';
import { detectLocalAiCapability, LocalAiCapability } from '../services/localAiCapability';

export const LocalAiReadinessCard: React.FC = () => {
  const [result, setResult] = useState<LocalAiCapability | null>(null);
  const [checking, setChecking] = useState(false);

  const checkDevice = async () => {
    setChecking(true);
    try {
      setResult(await detectLocalAiCapability());
    } finally {
      setChecking(false);
    }
  };

  const statusLabel = checking
    ? 'Checking device'
    : result?.status === 'available'
      ? 'WebGPU available'
      : result?.status === 'unsupported'
        ? 'Not supported here'
        : result?.status === 'unavailable'
          ? 'Could not initialize'
          : 'Not checked';

  const statusTone = checking
    ? 'text-primary'
    : result?.status === 'available'
      ? 'text-tertiary'
      : result
        ? 'text-on-surface-variant'
        : 'text-outline';

  return (
    <Card>
      <div className="flex items-start gap-space-md">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon name="memory" className="text-[21px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h2 className="font-headline-md text-headline-md">Local AI readiness</h2>
            <span className={`font-code-sm text-code-sm ${statusTone}`} role="status" aria-live="polite">{statusLabel}</span>
          </div>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Check whether this browser can initialize WebGPU for future on-device AI features. This check does not download a model or send your prompt anywhere.
          </p>
          {result && <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">{result.message}</p>}
          {result?.status === 'available' && (
            <p className="mt-space-xs font-code-sm text-code-sm text-outline">
              This confirms GPU initialization only — not model compatibility, available memory, or expected speed. Local AI is not enabled by this check.
            </p>
          )}
          <button
            type="button"
            onClick={() => void checkDevice()}
            disabled={checking}
            className="mt-space-md inline-flex min-h-[40px] items-center justify-center gap-space-xs rounded-xl border border-outline-variant/50 px-space-md font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            <Icon name="refresh" className={`text-[17px] ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking…' : result ? 'Check again' : 'Check this device'}
          </button>
        </div>
      </div>
    </Card>
  );
};
