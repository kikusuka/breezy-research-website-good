import React, { useState } from 'react';
import { Card } from '../ui/Page';
import { Icon } from '../shell/Icon';
import { THEMES, ThemePref, getThemePref, setThemePref } from '../lib/theme';

export const AppearanceSettings: React.FC = () => {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const choose = (next: ThemePref) => { setThemePref(next); setPref(next); };
  const base = 'text-left rounded-2xl p-space-md min-h-[64px] transition-colors border';
  const on = 'border-primary bg-surface-container-high';
  const off = 'border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high';
  return (
    <Card>
      <h2 className="font-headline-md text-headline-md">Appearance</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Applies to this device and browser. Ocean is the default.</p>
      <div className="grid sm:grid-cols-2 gap-space-sm" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={pref === t.id} onClick={() => choose(t.id)} className={`${base} ${pref === t.id ? on : off}`}>
            <div className="flex items-center gap-space-sm">
              <span aria-hidden="true" className="flex h-9 w-14 shrink-0 overflow-hidden rounded-lg border border-outline-variant/50" style={{ background: t.bg }}>
                <span className="m-1 flex-1 rounded-md" style={{ background: t.surface }} />
                <span className="my-1 mr-1 w-3 rounded-md" style={{ background: t.accent }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-headline-sm text-headline-sm">{t.label}</span>
                <span className="block font-code-sm text-code-sm text-outline">{t.note}</span>
              </span>
              {pref === t.id && <Icon name="check_circle" fill className="text-[20px] text-primary" />}
            </div>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={pref === 'system'} onClick={() => choose('system')} className={`${base} sm:col-span-2 ${pref === 'system' ? on : off}`}>
          <div className="flex items-center gap-space-sm">
            <Icon name="brightness_auto" className="text-[22px] text-on-surface-variant" />
            <span className="min-w-0 flex-1">
              <span className="block font-headline-sm text-headline-sm">Match system</span>
              <span className="block font-code-sm text-code-sm text-outline">Ocean when your device is dark, Paper when it is light.</span>
            </span>
            {pref === 'system' && <Icon name="check_circle" fill className="text-[20px] text-primary" />}
          </div>
        </button>
      </div>
    </Card>
  );
};
