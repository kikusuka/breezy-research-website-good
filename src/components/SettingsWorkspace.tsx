import React, { useEffect, useRef, useState } from 'react';
import { providerConfigService, CanonicalWorkspaceConfig } from '../services/providerConfigService';
import { Page, Card, fieldCls } from '../ui/Page';
import { Icon } from '../shell/Icon';
import { announceConfigChange } from '../lib/useModelState';

const ENGINES = [
  ['duckduckgo', 'DuckDuckGo', 'No key needed'], ['tavily', 'Tavily', 'Key in Models'], ['serper', 'Serper', 'Key in Models'],
  ['brave', 'Brave Search', 'Key in Models'], ['google', 'Google Custom Search', 'Key in Models'], ['searxng', 'SearXNG', 'Open metasearch instance'],
] as const;
const METHODS = [
  ['adaptive', 'Adaptive', 'Let the planner choose the approach for each question.'], ['systematic', 'Systematic audit', 'Work through sources one by one, like a literature review.'],
  ['evidence-map', 'Evidence map', 'Map claims to evidence and surface contradictions.'], ['comparative', 'Comparative', 'Contrast the viewpoints of several models.'],
] as const;

export const SettingsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CanonicalWorkspaceConfig>(providerConfigService.getConfig()); const [saved, setSaved] = useState(false); const t = useRef<number | undefined>(undefined);
  useEffect(() => setConfig(providerConfigService.getConfig()), []);
  const change = (p: Partial<CanonicalWorkspaceConfig>) => { const next = { ...config, ...p }; setConfig(next); providerConfigService.saveConfig(next); announceConfigChange(); setSaved(true); window.clearTimeout(t.current); t.current = window.setTimeout(() => setSaved(false), 1800); };
  const hb = config.heartbeatIntervalSec || 30;
  return (
    <Page crumb="Settings" title="Settings" subtitle="How research runs search the web and reason. Changes save instantly on this device." narrow
      right={<span className={`flex items-center gap-1 font-code-sm text-code-sm text-tertiary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite"><Icon name="check" className="text-[16px]" />Saved</span>}>
      <Card><h2 className="font-headline-md text-headline-md">Web search</h2><p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Used by research runs to retrieve sources before and during the debate.</p>
        <div className="grid sm:grid-cols-2 gap-space-sm" role="radiogroup" aria-label="Search engine">{ENGINES.map(([id, name, note]) => { const on = (config.searchEngine || 'duckduckgo') === id; return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => change({ searchEngine: id as any })} className={`text-left rounded-2xl p-space-md min-h-[64px] transition-colors ${on ? 'bg-surface-container-high ring-1 ring-primary/50' : 'bg-surface-container-low hover:bg-surface-container-high'}`}>
            <div className="flex items-center justify-between"><span className="font-headline-sm text-headline-sm">{name}</span><span className={`w-4 h-4 rounded-circle flex items-center justify-center ${on ? 'bg-primary' : 'bg-surface-container-highest'}`}>{on && <Icon name="check" className="text-[12px] text-on-primary" />}</span></div>
            <div className="font-code-sm text-code-sm text-outline mt-0.5">{note}</div></button>); })}</div></Card>
      <Card><h2 className="font-headline-md text-headline-md">Research method</h2><p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">The default approach. You can also change it from the Research screen.</p>
        <div className="flex flex-col gap-space-xs" role="radiogroup" aria-label="Research method">{METHODS.map(([id, name, desc]) => { const on = (config.researchMethod || 'adaptive') === id; return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => change({ researchMethod: id as any })} className={`flex items-start gap-space-md text-left rounded-2xl p-space-md min-h-[56px] transition-colors ${on ? 'bg-surface-container-high ring-1 ring-primary/50' : 'bg-surface-container-low hover:bg-surface-container-high'}`}>
            <span className={`mt-1 w-4 h-4 rounded-circle shrink-0 flex items-center justify-center ${on ? 'bg-primary' : 'bg-surface-container-highest'}`}>{on && <span className="w-1.5 h-1.5 rounded-circle bg-on-primary" />}</span>
            <span><span className="font-headline-sm text-headline-sm block">{name}</span><span className="font-body-sm text-body-sm text-on-surface-variant">{desc}</span></span></button>); })}</div></Card>
      <Card><div className="flex items-start justify-between gap-space-md"><div><h2 className="font-headline-md text-headline-md">Resolve contradictions</h2><p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Let the final seat try to reconcile points where the models disagreed. Turn off to see raw disagreement.</p></div>
        <button type="button" role="switch" aria-checked={config.autoResolve ?? true} aria-label="Resolve contradictions" onClick={() => change({ autoResolve: !(config.autoResolve ?? true) })} className={`relative w-12 h-7 shrink-0 rounded-circle transition-colors ${(config.autoResolve ?? true) ? 'bg-primary' : 'bg-surface-container-highest'}`}><span className={`absolute top-1 w-5 h-5 rounded-circle bg-surface transition-all ${(config.autoResolve ?? true) ? 'left-6' : 'left-1'}`} /></button></div></Card>
      <Card><div className="flex items-center justify-between"><h2 className="font-headline-md text-headline-md">Keep-alive interval</h2><span className="font-code-md text-code-md text-primary">{hb}s</span></div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Long runs send a small ping this often so proxies do not close the connection. Lower it if runs drop out partway.</p>
        <input type="range" min={10} max={60} step={5} value={hb} aria-label="Keep-alive interval in seconds" onChange={(e) => change({ heartbeatIntervalSec: parseInt(e.target.value, 10) })} className="w-full accent-[#4cd6fb] h-8" />
        <div className="flex justify-between font-code-sm text-code-sm text-outline"><span>10s</span><span>60s</span></div></Card>
    </Page>
  );
};
