/**
 * Unified Breezy API Client with Intelligent Edge Backend Failover & Primary Recovery
 * 
 * Order of Preference:
 * 1. Cloudflare Worker (Primary Edge)
 * 2. Deno Deploy (Secondary Backup)
 * 3. Render / Node Server (Emergency Fallback)
 * 
 * Resilience Features:
 * - Bounded retries (failover only on network disconnect, 502, 503, 504 before body transfer)
 * - Automatic primary backend recovery: probes Cloudflare after cooldown when on backup
 * - Never duplicates active SSE streams once data transfer has begun
 * - 30-second TTL health check caching to eliminate request storms
 */

export interface BackendEndpoint {
  id: 'cloudflare' | 'deno' | 'render' | 'local';
  name: string;
  url: string;
  tierInfo: string;
}

export interface BackendState {
  activeId: 'cloudflare' | 'deno' | 'render' | 'local';
  activeName: string;
  isOnline: boolean;
  isPrimary: boolean;
  lastChecked: number;
  failoverReason?: string;
}

type BackendListener = (state: BackendState) => void;

class ApiClient {
  private endpoints: BackendEndpoint[];
  private currentEndpointIndex: number = 0;
  private listeners: Set<BackendListener> = new Set();
  private healthCache: Map<string, { ok: boolean; timestamp: number }> = new Map();
  private isCheckingHealth = false;
  private lastFailoverTimestamp: number = 0;
  private primaryRecoveryCooldownMs: number = 180000; // 3 minutes cooldown before probing primary
  private lastCheckedHealthOk: boolean = true;

  constructor() {
    const primaryUrl = import.meta.env.VITE_PRIMARY_API_URL?.replace(/\/$/, '') || '';
    const secondaryUrl = import.meta.env.VITE_SECONDARY_API_URL?.replace(/\/$/, '') || '';
    const fallbackUrl = import.meta.env.VITE_FALLBACK_API_URL?.replace(/\/$/, '') || '';

    this.endpoints = [
      {
        id: 'cloudflare',
        name: 'Cloudflare Worker',
        url: primaryUrl, // empty string means same-origin relative '/api/...'
        tierInfo: 'Primary edge backend',
      },
      ...(secondaryUrl
        ? [
            {
              id: 'deno' as const,
              name: 'Deno Deploy',
              url: secondaryUrl,
              tierInfo: 'Secondary backup backend',
            },
          ]
        : []),
      ...(fallbackUrl
        ? [
            {
              id: 'render' as const,
              name: 'Render Node',
              url: fallbackUrl,
              tierInfo: 'Emergency fallback backend',
            },
          ]
        : []),
      ...(primaryUrl && !fallbackUrl
        ? [
            {
              id: 'local' as const,
              name: 'Same-Origin Server',
              url: '',
              tierInfo: 'Direct Relative Route',
            },
          ]
        : []),
    ];
  }

  public getEndpoints(): BackendEndpoint[] {
    return [...this.endpoints];
  }

  public getActiveEndpoint(): BackendEndpoint {
    return this.endpoints[this.currentEndpointIndex] || this.endpoints[0];
  }

  public subscribe(listener: BackendListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(reason?: string) {
    const state = this.getState(reason);
    this.listeners.forEach((fn) => fn(state));
  }

  public getState(reason?: string): BackendState {
    const active = this.getActiveEndpoint();
    return {
      activeId: active.id,
      activeName: active.name,
      isOnline: this.lastCheckedHealthOk,
      isPrimary: this.currentEndpointIndex === 0,
      lastChecked: Date.now(),
      failoverReason: reason,
    };
  }

  public setEndpointManually(id: 'cloudflare' | 'deno' | 'render' | 'local') {
    const idx = this.endpoints.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.currentEndpointIndex = idx;
      this.notify('Manual selection');
    }
  }

  /**
   * Probes the primary backend if we are currently on a backup and cooldown expired
   */
  public async probePrimaryRecovery(): Promise<boolean> {
    if (this.currentEndpointIndex === 0) return true;
    const now = Date.now();
    if (now - this.lastFailoverTimestamp < this.primaryRecoveryCooldownMs) {
      return false;
    }

    const primary = this.endpoints[0];
    try {
      const res = await fetch(`${primary.url}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        this.currentEndpointIndex = 0;
        this.notify('Primary edge backend recovered.');
        return true;
      }
    } catch {
      // Primary still offline; reset failover timer for another cooldown period
      this.lastFailoverTimestamp = now;
    }
    return false;
  }

  /**
   * Health check with 30-second TTL cache to prevent request storms
   */
  public async getHealth(force: boolean = false): Promise<any> {
    const endpoint = this.getActiveEndpoint();
    const now = Date.now();

    try {
      const url = `${endpoint.url}/api/health`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      this.lastCheckedHealthOk = true;
      this.notify('Active connection healthy');
      return data;
    } catch (e) {
      this.lastCheckedHealthOk = false;
      this.notify('Backend unreachable');
      return { ok: false };
    }
  }

  /**
   * Health check with 30-second TTL cache to prevent request storms
   */
  public async checkHealth(force: boolean = false): Promise<boolean> {
    // Opportunistically check if primary has recovered
    if (this.currentEndpointIndex !== 0) {
      this.probePrimaryRecovery().catch(() => {});
    }

    const endpoint = this.getActiveEndpoint();
    const cached = this.healthCache.get(endpoint.id);
    const now = Date.now();

    if (!force && cached && now - cached.timestamp < 30000) {
      return cached.ok;
    }

    if (this.isCheckingHealth) return cached?.ok ?? true;
    this.isCheckingHealth = true;

    try {
      const url = `${endpoint.url}/api/health`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const ok = res.ok;
      this.lastCheckedHealthOk = ok;
      this.healthCache.set(endpoint.id, { ok, timestamp: now });
      this.notify(ok ? 'Active connection healthy' : 'Backend health check failed');
      return ok;
    } catch (e) {
      this.lastCheckedHealthOk = false;
      this.healthCache.set(endpoint.id, { ok: false, timestamp: now });
      this.notify('Backend unreachable');
      return false;
    } finally {
      this.isCheckingHealth = false;
    }
  }

  /**
   * Execute fetch with automatic, bounded backend failover
   */
  private async fetchWithFailover(
    path: string,
    options: RequestInit = {},
    onFailoverNotice?: (msg: string) => void
  ): Promise<Response> {
    // Non-blocking opportunistic check for primary recovery
    if (this.currentEndpointIndex !== 0) {
      this.probePrimaryRecovery().catch(() => {});
    }

    const attempts = this.endpoints.length;
    let lastError: any = null;

    for (let i = 0; i < attempts; i++) {
      const endpointIndex = (this.currentEndpointIndex + i) % this.endpoints.length;
      const endpoint = this.endpoints[endpointIndex];
      const targetUrl = `${endpoint.url}${path}`;

      try {
        const response = await fetch(targetUrl, {
          ...options,
          headers: {
            ...options.headers,
            'X-Breezy-Client': 'web-spa',
          },
        });

        // 502 / 503 / 504 are candidate errors for backend failover
        if ((response.status === 502 || response.status === 503 || response.status === 504) && i < attempts - 1) {
          console.warn(`Endpoint ${endpoint.name} returned status ${response.status}. Attempting backup backend...`);
          this.lastFailoverTimestamp = Date.now();
          if (onFailoverNotice) {
            onFailoverNotice(`Primary service temporarily busy (${response.status}). Switching to backup service...`);
          }
          continue;
        }

        // If this endpoint succeeded and was a failover, update active index
        if (endpointIndex !== this.currentEndpointIndex && response.ok) {
          this.currentEndpointIndex = endpointIndex;
          this.lastFailoverTimestamp = Date.now();
          this.lastCheckedHealthOk = true;
          this.notify(`Switched to ${endpoint.name}`);
          if (onFailoverNotice) {
            onFailoverNotice(`Connected to backup service (${endpoint.name}).`);
          }
        } else if (response.ok && !this.lastCheckedHealthOk) {
          this.lastCheckedHealthOk = true;
          this.notify('Connection recovered');
        }

        return response;
      } catch (err: any) {
        lastError = err;
        this.lastFailoverTimestamp = Date.now();
        console.warn(`Network failure on ${endpoint.name}: ${err.message}. Checking next backend...`);
        if (i < attempts - 1 && onFailoverNotice) {
          onFailoverNotice(`Primary service unavailable. Connecting to backup service...`);
        }
      }
    }

    this.lastCheckedHealthOk = false;
    this.notify('All backends unreachable');

    let parsedMsg = lastError?.message || 'All API backends are currently unreachable.';
    if (parsedMsg.includes('429') || parsedMsg.includes('RESOURCE_EXHAUSTED') || parsedMsg.includes('quota')) {
      parsedMsg = '⚠️ Provider Rate Limit or Token Quota Reached (429). Please configure your personal API key in Settings (BYOK) or choose another connected provider.';
    }

    throw new Error(parsedMsg);
  }

  /**
   * Debate & Multi-Model Research SSE Stream
   */
  public async streamDebate(
    payload: any,
    options: {
      onEvent: (event: any) => void;
      signal?: AbortSignal;
      onNotice?: (msg: string) => void;
    }
  ): Promise<void> {
    const res = await this.fetchWithFailover(
      '/api/debate/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options.signal,
      },
      options.onNotice
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let cleanMsg = errText || `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        cleanMsg = parsed.error || parsed.message || cleanMsg;
      } catch {}

      if (res.status === 429 || cleanMsg.includes('429') || cleanMsg.includes('RESOURCE_EXHAUSTED') || cleanMsg.includes('quota')) {
        cleanMsg = '⚠️ Model rate limit or quota exceeded (429). Please switch to a connected BYOK key in Settings or choose another provider.';
      }

      throw new Error(`Research API Error: ${cleanMsg}`);
    }

    if (!res.body) {
      throw new Error('No response body stream received from backend.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          options.onEvent(json);
        } catch {
          // Skip incomplete json chunk
        }
      }
    }
  }

  /**
   * Conversational Chat with Breezy
   */
  public async chatBreezy(
    payload: {
      prompt: string;
      history?: any[];
      provider?: string;
      model?: string;
      apiKey?: string;
    },
    options?: { signal?: AbortSignal; onNotice?: (msg: string) => void }
  ): Promise<{ text: string }> {
    const res = await this.fetchWithFailover(
      '/api/breezy/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options?.signal,
      },
      options?.onNotice
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      let msg = errData.error || `Server responded with status ${res.status}`;
      if (res.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        msg = '⚠️ Provider quota or rate limit exceeded (429). Please configure your personal API key in Settings (BYOK) or switch models.';
      }
      throw new Error(msg);
    }

    return await res.json();
  }

  /**
   * Executive summary generation
   */
  public async summarizeDebate(payload: { session: any; providerKeyConfig?: any }): Promise<{ summary: string; category: string }> {
    const res = await this.fetchWithFailover('/api/debate/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to summarize session (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Verify provider key
   */
  public async verifyKey(provider: string, apiKey: string): Promise<{ valid: boolean; latencyMs?: number; message?: string; error?: string }> {
    const res = await this.fetchWithFailover('/api/vault/verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });

    return await res.json();
  }

  public async verifyVaultKey(provider: string, apiKey: string): Promise<{ valid: boolean; latencyMs?: number; message?: string; error?: string }> {
    return this.verifyKey(provider, apiKey);
  }
}

export const apiClient = new ApiClient();
