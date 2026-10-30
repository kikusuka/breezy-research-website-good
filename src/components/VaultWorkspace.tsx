import React, { useEffect, useRef, useState } from 'react';
import { providerConfigService, CanonicalWorkspaceConfig, AVAILABLE_MODELS } from '../services/providerConfigService';
import { effectiveProviderService } from '../services/effectiveProviderService';
import { apiClient } from '../services/apiClient';
import { Icon } from '../shell/Icon';
import { announceConfigChange } from '../lib/useModelState';
import { PROVIDER_LABELS, providerLabel } from '../lib/providers';
import { listLocalModels, testLocalModelEndpoint, testLocalModelGeneration } from '../services/localModelService';

type Role = 'architect';
const PROVIDERS = [
  { id: 'gemini', placeholder: 'AIza…' }, { id: 'anthropic', placeholder: 'sk-ant-…' },
  { id: 'groq', placeholder: 'gsk_…' }, { id: 'sambanova', placeholder: 'Key' }, { id: 'openrouter', placeholder: 'sk-or-v1-…' },
];
const SEARCH_KEYS = [{ id: 'tavily', label: 'Tavily', placeholder: 'tvly-…' }, { id: 'serper', label: 'Serper', placeholder: 'Key' }];
const ALL_PROVIDERS = ['gemini', 'anthropic', 'groq', 'sambanova', 'openrouter', 'ollama', 'openai-compatible'];
const CUSTOM = '__custom__';

type LocalModelProvider = 'ollama' | 'openai-compatible';
type LocalModelTestResult = { busy?: boolean; valid?: boolean; message?: string };
function LocalModelList({ id, baseUrl, catalog, tests, onTest, onUse }: {
  id: LocalModelProvider;
  baseUrl: string;
  catalog?: { baseUrl: string; models: string[] };
  tests: Record<string, LocalModelTestResult>;
  onTest: (provider: LocalModelProvider, model: string) => void;
  onUse: (provider: LocalModelProvider, model: string) => void;
}) {
  // Keep this component at module scope so parent state updates do not remount
  // the list, drop keyboard focus, or reset any in-progress interaction.
  if (!catalog || catalog.baseUrl !== baseUrl || !catalog.models.length) return null;
  return <div className="mt-space-sm rounded-xl bg-surface-container-low p-space-sm">
    <p className="font-label-md text-label-md text-on-surface-variant mb-space-xs">Models reported by this server</p>
    <div className="flex flex-col gap-space-xs">
      {catalog.models.map((model) => {
        const result = tests[id + ':' + model];
        return <div key={model} className="rounded-lg bg-surface-container px-space-sm py-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
            <code className="min-w-0 break-all font-code-sm text-code-sm">{model}</code>
            <div className="flex flex-wrap gap-space-xs shrink-0">
              <button type="button" onClick={() => onTest(id, model)} disabled={Boolean(result?.busy)} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40">{result?.busy ? 'Testing…' : 'Test generation'}</button>
              <button type="button" onClick={() => onUse(id, model)} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md">Use in Chat</button>
            </div>
          </div>
          {result?.message && <p role="status" className={`mt-space-xs font-body-sm text-body-sm break-words ${result.valid ? 'text-tertiary' : 'text-error'}`}>{result.message}</p>}
        </div>;
      })}
    </div>
  </div>;
}

export const VaultWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CanonicalWorkspaceConfig>(providerConfigService.getConfig());
  const [customDefaultModel, setCustomDefaultModel] = useState(() => {
    const initial = providerConfigService.getConfig();
    return Boolean(initial.defaultModel && !(AVAILABLE_MODELS[initial.defaultProvider] || []).some((model) => model.id === initial.defaultModel));
  });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<{ id: string; busy?: boolean; valid?: boolean; message?: string } | null>(null);
  const [localModels, setLocalModels] = useState<Record<string, { baseUrl: string; models: string[] }>>({});
  const [listingModels, setListingModels] = useState<string | null>(null);
  const [localModelTests, setLocalModelTests] = useState<Record<string, { busy?: boolean; valid?: boolean; message?: string }>>({});
  const [saved, setSaved] = useState(false); const [ollamaUrl, setOllamaUrl] = useState(config.ollamaBaseUrl || 'http://localhost:11434'); const [openaiCompatibleUrl, setOpenaiCompatibleUrl] = useState(config.openaiCompatibleBaseUrl || '');
  const [customOpen, setCustomOpen] = useState<Partial<Record<Role, boolean>>>({});
  const timer = useRef<number | undefined>(undefined);
  const active = effectiveProviderService.getActiveRoutableModel();
  useEffect(() => {
    const current = providerConfigService.getConfig();
    setConfig(current);
    setOllamaUrl(current.ollamaBaseUrl || 'http://localhost:11434');
    setOpenaiCompatibleUrl(current.openaiCompatibleBaseUrl || '');
    setCustomDefaultModel(Boolean(current.defaultModel && !(AVAILABLE_MODELS[current.defaultProvider] || []).some((model) => model.id === current.defaultModel)));
    void effectiveProviderService.refreshServerHealth();
  }, []);

  const commit = (next: CanonicalWorkspaceConfig) => { setConfig(next); providerConfigService.saveConfig(next); announceConfigChange(); setSaved(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setSaved(false), 1800); };
  const setKey = (id: string, v: string) => commit({ ...config, keys: { ...config.keys, [id]: v } });
  const setSeat = (role: Role, provider: any, model: string) => commit({ ...config, roles: { ...config.roles, [role]: { provider, model } }, preset: 'custom' });
  const verify = async (id: string) => {
    if (id === 'ollama' || id === 'openai-compatible') {
      const baseUrl = id === 'ollama' ? ollamaUrl : openaiCompatibleUrl;
      setTest({ id, busy: true });
      try {
        const message = await testLocalModelEndpoint(id, baseUrl, (config.keys as any)[id] || '');
        setTest({ id, valid: true, message });
      } catch (e: any) {
        setTest({ id, valid: false, message: e?.message || 'Could not reach the local endpoint.' });
      }
      return;
    }
    const key = (config.keys as any)[id];
    if (!key) { setTest({ id, valid: false, message: 'Enter a key first.' }); return; }
    setTest({ id, busy: true });
    try { const r = await apiClient.verifyKey(id, key || ''); setTest({ id, valid: r.valid, message: r.message || (r.valid ? 'Key verified.' : 'Key rejected or network error.') }); }
    catch (e: any) { setTest({ id, valid: false, message: e?.message || 'Verification failed.' }); }
  };

  const discoverModels = async (id: 'ollama' | 'openai-compatible') => {
    const baseUrl = id === 'ollama' ? ollamaUrl : openaiCompatibleUrl;
    setListingModels(id);
    setTest({ id, busy: true });
    try {
      const models = await listLocalModels(id, baseUrl, (config.keys as any)[id] || '');
      setLocalModels((current) => ({ ...current, [id]: { baseUrl: baseUrl.trim(), models } }));
      setTest({ id, valid: true, message: models.length ? 'Found ' + models.length + ' model ID(s) from this browser.' : 'The endpoint is reachable, but it reports no installed models.' });
    } catch (e: any) {
      setTest({ id, valid: false, message: e?.message || 'Could not list models from this endpoint.' });
    } finally {
      setListingModels(null);
    }
  };

  const testLocalModel = async (provider: 'ollama' | 'openai-compatible', model: string) => {
    const key = provider + ':' + model;
    const baseUrl = provider === 'ollama' ? ollamaUrl : openaiCompatibleUrl;
    setLocalModelTests((current) => ({ ...current, [key]: { busy: true } }));
    try {
      const reply = await testLocalModelGeneration({ provider, baseUrl, model, apiKey: (config.keys as any)[provider] || '' });
      const compactReply = reply.replace(/\s+/g, ' ').trim();
      setLocalModelTests((current) => ({ ...current, [key]: { valid: true, message: 'Generation works. Reply: ' + compactReply.slice(0, 140) + (compactReply.length > 140 ? '…' : '') } }));
    } catch (error: any) {
      setLocalModelTests((current) => ({ ...current, [key]: { valid: false, message: error?.message || 'Generation test failed.' } }));
    }
  };

  const useLocalModel = (provider: 'ollama' | 'openai-compatible', model: string) => {
    // Persist the exact endpoint used for discovery along with the selected model.
    // Otherwise an unsaved URL edit could discover a model but Chat would call the old URL.
    const next = {
      ...config,
      defaultProvider: provider,
      defaultModel: model,
      ollamaBaseUrl: provider === 'ollama' ? ollamaUrl.trim() : config.ollamaBaseUrl,
      openaiCompatibleBaseUrl: provider === 'openai-compatible' ? openaiCompatibleUrl.trim() : config.openaiCompatibleBaseUrl,
    };
    commit(next);
    setCustomDefaultModel(true);
    setTest({ id: provider, valid: true, message: 'Selected ' + model + ' as the default Chat model.' });
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
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xl">Connect your own providers and choose one research model. Chat has its own separate model selection.</p></div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <span aria-live="polite" className={`flex min-w-0 max-w-[min(65vw,24rem)] items-center gap-space-sm px-space-md py-space-xs rounded-full bg-surface-container-high font-label-md text-label-md ${active ? 'text-tertiary' : 'text-on-surface-variant'}`}><span className="min-w-0 truncate">{activeStatusLabel}</span></span>
          <span className={`font-code-sm text-code-sm text-tertiary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">Saved</span>
        </div>
      </div>

      <section aria-label="First-time setup" className="rounded-3xl border border-outline-variant/50 bg-surface-container-low p-space-lg">
        <div className="flex flex-col gap-space-xs sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-headline-md text-headline-md">Set up your first model</h2><p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-2xl">A saved key is not the same as a working connection. Follow these steps once to configure the model you want to use.</p></div>
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
            <div className="flex items-center justify-between mb-space-md"><div className="flex items-center gap-space-sm"><span className="font-headline-sm text-headline-sm">{PROVIDER_LABELS[p.id]}</span></div>
              <span className={`flex items-center gap-1.5 font-code-sm text-code-sm ${has ? 'text-tertiary' : 'text-outline'}`}><span className={`w-1.5 h-1.5 rounded-circle ${has ? 'bg-tertiary' : 'bg-outline'}`} />{has ? 'Key saved' : 'Not connected'}</span></div>
            {keyField(p.id, p.placeholder)}
          </div>); })}
          <div className="bg-surface-container rounded-3xl p-space-lg coat">
            <div className="flex items-center justify-between mb-space-md"><div className="flex items-center gap-space-sm"><span className="font-headline-sm text-headline-sm">Local Ollama</span></div><span className="font-code-sm text-code-sm text-outline">Runs on your machine</span></div>
            <div className="flex gap-space-xs"><input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} aria-label="Ollama base URL" placeholder="http://localhost:11434" className="flex-1 min-w-0 bg-surface-container-lowest rounded-xl hairline px-space-md py-2.5 font-code-md text-code-md focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]" /></div>
            <div className="flex items-center gap-space-xs mt-space-xs"><button type="button" onClick={() => commit({ ...config, ollamaBaseUrl: ollamaUrl.trim() })} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md transition-colors">Save URL</button>
              <button type="button" onClick={() => void verify('ollama')} disabled={test?.busy} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40 transition-colors">{test?.id === 'ollama' && test.busy ? 'Testing…' : 'Test connection'}</button></div>
            <Result id="ollama" />
            <button type="button" onClick={() => void discoverModels('ollama')} disabled={Boolean(listingModels)} className="mt-space-xs px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40">{listingModels === 'ollama' ? 'Loading models…' : 'Discover installed models'}</button>
            <LocalModelList id="ollama" baseUrl={ollamaUrl.trim()} catalog={localModels.ollama} tests={localModelTests} onTest={testLocalModel} onUse={useLocalModel} />
            <p className="font-body-sm text-body-sm text-outline mt-space-sm">Test generation sends one short greeting directly to the selected model; it may load the model and use your device’s CPU, GPU, memory, or battery.</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">Chat can call this URL directly from your browser. Choose Ollama and enter the exact model ID under Default chat model. The hosted Research backend cannot reach a device-local URL, so use a server-reachable model for Research for now.</p>
          </div>
          <div className="bg-surface-container rounded-3xl p-space-lg coat">
            <div className="flex items-center justify-between mb-space-md gap-space-sm"><div className="font-headline-sm text-headline-sm">Custom OpenAI-compatible server</div><span className="font-code-sm text-code-sm text-outline">Local or self-hosted</span></div>
            <label htmlFor="openai-compatible-url" className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Base URL (include /v1 when required)</label>
            <input id="openai-compatible-url" type="url" value={openaiCompatibleUrl} onChange={(e) => setOpenaiCompatibleUrl(e.target.value)} aria-label="OpenAI-compatible server base URL" placeholder="http://127.0.0.1:1234/v1" className="w-full min-w-0 bg-surface-container-lowest rounded-xl hairline px-space-md py-2.5 font-code-md text-code-md focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]" />
            <div className="flex flex-wrap gap-space-xs mt-space-xs">
              <button type="button" onClick={() => commit({ ...config, openaiCompatibleBaseUrl: openaiCompatibleUrl.trim() })} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md transition-colors">Save URL</button>
              <button type="button" onClick={() => void verify('openai-compatible')} disabled={test?.busy || !openaiCompatibleUrl.trim()} className="px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40 transition-colors">{test?.id === 'openai-compatible' && test.busy ? 'Testing…' : 'Test connection'}</button>
            </div>
            {keyField('openai-compatible', 'Optional bearer token')}
            <Result id="openai-compatible" />
            <button type="button" onClick={() => void discoverModels('openai-compatible')} disabled={Boolean(listingModels) || !openaiCompatibleUrl.trim()} className="mt-space-xs px-space-sm min-h-[32px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md disabled:opacity-40">{listingModels === 'openai-compatible' ? 'Loading models…' : 'Discover available models'}</button>
            <LocalModelList id="openai-compatible" baseUrl={openaiCompatibleUrl.trim()} catalog={localModels['openai-compatible']} tests={localModelTests} onTest={testLocalModel} onUse={useLocalModel} />
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">Chat sends requests from this browser directly to this endpoint; Breezy does not proxy local URLs. Research still uses the configured Research model through the hosted backend and cannot use this device-local endpoint yet. The server must allow CORS requests from Breezy. If the server app and Breezy browser are on the same phone, try that phone’s loopback address (127.0.0.1) and the server port. If Breezy runs on another device, use the server-hosting device’s LAN IP and port; both devices must be on the same network.</p>
            <p className="font-body-sm text-body-sm text-outline mt-space-xs">HTTPS pages may be blocked from calling some HTTP endpoints by browser security rules. A successful connection test checks the models endpoint only; it does not guarantee generation works.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="research-model-h">
        <div className="mb-space-md">
          <h2 id="research-model-h" className="font-headline-md text-headline-md">Research model</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-2xl">Every investigation uses this one model for answer generation. Breezy does not run separate critic, verifier, or synthesizer calls. Source search and page retrieval still run when enabled.</p>
        </div>
        <div className="bg-surface-container rounded-3xl p-space-lg coat">
          <label htmlFor="research-model-select" className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Provider and model</label>
          {(() => {
            const cur = config.roles?.architect || { provider: '', model: '' };
            const inCatalog = Boolean(cur?.provider && (AVAILABLE_MODELS[cur.provider] || []).some((m) => m.id === cur.model));
            const isCustom = Boolean(cur?.model) && !inCatalog;
            const sel = customOpen.architect || isCustom ? CUSTOM : !cur?.model ? '' : `${cur.provider}::${cur.model}`;
            return <>
              <select id="research-model-select" aria-label="Research model" value={sel} onChange={(e) => {
                const v = e.target.value;
                if (!v) { setCustomOpen((state) => ({ ...state, architect: false })); setSeat('architect', '', ''); }
                else if (v === CUSTOM) { setCustomOpen((state) => ({ ...state, architect: true })); if (inCatalog) setSeat('architect', cur.provider, ''); }
                else { setCustomOpen((state) => ({ ...state, architect: false })); const [provider, ...modelParts] = v.split('::'); setSeat('architect', provider, modelParts.join('::')); }
              }} className="w-full bg-surface-container-lowest rounded-xl hairline px-space-md min-h-[44px] font-body-sm text-body-sm focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]">
                <option value="">No model assigned</option>
                {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => <optgroup key={provider} label={providerLabel(provider)}>{models.map((model) => <option key={model.id} value={`${provider}::${model.id}`}>{model.name}</option>)}</optgroup>)}
                <option value={CUSTOM}>Custom model ID…</option>
              </select>
              {(customOpen.architect || isCustom) && <div className="grid grid-cols-5 gap-space-xs mt-space-xs">
                <select aria-label="Research provider" value={cur?.provider || 'openrouter'} onChange={(e) => setSeat('architect', e.target.value, cur?.model || '')} className="col-span-2 bg-surface-container-lowest rounded-xl hairline px-space-sm min-h-[44px] font-body-sm text-body-sm focus:outline-none">{ALL_PROVIDERS.map((provider) => <option key={provider} value={provider}>{providerLabel(provider)}</option>)}</select>
                <input aria-label="Research model ID" value={cur?.model || ''} onChange={(e) => setSeat('architect', cur?.provider || 'openrouter', e.target.value)} placeholder="exact model id" className="col-span-3 bg-surface-container-lowest rounded-xl hairline px-space-sm min-h-[44px] font-code-md text-code-md focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]" />
              </div>}
              <p className="font-body-sm text-body-sm text-outline mt-space-sm">{cur?.provider && cur?.model ? `Selected: ${providerLabel(cur.provider)} · ${cur.model}` : 'No research model selected. Choose a model and connect its provider above.'}</p>
            </>;
          })()}
        </div>
        <p className="font-body-sm text-body-sm text-outline mt-space-sm">The model catalog can go out of date. Use “Custom model ID” for newer models. Previous critic, verifier, and synthesizer assignments are no longer used by research.</p>
      </section>

      <section aria-labelledby="search-h" className="pb-space-xl"><div className="flex items-center justify-between mb-space-md"><h2 id="search-h" className="font-headline-md text-headline-md">Search keys <span className="font-body-sm text-body-sm text-outline">(optional)</span></h2></div>
        <div className="grid md:grid-cols-2 gap-space-md">{SEARCH_KEYS.map((k) => (<div key={k.id} className="bg-surface-container rounded-3xl p-space-lg coat"><div className="font-headline-sm text-headline-sm mb-space-md">{k.label}</div>{keyField(k.id, k.placeholder)}</div>))}</div>
        <p className="font-body-sm text-body-sm text-outline mt-space-sm">DuckDuckGo needs no key. Choose the search engine in Settings.</p>
      </section>
    </div>
  );
};
