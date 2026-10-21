import React, { useEffect, useRef, useState } from 'react';
import { providerConfigService, CanonicalWorkspaceConfig, AVAILABLE_MODELS } from '../services/providerConfigService';
import { effectiveProviderService } from '../services/effectiveProviderService';
import { apiClient } from '../services/apiClient';
import { Icon } from '../shell/Icon';
import { announceConfigChange } from '../lib/useModelState';
import { PROVIDER_LABELS, providerLabel } from '../lib/providers';

type Role = 'architect' | 'skeptic' | 'verifier' | 'arbiter';
const PROVIDERS = [
  { id: 'gemini', icon: 'auto_awesome', placeholder: 'AIza…' }, { id: 'anthropic', icon: 'psychology', placeholder: 'sk-ant-…' },
  { id: 'groq', icon: 'bolt', placeholder: 'gsk_…' }, { id: 'sambanova', icon: 'memory', placeholder: 'Key' }, { id: 'openrouter', icon: 'alt_route', placeholder: 'sk-or-v1-…' },
];
const SEARCH_KEYS = [{ id: 'tavily', label: 'Tavily', placeholder: 'tvly-…' }, { id: 'serper', label: 'Serper', placeholder: 'Key' }];
const SEATS: Array<{ role: Role; label: string; seat: string; description: string }> = [
  { role: 'architect', label: 'Analyst', seat: 'Seat 1', description: 'Frames the question and drafts the first proposal.' },
  { role: 'skeptic', label: 'Critic', seat: 'Seat 2', description: 'Attacks assumptions and looks for counterexamples.' },
  { role: 'verifier', label: 'Verifier', seat: 'Seat 3 · Deep mode', description: 'Checks the claims against the retrieved sources.' },
  { role: 'arbiter', label: 'Synthesizer', seat: 'Final seat', description: 'Writes the answer-first brief from the debate.' },
];
const ALL_PROVIDERS = ['gemini', 'anthropic', 'groq', 'sambanova', 'openrouter', 'ollama', 'openai-compatible'];
const CUSTOM = '__custom__';

const PROVIDER_BRANDS: Record<string, string> = {
  gemini: 'googlegemini',
  anthropic: 'anthropic',
  groq: 'groq',
  sambanova: 'sambanova',
  openrouter: 'openrouter',
  ollama: 'ollama',
};

function ProviderBrandIcon({ provider, fallback }: { provider: string; fallback: string }) {
  const [unavailable, setUnavailable] = useState(false);
  const brand = PROVIDER_BRANDS[provider];
  if (!brand || unavailable) return <Icon name={fallback} className="text-[20px]" />;
  return <img src={`https://cdn.simpleicons.org/${brand}`} alt="" aria-hidden="true" width={22} height={22}
    className="w-[22px] h-[22px] object-contain" loading="lazy" referrerPolicy="no-referrer"
    onError={() => setUnavailable(true)} />;
}

export const VaultWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CanonicalWorkspaceConfig>(providerConfigService.getConfig());
  const [customDefaultModel, setCustomDefaultModel] = useState(() => {
    const initial = providerConfigService.getConfig();
    return Boolean(initial.defaultModel && !(AVAILABLE_MODELS[initial.defaultProvider] || []).some((model) => model.id === initial.defaultModel));
  });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<{ id: string; busy?: boolean; valid?: boolean; message?: string } | null>(null);
  const [saved, setSaved] = useState(false); const [ollamaUrl, setOllamaUrl] = useState(config.ollamaBaseUrl || 'http://localhost:11434');
  const [customOpen, setCustomOpen] = useState<Partial<Record<Role, boolean>>>({});
  const timer = useRef<number | undefined>(undefined);
  const active = effectiveProviderService.getActiveRoutableModel();
  useEffect(() => {
    const current = providerConfigService.getConfig();
    setConfig(current);
    setCustomDefaultModel(Boolean(current.defaultModel && !(AVAILABLE_MODELS[current.defaultProvider] || []).some((model) => model.id === current.defaultModel)));
    void effectiveProviderService.refreshServerHealth();
  }, []);

  const commit = (next: CanonicalWorkspaceConfig) => { setConfig(next); providerConfigService.saveConfig(next); announceConfigChange(); setSaved(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setSaved(false), 1800); };
  const setKey = (id: string, v: string) => commit({ ...config, keys: { ...config.keys, [id]: v } });
  const setSeat = (role: Role, provider: any, model: string) => commit({ ...config, roles: { ...config.roles, [role]: { provider, model } }, preset: 'custom' });
  const verify = async (id: string) => {
    const key = (config.keys as any)[id];
    if (!key && id !== 'ollama') { setTest({ id, valid: false, message: 'Enter a key first.' }); return; }
    setTest({ id, busy: true });
    try { const r = await apiClient.verifyKey(id, key || ''); setTest({ id, valid: r.valid, message: r.message || (r.valid ? 'Key verified.' : 'Key rejected or network error.') }); }
    catch (e: any) { setTest({ id, valid: false, message: e?.message || 'Verification failed.' }); }
  };

  const Result = ({ id }: { id: string }) => test?.id === id && !test.busy && test.message ? <p role="status" className={`font-code-sm text-code-sm mt-space-xs ${test.valid ? 'text-tertiary' : 'text-error'}`}>{test.message}</p> : null;
  const keyField = (id: string, placeholder: string) => {
    const v = (config.keys as any)[id] || '';
    return (
      <div>
        <div className="flex items-center gap-space-xs bg-surface-container-lowest rounded-xl hairline focus-within:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)] px-space-sm">
          <input type={show[id] ? 'text' : 'password'} value={v} onChange={(e) => setKey(id, e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} aria-label={`${id} API key`} className="flex-1 min-w-0 bg-transparent py-2.5 font-code-md text-code-md placeholder:text-outline-variant focus:outline-none" />
          <button type="button" aria-label={show[id] ? 'Hide key' : 'Show key'} onClick={() => setShow((s) => ({ ...s, [id]: !s[id] }))} className="p-1.5 rounded-lg text-outline hover:text-on-surface"><Icon name={show[id] ? 'visibility_off' : 'visibility'} className="text-[18px]" /></button>
        </div>
        <div className="flex items-center gap-space-xs mt-space-xs">
          <button type="button" onClick={() => void verify(id)} disabled={!v || test?.busy} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40 transition-colors">{test?.id === id && test.busy ? 'Testing…' : 'Test key'}</button>
          {v && <button type="button" onClick={() => setKey(id, '')} className="px-space-sm min-h-[32px] rounded-lg text-on-surface-variant hover:text-error font-label-md text-label-md transition-colors">Remove</button>}
        </div>
        <Result id={id} />
      </div>
    );
  };

  const defaultModels = AVAILABLE_MODELS[config.defaultProvider] || [];
  const statusProvider = active?.provider || config.defaultProvider;
  const activeStatusLabel = active
    ? `${providerLabel(active.provider)} · ${active.model}`
    : config.defaultProvider && config.defaultModel
      ? `${providerLabel(config.defaultProvider)} selected · not connected`
      : 'No default model selected';

  return (
    <div className="w-full max-w-5xl mx-auto px-gutter lg:px-space-lg py-space-lg lg:py-space-xl flex flex-col gap-space-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div><div className="hidden lg:block font-code-sm text-code-sm uppercase tracking-wider text-outline">Workspace / Models</div>
          <h1 className="font-headline-xl-mobile lg:font-headline-xl text-headline-xl-mobile lg:text-headline-xl tracking-tight mt-1">Models &amp; keys</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xl">Connect your own providers and decide which model sits in each seat. Nothing is assumed: an empty seat stays empty.</p></div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <span aria-live="polite" className={`flex min-w-0 max-w-[min(65vw,24rem)] items-center gap-space-sm px-space-md py-space-xs rounded-full bg-surface-container-high font-label-md text-label-md ${active ? 'text-tertiary' : 'text-on-surface-variant'}`}><span className="min-w-0 truncate">{activeStatusLabel}</span></span>
          <span className={`font-code-sm text-code-sm text-tertiary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">Saved</span>
        </div>
      </div>

      <section aria-label="First-time setup" className="rounded-3xl border border-outline-variant/50 bg-surface-container-low p-space-lg">
        <div className="flex flex-col gap-space-xs sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-headline-md text-headline-md">Set up your first model</h2><p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-2xl">A saved key is not the same as a working connection. Follow these steps once; research seats are optional until you use Synthexis.</p></div>
          <span className="shrink-0 rounded-full bg-surface-container-high px-space-sm py-1 font-code-sm text-code-sm text-on-surface-variant">{active ? 'Chat model ready' : 'Setup needed'}</span>
        </div>
        <ol className="grid sm:grid-cols-3 gap-space-sm mt-space-md">
          <li className="rounded-2xl bg-surface-container p-space-md"><div className="font-code-sm text-code-sm text-primary mb-1">01 · CONNECT</div><p className="font-body-sm text-body-sm">Add a provider key below, or configure a reachable Ollama server.</p><a href="#prov-h" className="inline-flex mt-space-sm text-secondary font-label-md text-label-md underline underline-offset-2">Provider connections</a></li>
          <li className="rounded-2xl bg-surface-container p-space-md"><div className="font-code-sm text-code-sm text-primary mb-1">02 · SELECT</div><p className="font-body-sm text-body-sm">Choose the exact provider and model used by Chat.</p><a href="#default-chat-h" className="inline-flex mt-space-sm text-secondary font-label-md text-label-md underline underline-offset-2">Default chat model</a></li>
          <li className="rounded-2xl bg-surface-container p-space-md"><div className="font-code-sm text-code-sm text-primary mb-1">03 · VERIFY</div><p className="font-body-sm text-body-sm">Use Test key or Test connection. A saved key alone does not prove it works.</p><a href="#chat" className="inline-flex mt-space-sm text-secondary font-label-md text-label-md underline underline-offset-2">Try Chat</a></li>
        </ol>
        <p className="font-body-sm text-body-sm text-outline mt-space-md">Credentials are stored in this browser, not in a Breezy server-side key vault. Avoid shared devices.</p>
      </section>

      <section aria-labelledby="default-chat-h" className="bg-surface-container rounded-3xl p-space-lg coat">
        <div className="mb-space-md">
          <h2 id="default-chat-h" className="font-headline-md text-headline-md">Default chat model</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-2xl">
            Chat uses this exact provider and model. Saving a key or assigning a research seat will not silently change your chat model.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <label htmlFor="default-chat-provider" className="font-label-md text-label-md text-on-surface-variant">Provider</label>
            <select
              id="default-chat-provider"
              value={config.defaultProvider}
              onChange={(e) => {
                setCustomDefaultModel(false);
                commit({ ...config, defaultProvider: e.target.value as CanonicalWorkspaceConfig['defaultProvider'], defaultModel: '' });
              }}
              className="w-full bg-surface-container-lowest rounded-xl hairline px-space-md min-h-[44px] font-body-sm text-body-sm focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]"
            >
              <option value="">Choose a provider</option>
              {ALL_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{providerLabel(provider)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-space-xs">
            <label htmlFor="default-chat-model" className="font-label-md text-label-md text-on-surface-variant">Model</label>
            <select
              id="default-chat-model"
              value={customDefaultModel ? CUSTOM : config.defaultModel}
              disabled={!config.defaultProvider}
              onChange={(e) => {
                if (e.target.value === CUSTOM) {
                  setCustomDefaultModel(true);
                  commit({ ...config, defaultModel: '' });
                } else {
                  setCustomDefaultModel(false);
                  commit({ ...config, defaultModel: e.target.value });
                }
              }}
              className="w-full bg-surface-container-lowest rounded-xl hairline px-space-md min-h-[44px] font-body-sm text-body-sm focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)] disabled:opacity-50"
            >
              <option value="">Choose a model</option>
              {defaultModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              <option value={CUSTOM}>Custom model ID…</option>
            </select>
          </div>
          {customDefaultModel && (
            <div className="sm:col-span-2 flex flex-col gap-space-xs">
              <label htmlFor="default-chat-custom-model" className="font-label-md text-label-md text-on-surface-variant">Exact model ID</label>
              <input
                id="default-chat-custom-model"
                value={config.defaultModel}
                onChange={(e) => commit({ ...config, defaultModel: e.target.value })}
                placeholder="Enter the exact model ID supported by this provider"
                className="w-full bg-surface-container-lowest rounded-xl hairline px-space-md min-h-[44px] font-code-md text-code-md focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]"
              />
            </div>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-outline mt-space-sm">
          {config.defaultProvider && config.defaultModel
            ? effectiveProviderService.isRoutable(config.defaultProvider)
              ? 'This selection is configured. Use Test key above to verify the connection.'
              : 'This model is selected but the provider is not connected yet.'
            : 'No default chat model is selected. Connect a provider, then choose a model here.'}
        </p>
      </section>

      <section aria-labelledby="prov-h"><div className="flex items-center justify-between mb-space-md"><h2 id="prov-h" className="font-headline-md text-headline-md">Provider connections</h2><span className="font-code-sm text-code-sm text-outline">Stored in this browser</span></div>
        <div className="grid md:grid-cols-2 gap-space-md">{PROVIDERS.map((p) => { const has = Boolean((config.keys as any)[p.id]); return (
          <div key={p.id} className="bg-surface-container rounded-3xl p-space-lg coat">
            <div className="flex items-center justify-between mb-space-md"><div className="flex items-center gap-space-sm"><span className="w-9 h-9 rounded-xl bg-surface-container-high text-primary flex items-center justify-center"><ProviderBrandIcon provider={p.id} fallback={p.icon} /></span><span className="font-headline-sm text-headline-sm">{PROVIDER_LABELS[p.id]}</span></div>
              <span className={`flex items-center gap-1.5 font-code-sm text-code-sm ${has ? 'text-tertiary' : 'text-outline'}`}><span className={`w-1.5 h-1.5 rounded-circle ${has ? 'bg-tertiary' : 'bg-outline'}`} />{has ? 'Key saved' : 'Not connected'}</span></div>
            {keyField(p.id, p.placeholder)}
          </div>); })}
          <div className="bg-surface-container rounded-3xl p-space-lg coat">
            <div className="flex items-center justify-between mb-space-md"><div className="flex items-center gap-space-sm"><span className="w-9 h-9 rounded-xl bg-surface-container-high text-primary flex items-center justify-center"><ProviderBrandIcon provider="ollama" fallback="dns" /></span><span className="font-headline-sm text-headline-sm">Local Ollama</span></div><span className="font-code-sm text-code-sm text-outline">Runs on your machine</span></div>
            <div className="flex gap-space-xs"><input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} aria-label="Ollama base URL" placeholder="http://localhost:11434" className="flex-1 min-w-0 bg-surface-container-lowest rounded-xl hairline px-space-md py-2.5 font-code-md text-code-md focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]" /></div>
            <div className="flex items-center gap-space-xs mt-space-xs"><button type="button" onClick={() => commit({ ...config, ollamaBaseUrl: ollamaUrl.trim() })} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md transition-colors">Save URL</button>
              <button type="button" onClick={() => void verify('ollama')} disabled={test?.busy} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40 transition-colors">{test?.id === 'ollama' && test.busy ? 'Testing…' : 'Test connection'}</button></div>
            <Result id="ollama" />
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">Pick an Ollama model per seat below using “Custom model”. Your browser must be able to reach the URL.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="seat-h"><div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md"><div><h2 id="seat-h" className="font-headline-md text-headline-md">Council seats</h2><p className="font-body-sm text-body-sm text-on-surface-variant">Each stage of a research run calls the model in its seat.</p></div>
        <div className="flex items-center gap-space-xs" role="group" aria-label="Presets"><span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mr-1">Presets</span>
          {(['fast', 'balanced', 'deep'] as const).map((p) => <button key={p} type="button" onClick={() => { setConfig({ ...providerConfigService.applyPreset(p) }); announceConfigChange(); }} aria-pressed={config.preset === p} className={`px-space-md min-h-[36px] rounded-xl font-label-md text-label-md capitalize transition-colors ${config.preset === p ? 'bg-surface-container-high text-primary' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'}`}>{p}</button>)}</div></div>
        <div className="grid md:grid-cols-2 gap-space-md">{SEATS.map((s) => {
          const cur = config.roles[s.role]; const inCatalog = Boolean(cur?.provider && (AVAILABLE_MODELS[cur.provider] || []).some((m) => m.id === cur.model));
          const isCustom = Boolean(cur?.model) && !inCatalog; const sel = customOpen[s.role] || isCustom ? CUSTOM : !cur?.model ? '' : `${cur.provider}::${cur.model}`;
          return (
            <div key={s.role} className="bg-surface-container rounded-3xl p-space-lg coat">
              <div className="flex items-start justify-between gap-space-sm"><div><div className="font-code-sm text-code-sm text-outline">{s.seat}</div><div className="font-headline-sm text-headline-sm">{s.label}</div></div><span className={`w-2 h-2 rounded-circle mt-2 ${cur?.model?.trim() ? 'bg-tertiary' : 'bg-outline'}`} /></div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 mb-space-md">{s.description}</p>
              <select aria-label={`${s.label} model`} value={sel} onChange={(e) => { const v = e.target.value; if (!v) { setCustomOpen((c) => ({ ...c, [s.role]: false })); setSeat(s.role, '', ''); } else if (v === CUSTOM) { setCustomOpen((c) => ({ ...c, [s.role]: true })); if (inCatalog) setSeat(s.role, cur.provider, ''); } else { setCustomOpen((c) => ({ ...c, [s.role]: false })); const [p, ...m] = v.split('::'); setSeat(s.role, p, m.join('::')); } }}
                className="w-full bg-surface-container-lowest rounded-xl hairline px-space-md min-h-[44px] font-body-sm text-body-sm focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]">
                <option value="">No model assigned</option>
                {Object.entries(AVAILABLE_MODELS).map(([prov, models]) => <optgroup key={prov} label={providerLabel(prov)}>{models.map((m) => <option key={m.id} value={`${prov}::${m.id}`}>{m.name}</option>)}</optgroup>)}
                <option value={CUSTOM}>Custom model ID…</option>
              </select>
              {sel === CUSTOM && (
                <div className="grid grid-cols-5 gap-space-xs mt-space-xs">
                  <select aria-label="Provider" value={cur?.provider || 'openrouter'} onChange={(e) => setSeat(s.role, e.target.value, cur?.model || '')} className="col-span-2 bg-surface-container-lowest rounded-xl hairline px-space-sm min-h-[44px] font-body-sm text-body-sm focus:outline-none">{ALL_PROVIDERS.map((p) => <option key={p} value={p}>{providerLabel(p)}</option>)}</select>
                  <input aria-label="Model ID" value={cur?.model || ''} onChange={(e) => setSeat(s.role, cur?.provider || 'openrouter', e.target.value)} placeholder="exact model id" className="col-span-3 bg-surface-container-lowest rounded-xl hairline px-space-sm min-h-[44px] font-code-md text-code-md focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]" />
                </div>)}
            </div>); })}</div>
        <p className="font-body-sm text-body-sm text-outline mt-space-sm">The model list is a built-in catalog and can go out of date. Use “Custom model ID” for anything newer.</p>
      </section>

      <section aria-labelledby="search-h" className="pb-space-xl"><div className="flex items-center justify-between mb-space-md"><h2 id="search-h" className="font-headline-md text-headline-md">Search keys <span className="font-body-sm text-body-sm text-outline">(optional)</span></h2></div>
        <div className="grid md:grid-cols-2 gap-space-md">{SEARCH_KEYS.map((k) => (<div key={k.id} className="bg-surface-container rounded-3xl p-space-lg coat"><div className="font-headline-sm text-headline-sm mb-space-md">{k.label}</div>{keyField(k.id, k.placeholder)}</div>))}</div>
        <p className="font-body-sm text-body-sm text-outline mt-space-sm">DuckDuckGo needs no key. Choose the search engine in Settings.</p>
      </section>
    </div>
  );
};
