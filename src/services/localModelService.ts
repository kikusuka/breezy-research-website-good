export type LocalModelProvider = 'ollama' | 'openai-compatible';
export type LocalApiFormat = 'openai' | 'anthropic';

export interface LocalChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function normalizeBaseUrl(baseUrl: string): URL {
  let parsed: URL;
  try { parsed = new URL(baseUrl.trim()); }
  catch { throw new Error('Enter a valid local model server URL, including http:// or https://.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Local model URLs must use http:// or https://.');
  if (parsed.username || parsed.password) throw new Error('Do not put credentials in the server URL. Use the optional API-key field instead.');
  if (parsed.search || parsed.hash) throw new Error('The server base URL must not contain a query string or fragment.');
  return parsed;
}

export function buildLocalChatEndpoint(provider: LocalModelProvider, baseUrl: string, apiFormat: LocalApiFormat = 'openai'): string {
  const parsed = normalizeBaseUrl(baseUrl);
  let path = parsed.pathname.replace(/\/+$/, '');
  if (provider === 'ollama' || apiFormat === 'openai') {
    if (provider === 'ollama' && !/\/v1$/i.test(path) && !/\/chat\/completions$/i.test(path)) path += '/v1';
    if (!/\/chat\/completions$/i.test(path)) path += '/chat/completions';
  } else {
    if (!/\/v1$/i.test(path) && !/\/messages$/i.test(path)) path += '/v1';
    if (!/\/messages$/i.test(path)) path += '/messages';
  }
  return parsed.origin + path;
}

function buildModelsEndpoint(provider: LocalModelProvider, baseUrl: string): string {
  const parsed = normalizeBaseUrl(baseUrl);
  let path = parsed.pathname.replace(/\/+$/, '');
  if (provider === 'ollama') path = path.replace(/\/v1$/i, '') + '/api/tags';
  else if (!/\/models$/i.test(path)) path += '/models';
  return parsed.origin + path;
}

function localAuthHeaders(provider: LocalModelProvider, apiKey: string | undefined, apiFormat: LocalApiFormat): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey?.trim()) {
    if (provider === 'openai-compatible' && apiFormat === 'anthropic') headers['x-api-key'] = apiKey.trim();
    else headers.Authorization = 'Bearer ' + apiKey.trim();
  }
  if (provider === 'openai-compatible' && apiFormat === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  return headers;
}

const MODEL_DISCOVERY_TIMEOUT_MS = 15_000;
const MODEL_TEST_TIMEOUT_MS = 90_000;

/** Bound setup requests so a sleeping phone/server cannot leave the Models screen spinning forever. */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutLabel: string,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) forwardAbort();
  else externalSignal?.addEventListener('abort', forwardAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error(timeoutLabel);
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
}

async function responseError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  let detail = body;
  try { const parsed = JSON.parse(body); detail = parsed?.error?.message || parsed?.error || parsed?.message || body; } catch {}
  return detail ? `Local model server returned HTTP ${response.status}: ${String(detail).slice(0, 300)}` : `Local model server returned HTTP ${response.status}.`;
}

export async function chatWithLocalModel(options: {
  provider: LocalModelProvider; baseUrl: string; model: string; messages: LocalChatMessage[]; apiKey?: string; signal?: AbortSignal; apiFormat?: LocalApiFormat; requestTimeoutMs?: number;
}): Promise<{ text: string }> {
  const { provider, baseUrl, model, messages, apiKey, signal, apiFormat = 'openai', requestTimeoutMs } = options;
  if (!model.trim()) throw new Error('Choose the exact model ID exposed by your local server.');
  const useAnthropic = provider === 'openai-compatible' && apiFormat === 'anthropic';
  const headers = { ...localAuthHeaders(provider, apiKey, apiFormat), 'Content-Type': 'application/json' };
  const requestBody = useAnthropic
    ? {
        model: model.trim(),
        max_tokens: 1024,
        system: messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n') || undefined,
        messages: messages.filter((message) => message.role !== 'system'),
      }
    : { model: model.trim(), messages, stream: false };
  const response = await fetch(buildLocalChatEndpoint(provider, baseUrl, apiFormat), {
    method: 'POST', headers, body: JSON.stringify(requestBody), signal, credentials: 'omit',
  });
  if (!response.ok) throw new Error(await responseError(response));
  const data = await response.json();
  const content = useAnthropic ? data?.content : data?.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('') : '';
  if (!text.trim()) throw new Error('The local model server responded, but returned no readable assistant text.');
  return { text };
}

/**
 * Makes one small, explicit generation request directly from the browser.
 * This is opt-in because local inference can be slow and use device resources.
 */
export async function testLocalModelGeneration(options: {
  provider: LocalModelProvider; baseUrl: string; model: string; apiKey?: string; apiFormat?: LocalApiFormat;
}): Promise<string> {
  const result = await chatWithLocalModel({
    ...options,
    messages: [{ role: 'user', content: 'Reply with a short greeting.' }],\n    requestTimeoutMs: MODEL_TEST_TIMEOUT_MS,
  });
  return result.text;
}

/** Tests connectivity from this browser, not from Breezy's hosted backend. */
export async function listLocalModels(provider: LocalModelProvider, baseUrl: string, apiKey?: string, apiFormat: LocalApiFormat = 'openai'): Promise<string[]> {
  let response: Response;
  try {
    response = await fetch(buildModelsEndpoint(provider, baseUrl), {
      method: 'GET', headers: localAuthHeaders(provider, apiKey, apiFormat), credentials: 'omit',
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('did not respond within 15 seconds')) throw error;\n    throw new Error('Could not list models from this browser. Check the address, server status, and CORS settings. ' + (error?.message || 'Network request failed.'));
  }
  if (!response.ok) throw new Error(await responseError(response));
  let data: any;
  try { data = await response.json(); }
  catch { throw new Error('The model server returned invalid JSON while listing models.'); }
  const entries = provider === 'ollama' ? data?.models : data?.data;
  if (!Array.isArray(entries)) throw new Error('The endpoint responded, but did not return a recognizable model list.');
  const ids = entries
    .map((entry: any) => provider === 'ollama' ? entry?.name || entry?.model : entry?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id: string) => id.trim());
  return [...new Set(ids)].slice(0, 100);
}

/** Tests connectivity from this browser, not from Breezy's hosted backend. */
export async function testLocalModelEndpoint(provider: LocalModelProvider, baseUrl: string, apiKey?: string, apiFormat: LocalApiFormat = 'openai'): Promise<string> {
  let response: Response;
  try {
    response = await fetch(buildModelsEndpoint(provider, baseUrl), {
      method: 'GET', headers: localAuthHeaders(provider, apiKey, apiFormat), credentials: 'omit',
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('did not respond within 15 seconds')) throw error;\n    throw new Error('Could not reach the endpoint from this browser. Check the address, server status, and CORS settings. ' + (error?.message || 'Network request failed.'));
  }
  if (!response.ok) throw new Error(await responseError(response));
  if (provider === 'ollama') return 'Connected to Ollama from this browser. This checks the server endpoint, not whether the selected model can generate a response.';
  return apiFormat === 'anthropic'
    ? 'Connected to the Anthropic-compatible models endpoint from this browser. This checks endpoint access, not model generation.'
    : 'Connected to the OpenAI-compatible models endpoint from this browser. This checks endpoint access, not model generation.';
}
