import { useEffect, useState } from 'react';
import { effectiveProviderService } from '../services/effectiveProviderService';
import { providerConfigService } from '../services/providerConfigService';
import { providerLabel } from './providers';

/** What Breezy can actually route to right now. Everything comes from the real services. */
export function useModelState() {
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    void effectiveProviderService.refreshServerHealth().then(refresh);
    const off = effectiveProviderService.subscribe(refresh);
    window.addEventListener('storage', refresh); window.addEventListener('breezy:config-changed', refresh);
    return () => { off(); window.removeEventListener('storage', refresh); window.removeEventListener('breezy:config-changed', refresh); };
  }, []);
  const config = providerConfigService.getConfig();
  const active = effectiveProviderService.getActiveRoutableModel();
  return {
    serverGemini: effectiveProviderService.isServerGeminiConfigured(), active, routable: Boolean(active),
    label: active ? active.model : '', providerLabel: active ? providerLabel(active.provider) : 'No model connected',
    config, searchEngine: config.searchEngine || 'duckduckgo', refresh,
  };
}
export const announceConfigChange = () => window.dispatchEvent(new Event('breezy:config-changed'));
