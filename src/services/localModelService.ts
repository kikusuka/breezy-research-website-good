export type LocalModelProvider = 'ollama' | 'openai-compatible';

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

export function buildLocalChatEndpoint(provider: LocalModelProvider, baseUrl: string): string {
  const parsed = normalizeBaseUrl(baseUrl);
  let path = parsed.pathname.replace(/\/+$/, '');
  if (provider === 'ollama' && !/\/v1$/i.test(path) && !/\/chat\/completions$/i.test(path)) path += '/v1';
  if (!/\/chat\/completions$/i.test(path)) path += '/chat/completions';
  return parsed.origin + path;
}

function buildModelsEndpoint(provider: LocalModelProvider, baseUrl: string): string {
  const parsed = normalizeBaseUrl(baseUrl);
  let path = parsed.pathname.replace(/\/+$/, '');
  if (provider === 'ollama') path = path.replace(/\/v1$/i, '') + '/api/tags';
  else if (!/\/models$/i.test(path)) path += '/models';
  return parsed.origin + path;
}

async function responseError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  let detail = body;
  try { const parsed = JSON.parse(body); detail = parsed?.error?.message || parsed?.error || parsed?.message || body; } catch {}
  return detail ? `Local model server returned HTTP ${response.status}: ${String(detail).slice(0, 300)}` : `Local model server returned HTTP ${response.status}.`;
}

export async function chatWithLocalModel(options: {
  provider: LocalModelProvider; baseUrl: string; model: string; messages: LocalChatMessage[]; apiKey?: string; signal?: AbortSignal;
}): Promise<{ text: string }> {
  const { provider, baseUrl, model, messages, apiKey, signal } = options;
  if (!model.trim()) throw new Error('Choose the exact model ID exposed by your local server.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const response = await fetch(buildLocalChatEndpoint(provider, baseUrl), {
    method: 'POST', headers, body: JSON.stringify({ model: model.trim(), messages, stream: false }),
    signal, credentials: 'omit',
  });
  if (!response.ok) throw new Error(await responseError(response));
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('') : '';
  if (!text.trim()) throw new Error('The local model server responded, but returned no readable assistant text.');
  return { text };
}

/**
 * Makes one small, explicit generation request directly from the browser.
 * This is opt-in because local inference can be slow and use device resources.
 */
export async function testLocalModelGeneration(options: {
  provider: LocalModelProvider; baseUrl: string; model: string; apiKey?: string;
}): Promise<string> {
  const result = await chatWithLocalModel({
    ...options,
    messages: [{ role: 'user', content: 'Reply with a short greeting.' }],
  });
  return result.text;
}

/** Tests connectivity from this browser, not from Breezy's hosted backend. */
export async function listLocalModels(provider: LocalModelProvider, baseUrl: string, apiKey?: string): Promise<string[]> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'openai-compatible' && apiKey?.trim()) headers.Authorization = 'Bearer ' + apiKey.trim();
  let response: Response;
  try {
    response = await fetch(buildModelsEndpoint(provider, baseUrl), { method: 'GET', headers, credentials: 'omit' });
  } catch (error: any) {
    throw new Error('Could not list models from this browser. Check the address, server status, and CORS settings. ' + (error?.message || 'Network request failed.'));
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
export async function testLocalModelEndpoint(provider: LocalModelProvider, baseUrl: string, apiKey?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'openai-compatible' && apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  let response: Response;
  try {
    response = await fetch(buildModelsEndpoint(provider, baseUrl), { method: 'GET', headers, credentials: 'omit' });
  } catch (error: any) {
    throw new Error('Could not reach the endpoint from this browser. Check the address, server status, and CORS settings. ' + (error?.message || 'Network request failed.'));
  }
  if (!response.ok) throw new Error(await responseError(response));
  return provider === 'ollama'
    ? 'Connected to Ollama from this browser. This checks the server endpoint, not whether the selected model can generate a response.'
    : 'Connected to the OpenAI-compatible models endpoint from this browser. This checks endpoint access, not model generation.';
}
