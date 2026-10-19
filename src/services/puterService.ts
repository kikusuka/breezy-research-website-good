/**
 * Browser-only Puter.js integration.
 *
 * Puter runs with the user's own Puter session and usage allowance. Breezy does
 * not receive or store a Puter API key. Model IDs come from Puter's live catalog;
 * never assume a hard-coded model is available.
 */

declare global {
  interface Window {
    puter?: any;
  }
}

export interface PuterModel {
  id: string;
  provider?: string;
  name?: string;
}

export interface PuterChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

let loadPromise: Promise<any> | null = null;

async function loadPuter(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('Puter.js is only available in the browser.');
  if (window.puter) return window.puter;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-breezy-puter]') as HTMLScriptElement | null;
    const onLoad = () => {
      if (window.puter) resolve(window.puter);
      else reject(new Error('Puter.js loaded without exposing its API.'));
    };
    const onError = () => reject(new Error('Could not load Puter.js.'));

    if (existing) {
      if (existing.dataset.loaded === 'true') {
        onLoad();
        return;
      }
      existing.addEventListener('load', () => { existing.dataset.loaded = 'true'; onLoad(); }, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.dataset.breezyPuter = '1';
    script.onload = () => { script.dataset.loaded = 'true'; onLoad(); };
    script.onerror = onError;
    document.head.appendChild(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export const puterService = {
  async ensureLoaded(): Promise<any> {
    return loadPuter();
  },

  async isSignedIn(): Promise<boolean> {
    try {
      const puter = await loadPuter();
      return Boolean(puter?.auth?.isSignedIn?.());
    } catch {
      return false;
    }
  },

  async signIn(): Promise<void> {
    // Do not await script loading here: the sign-in popup must be opened from
    // the original user gesture. The UI loads Puter before enabling this action.
    const puter = typeof window !== 'undefined' ? window.puter : undefined;
    if (!puter) throw new Error('Puter.js is not loaded yet. Retry after the connection panel finishes loading.');
    if (puter.auth?.isSignedIn?.()) return;
    if (!puter.auth?.signIn) throw new Error('Puter authentication is unavailable.');
    await puter.auth.signIn();
  },

  async signOut(): Promise<void> {
    const puter = await loadPuter();
    if (!puter.auth?.signOut) throw new Error('Puter sign-out is unavailable.');
    await puter.auth.signOut();
  },

  async listModels(): Promise<PuterModel[]> {
    const puter = await loadPuter();
    if (typeof puter?.ai?.listModels !== 'function') {
      throw new Error('This Puter.js version does not expose the live model catalog.');
    }
    const result = await puter.ai.listModels();
    if (!Array.isArray(result)) throw new Error('Puter returned an invalid model catalog.');
    return result
      .filter((model: any) => typeof model?.id === 'string' && model.id.trim())
      .map((model: any) => ({
        id: model.id,
        provider: typeof model.provider === 'string' ? model.provider : undefined,
        name: typeof model.name === 'string' ? model.name : undefined,
      }));
  },

  async chat(
    prompt: string,
    options: {
      model: string;
      system?: string;
      history?: PuterChatMessage[];
      signal?: AbortSignal;
    },
  ): Promise<string> {
    const puter = await loadPuter();
    if (!puter.auth?.isSignedIn?.()) throw new Error('Connect your Puter account before using Puter AI.');
    if (!options?.model?.trim()) throw new Error('Choose a model from Puter’s live model list first.');

    const messages: PuterChatMessage[] = [
      ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
      ...(options.history || []).slice(-20),
      { role: 'user', content: prompt },
    ];
    // For message arrays, Puter.js takes testMode as the second argument and
    // options as the third. Passing an object as argument two is incorrect.
    const response = await puter.ai.chat(messages, false, {
      model: options.model,
      signal: options.signal,
      normalize: true,
    });

    const content = response?.message?.content ?? response?.text ?? response?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('');
    }
    throw new Error('Puter returned a response without readable text.');
  },

  async streamChat(
    messages: PuterChatMessage[],
    options: {
      model: string;
      signal?: AbortSignal;
      onText: (chunk: string) => void;
    },
  ): Promise<void> {
    const puter = await loadPuter();
    if (!puter.auth?.isSignedIn?.()) throw new Error('Connect your Puter account before using Puter AI.');
    if (!options?.model?.trim()) throw new Error('Choose a model from Puter’s live model list first.');

    const response = await puter.ai.chat(messages.slice(-21), false, {
      model: options.model,
      stream: true,
      signal: options.signal,
      normalize: true,
    });

    if (!response || typeof response[Symbol.asyncIterator] !== 'function') {
      throw new Error('Puter did not return a readable chat stream.');
    }

    for await (const chunk of response) {
      if (chunk?.type === 'error') {
        throw new Error(typeof chunk.message === 'string' ? chunk.message : 'Puter reported a streaming error.');
      }
      if (chunk?.type === 'text' && typeof chunk.text === 'string' && chunk.text) {
        options.onText(chunk.text);
      }
    }
  },
};
