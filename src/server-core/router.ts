/**
 * Unified Backend Core Router & Request Handlers
 * 100% Web Standards (Request, Response, ReadableStream, TransformStream)
 * Runs cleanly on Cloudflare Workers, Deno Deploy, and Node.js
 */

import { BackendEnv, HealthResponse, SearchEngineProvider } from './types';
import { callAgentWithStream, sanitizeGeminiModel } from './providers';
import { performSearchGrounding } from './search';
import { summarizeStage, generateRealEvidenceGraph } from './evidence';

// In-memory rate limiting map for server-provided key usage (resets per instance/isolate)
const requestRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkServerRateLimit(clientIdentifier: string, maxRequests = 20, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestRateLimitMap.get(clientIdentifier);
  if (!record || now > record.resetAt) {
    requestRateLimitMap.set(clientIdentifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

function getClientIdentifier(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous-client'
  );
}

/**
 * Identify the best available provider/model for background research tasks (summarization, extraction)
 */
function getExtractionConfig(keys: any, env: BackendEnv) {
  if (keys.gemini || env.GEMINI_API_KEY) {
    return { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: keys.gemini || env.GEMINI_API_KEY };
  }
  if (keys.anthropic || env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: keys.anthropic || env.ANTHROPIC_API_KEY };
  }
  if (keys.groq || env.GROQ_API_KEY) {
    return { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: keys.groq || env.GROQ_API_KEY };
  }
  if (keys.sambanova || env.SAMBANOVA_API_KEY) {
    return { provider: 'sambanova', model: 'Meta-Llama-3.3-70B-Instruct', apiKey: keys.sambanova || env.SAMBANOVA_API_KEY };
  }
  if (keys.openrouter || env.OPENROUTER_API_KEY) {
    return { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', apiKey: keys.openrouter || env.OPENROUTER_API_KEY };
  }
  return null;
}

export function getCorsHeaders(req: Request, env: BackendEnv = {}): Record<string, string> {
  const requestOrigin = req.headers.get('Origin');
  const allowedOriginsConfig = env.ALLOWED_ORIGINS?.trim();

  let resolvedOrigin = '*';

  if (allowedOriginsConfig) {
    if (allowedOriginsConfig === '*') {
      resolvedOrigin = '*';
    } else {
      const allowedList = allowedOriginsConfig.split(',').map((o) => o.trim().toLowerCase());
      if (requestOrigin) {
        const lowerOrigin = requestOrigin.toLowerCase();
        if (allowedList.includes(lowerOrigin) || allowedList.includes('*')) {
          resolvedOrigin = requestOrigin;
        } else {
          // Fail-closed: do not reflect untrusted origins
          resolvedOrigin = 'null';
        }
      } else {
        resolvedOrigin = allowedList[0] || 'null';
      }
    }
  } else if (requestOrigin) {
    // In local dev without explicit ALLOWED_ORIGINS, allow request origin
    resolvedOrigin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Breezy-Client',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

export function createJsonResponse(data: any, status: number = 200, req?: Request, env?: BackendEnv): Response {
  const cors = req ? getCorsHeaders(req, env) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
    },
  });
}

/**
 * Main request router for all backend targets
 */
export async function handleBackendRequest(
  req: Request,
  env: BackendEnv = {},
  backendName: 'cloudflare-worker' | 'deno-deploy' | 'render-node' | 'local-dev' = 'cloudflare-worker'
): Promise<Response> {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req, env),
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const clientIp = getClientIdentifier(req);

  // 1. Health & Status
  if (path === '/api/health' && req.method === 'GET') {
    const hasServerGemini = Boolean(env.GEMINI_API_KEY);
    const configuredProviders: string[] = [];
    if (env.GEMINI_API_KEY) configuredProviders.push('gemini');
    if (env.ANTHROPIC_API_KEY) configuredProviders.push('anthropic');
    if (env.GROQ_API_KEY) configuredProviders.push('groq');
    if (env.SAMBANOVA_API_KEY) configuredProviders.push('sambanova');
    if (env.OPENROUTER_API_KEY) configuredProviders.push('openrouter');
    if (env.OLLAMA_BASE_URL) configuredProviders.push('ollama');
    if (env.OPENAI_COMPATIBLE_BASE_URL) configuredProviders.push('openai-compatible');

    const healthData: HealthResponse = {
      ok: true,
      status: 'ok',
      backend: backendName,
      version: '2.5.0-universal',
      serverGeminiConfigured: hasServerGemini,
      defaultModel: hasServerGemini ? 'gemini-2.5-flash' : '',
      providers: configuredProviders,
      supportedProviders: ['gemini', 'anthropic', 'groq', 'sambanova', 'openrouter', 'ollama', 'openai-compatible'],
      timestamp: Date.now(),
    };
    return createJsonResponse(healthData, 200, req, env);
  }

  // Helper for SSRF safety check on external webhook URLs
  const validatePublicWebhookUrl = (rawUrl: string): { safe: boolean; error?: string } => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { safe: false, error: 'Only HTTP and HTTPS protocols are allowed.' };
      }
      const hostname = parsed.hostname.toLowerCase();
      
      // Disallow local loopback, 0.0.0.0, link-local, internal domains
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname === '[::1]' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.onion')
      ) {
        return { safe: false, error: 'Internal and loopback network addresses are strictly prohibited.' };
      }

      // Disallow cloud instance metadata endpoints
      if (
        hostname === '169.254.169.254' ||
        hostname.includes('metadata.google') ||
        hostname.includes('169.254')
      ) {
        return { safe: false, error: 'Access to cloud metadata endpoints is prohibited.' };
      }

      // Disallow IPv6 private/local ranges (fc00::/7, fd00::/8, fe80::/10, ff00::/8)
      const cleanHost = hostname.replace(/^\[|\]$/g, '');
      if (
        cleanHost.startsWith('fc') ||
        cleanHost.startsWith('fd') ||
        cleanHost.startsWith('fe80') ||
        cleanHost.startsWith('ff') ||
        cleanHost.includes('::')
      ) {
        return { safe: false, error: 'IPv6 private and loopback addresses are prohibited.' };
      }

      // Disallow private IPv4 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 100.64.0.0/10)
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const match = hostname.match(ipv4Regex);
      if (match) {
        const o1 = Number(match[1]);
        const o2 = Number(match[2]);
        if (o1 === 10 || o1 === 127 || o1 === 0) {
          return { safe: false, error: 'Private IP addresses are prohibited.' };
        }
        if (o1 === 172 && o2 >= 16 && o2 <= 31) {
          return { safe: false, error: 'Private IP addresses are prohibited.' };
        }
        if (o1 === 192 && o2 === 168) {
          return { safe: false, error: 'Private IP addresses are prohibited.' };
        }
        if (o1 === 169 && o2 === 254) {
          return { safe: false, error: 'Link-local addresses are prohibited.' };
        }
        if (o1 === 100 && o2 >= 64 && o2 <= 127) {
          return { safe: false, error: 'Shared CGNAT private address range is prohibited.' };
        }
      }

      return { safe: true };
    } catch {
      return { safe: false, error: 'Malformed or unparseable webhook URL.' };
    }
  };

  // Webhook verification endpoint with SSRF safety checks
  if (path === '/api/webhook/test' && req.method === 'POST') {
    const rateCheck = checkServerRateLimit(clientIp, 10, 60000);
    if (!rateCheck.allowed) {
      return createJsonResponse(
        { success: false, error: 'Webhook test rate limit exceeded (10 requests/min). Please wait.' },
        429,
        req,
        env
      );
    }

    try {
      const body = await req.json().catch(() => ({}));
      const { webhookUrl, payload } = body;
      if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
        return createJsonResponse({ success: false, error: 'Valid HTTP(S) webhook URL required' }, 400, req, env);
      }

      const ssrfCheck = validatePublicWebhookUrl(webhookUrl);
      if (!ssrfCheck.safe) {
        return createJsonResponse({ success: false, error: ssrfCheck.error || 'Invalid webhook target address' }, 403, req, env);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BreezyResearch-WebhookVerifier/1.0',
        },
        body: JSON.stringify(payload || { text: 'Synthexis Webhook Connection Test' }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      return createJsonResponse({
        success: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
      }, resp.ok ? 200 : 400, req, env);
    } catch (err: any) {
      return createJsonResponse({
        success: false,
        error: err.name === 'AbortError' ? 'Webhook request timed out (8s limit)' : err.message || 'Network error',
      }, 502, req, env);
    }
  }

  // Rate-limiting check for API endpoints
  if (
    path === '/api/vault/verify-key' ||
    path === '/api/breezy/chat' ||
    path === '/api/debate/summarize' ||
    path === '/api/debate/stream'
  ) {
    const rateCheck = checkServerRateLimit(clientIp, 20, 60000);
    if (!rateCheck.allowed) {
      return createJsonResponse(
        { error: 'Rate limit exceeded (20 requests per minute). Please wait a moment.' },
        429,
        req,
        env
      );
    }
  }

  // Ollama Secure Proxy (bridges localhost to HTTPS web environments)
  if (path.startsWith('/api/ollama/')) {
    const subpath = path.replace('/api/ollama', '');
    const ollamaUrl = env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    try {
      const targetUrl = `${ollamaUrl.replace(/\/$/, '')}${subpath}`;
      const forwardBody = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;
      const ollamaRes = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: forwardBody,
      });
      const data = await ollamaRes.json();
      return createJsonResponse(data, ollamaRes.status, req, env);
    } catch (e: any) {
      return createJsonResponse(
        { error: 'Ollama is unreachable on local server. Ensure Ollama service is running.', details: e.message },
        503,
        req,
        env
      );
    }
  }

  // 2. Vault key verification
  if (path === '/api/vault/verify-key' && req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      const { provider, apiKey } = body;
      if (!provider || !apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return createJsonResponse({ valid: false, error: 'Provider and API key are required.' }, 400, req, env);
      }

      const trimmedKey = apiKey.trim();
      const startTime = Date.now();

      if (provider === 'gemini') {
        try {
          await callAgentWithStream({
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            apiKey: trimmedKey,
            systemInstruction: 'Respond with OK in one word.',
            userPrompt: 'Ping',
            onChunk: () => {},
            env,
          });
        } catch {
          await callAgentWithStream({
            provider: 'gemini',
            model: 'gemini-2.5-flash-lite',
            apiKey: trimmedKey,
            systemInstruction: 'Respond with OK in one word.',
            userPrompt: 'Ping',
            onChunk: () => {},
            env,
          });
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'Google Gemini key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'anthropic') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': trimmedKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Ping' }],
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `Anthropic verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'Anthropic Claude API key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'groq') {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `Groq verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'Groq key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'sambanova') {
        const resp = await fetch('https://api.sambanova.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: JSON.stringify({
            model: 'Meta-Llama-3.3-70B-Instruct',
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `SambaNova verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'SambaNova key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'openrouter') {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.3-70b-instruct',
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `OpenRouter verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'OpenRouter key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'tavily') {
        const resp = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: trimmedKey,
            query: 'ping test',
            max_results: 1,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `Tavily verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'Tavily Search API key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'serper') {
        const resp = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': trimmedKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: 'ping test', num: 1 }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `Serper verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'Serper.dev API key verified successfully.',
        }, 200, req, env);
      }

      if (provider === 'brave') {
        const resp = await fetch('https://api.search.brave.com/res/v1/web/search?q=ping&count=1', {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': trimmedKey,
          },
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return createJsonResponse({ valid: false, error: `Brave Search verification failed (${resp.status}): ${errText}` }, 400, req, env);
        }
        return createJsonResponse({
          valid: true,
          provider,
          latencyMs: Date.now() - startTime,
          message: 'Brave Search API key verified successfully.',
        }, 200, req, env);
      }

      return createJsonResponse({ valid: false, error: `Unsupported provider: ${provider}` }, 400, req, env);
    } catch (err: any) {
      return createJsonResponse({ valid: false, error: err?.message || 'Verification failed' }, 500, req, env);
    }
  }

  // 3. Breezy conversational chat
  if (path === '/api/breezy/chat' && req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      const { prompt, history = [], provider = 'gemini', model = 'gemini-2.5-flash', apiKey } = body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return createJsonResponse({ error: 'Prompt is required' }, 400, req, env);
      }

      const systemInstruction =
        'You are Breezy, an exceptionally capable, weightless AI engineering and research assistant. Deliver direct, accurate, beautifully structured answers with markdown. Provide real technical solutions, code examples, or research insights without generic disclaimers.';

      let formattedPrompt = prompt.trim();
      if (Array.isArray(history) && history.length > 0) {
        const prior = history
          .slice(-6)
          .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');
        formattedPrompt = `Conversation History:\n${prior}\n\nUser: ${prompt.trim()}`;
      }

      let fullAnswer = '';
      await callAgentWithStream({
        provider: (['groq', 'sambanova', 'openrouter', 'anthropic'].includes(provider) ? provider : 'gemini') as any,
        model: model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gemini-2.5-flash'),
        apiKey: apiKey?.trim() || undefined,
        systemInstruction,
        userPrompt: formattedPrompt,
        temperature: 0.7,
        enableSearchGrounding: false,
        onChunk: (chunk) => {
          fullAnswer += chunk;
        },
        env,
        signal: req.signal,
      });

      return createJsonResponse({ text: fullAnswer || 'Synthexis completed.' }, 200, req, env);
    } catch (err: any) {
      return createJsonResponse({ error: err?.message || 'Chat generation failed' }, 500, req, env);
    }
  }

  // 4. Debate summary endpoint
  if (path === '/api/debate/summarize' && req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      const { session, providerKeyConfig } = body;
      if (!session || !session.prompt) {
        return createJsonResponse({ error: 'Session with prompt is required.' }, 400, req, env);
      }

      const systemInstruction = `You are the Lead Research Synthexis Analyst. Your task is to analyze the multi-model analysis trace and produce a valid JSON object with exactly two keys:
1. "summary": A concise, objective, one-sentence executive summary highlighting the synthesized resolution and core trade-offs. Do not exceed one sentence. Start directly with the summary text.
2. "category": A highly descriptive, exact three-word title or category reflecting the core technical subject (e.g., "Database Migration Strategy", "OAuth Security Architecture", "Vector Search Indexing"). Exactly 3 words.

Return ONLY a raw JSON object. Do not include markdown code blocks like \`\`\`json or \`\`\`. Do not write any explanatory text before or after the JSON.`;

      const userPrompt = `INQUIRY PROMPT:
${session.prompt}

FINAL SYNTHEXIS OUTPUT:
${session.finalOutput || '(No final output produced yet. Summary based on prompt only.)'}

ANALYSIS STEPS TRANSCRIPT:
${(session.steps || []).map((s: any) => `[Round ${s.round} - ${s.role}]: ${s.content.slice(0, 500)}...`).join('\n\n')}

Analyze this deliberation and output the JSON object.`;

      const keys = providerKeyConfig || {};
      const extractionConfig = getExtractionConfig(keys, env);
      
      if (!extractionConfig) {
        return createJsonResponse({ error: 'No configured model found for summarization task. Please provide a Gemini or other provider key.' }, 400, req, env);
      }

      const resultText = await callAgentWithStream({
        provider: extractionConfig.provider as any,
        model: extractionConfig.model,
        apiKey: extractionConfig.apiKey,
        systemInstruction,
        userPrompt,
        temperature: 0.2,
        onChunk: () => {},
        env,
        signal: req.signal,
      });

      let summary = '';
      let category = '';
      try {
        const cleaned = resultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const parsed = JSON.parse(cleaned);
        summary = parsed.summary || '';
        category = parsed.category || '';
      } catch (e) {
        summary = resultText.trim().split('\n')[0] || 'No summary available.';
        category = 'General Research Session';
      }

      return createJsonResponse({ summary: summary.trim(), category: category.trim() }, 200, req, env);
    } catch (err: any) {
      return createJsonResponse({ error: err?.message || 'Failed to generate executive summary.' }, 500, req, env);
    }
  }

  // 5. Debate SSE Stream
  if (path === '/api/debate/stream' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      protocol = 'trio',
      tone = 'balanced',
      searchEngine = 'duckduckgo',
      keys = {},
      seats = {},
      enableSearchGrounding = false,
      agreementThreshold = 78,
      autoResolve = true,
      selectedRound = 2,
      researchMethod = 'adaptive',
      heartbeatEnabled = true,
      heartbeatIntervalSec = 60,
    } = body;

    const effectiveProtocol = (selectedRound === 1) ? 'solo' : (selectedRound === 4) ? 'quad' : (selectedRound === 2 && (protocol === 'quad' || protocol === 'deep')) ? 'trio' : protocol;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return createJsonResponse({ error: 'Prompt is required' }, 400, req, env);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (type: string, payload: any) => {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`));
      } catch {}
    };

    const usageByRound: Record<string, any> = {};
    let lastHeartbeatAt = 0;
    let heartbeatContext = '';
    const safeHeartbeatInterval = Math.min(300, Math.max(20, Number(heartbeatIntervalSec) || 60));

    const emitUsage = (round: number | string, usage: any) => {
      const key = String(round);
      const previous = usageByRound[key] || {};
      const next = {
        inputTokens: usage?.inputTokens ?? previous.inputTokens,
        outputTokens: usage?.outputTokens ?? previous.outputTokens,
        totalTokens: usage?.totalTokens ?? previous.totalTokens,
        reasoningTokens: usage?.reasoningTokens ?? previous.reasoningTokens,
        cachedInputTokens: usage?.cachedInputTokens ?? previous.cachedInputTokens,
      };
      usageByRound[key] = next;
      void sendEvent('usage', { round: Number(round) || 0, usage: next });
    };

    // Re-anchor the research model between long stages so a long session does not silently drift.
    const runHeartbeat = async (round: number, config: any, roleName: string, taskReminder: string, currentContext: string) => {
      if (!heartbeatEnabled) return;
      const now = Date.now();
      if (now - lastHeartbeatAt < safeHeartbeatInterval * 1000) return;
      lastHeartbeatAt = now;
      await sendEvent('heartbeat', {
        round,
        role: roleName,
        agentName: roleName,
        bpm: Math.round(60 / safeHeartbeatInterval),
        taskReminder,
        statusText: `Heartbeat: re-checking scope, evidence, and task alignment before continuing.`,
        timestamp: now,
      });
      try {
        const checkpoint = await callAgentWithStream({
          provider: config.provider,
          model: config.model,
          apiKey: keys[config.provider],
          systemInstruction: 'You are the research heartbeat. Do not solve the user question. Return a compact checkpoint that keeps the next generation aligned with the original task, scope, evidence standard, and unresolved uncertainty. Explicitly flag drift or hallucination risk.',
          userPrompt: `ORIGINAL TASK:\n${prompt}\n\nTASK REMINDER:\n${taskReminder}\n\nCURRENT RESEARCH CONTEXT:\n${currentContext.slice(-12000)}`,
          temperature: 0.1,
          enableSearchGrounding: false,
          onChunk: () => {},
          onUsage: (usage) => emitUsage(`heartbeat-${round}`, usage),
          env,
          signal: req.signal,
        });
        heartbeatContext = checkpoint.trim().slice(0, 5000);
        await sendEvent('heartbeat', {
          round,
          role: roleName,
          agentName: roleName,
          bpm: Math.round(60 / safeHeartbeatInterval),
          taskReminder,
          statusText: 'Heartbeat checkpoint applied to the next research stage.',
          checkpoint: heartbeatContext,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        await sendEvent('heartbeat', {
          round,
          role: roleName,
          agentName: roleName,
          bpm: Math.round(60 / safeHeartbeatInterval),
          taskReminder,
          statusText: 'Heartbeat reminder sent; checkpoint model was unavailable, so the pipeline continued.',
          timestamp: Date.now(),
        });
      }
    };

    // Execute streaming pipeline asynchronously
    (async () => {
      const startTime = Date.now();
      try {
        await sendEvent('status', { message: 'Initializing multi-model analysis...' });

        let toneInstruction = '';
        let methodInstruction = '';
        if (researchMethod === 'systematic') {
          methodInstruction = `\nRESEARCH METHOD: SYSTEMATIC EVIDENCE REVIEW. First decompose the question into explicit subquestions and inclusion boundaries. Prefer primary/authoritative sources, distinguish evidence from inference, and identify what remains unverified. Keep the reasoning traceable from question -> evidence -> claim -> conclusion.`;
        } else if (researchMethod === 'evidence-map') {
          methodInstruction = `\nRESEARCH METHOD: EVIDENCE MAP. Organize the investigation around themes, source types, supported claims, contradictions, and evidence gaps. Do not force a single conclusion where the evidence is incomplete.`;
        } else if (researchMethod === 'comparative') {
          methodInstruction = `\nRESEARCH METHOD: COMPARATIVE ANALYSIS. Establish explicit comparison criteria before evaluating alternatives. Keep facts, assumptions, trade-offs, and unresolved uncertainties separate.`;
        } else {
          methodInstruction = `\nRESEARCH METHOD: ADAPTIVE. Choose the lightest rigorous workflow that fits the question; deepen the investigation when uncertainty, conflicting evidence, or multiple subquestions require it.`;
        }
        const methodOutputInstruction =
          researchMethod === 'systematic'
            ? '\nOUTPUT SHAPE: Research question; evidence reviewed; supported findings; limitations/gaps; conclusion.'
            : researchMethod === 'evidence-map'
              ? '\nOUTPUT SHAPE: Major themes; evidence for each theme; contradictions; evidence gaps; what cannot be concluded.'
              : researchMethod === 'comparative'
                ? '\nOUTPUT SHAPE: Decision criteria; option-by-option findings; trade-offs; uncertainty; conditional conclusion.'
                : '\nOUTPUT SHAPE: Answer first; key evidence; important caveats; practical conclusion.';
        let skepticTemp = 0.75;
        let arbiterTemp = 0.5;

        if (tone === 'diplomatic') {
          toneInstruction = `\nDEBATE TONE: DIPLOMATIC & CONSTRUCTIVE. Maintain a collegiate, respectful demeanor. Frame critiques as nuanced improvements and alternative trade-offs.`;
          skepticTemp = 0.6;
          arbiterTemp = 0.4;
        } else if (tone === 'aggressive') {
          toneInstruction = `\nDEBATE TONE: DIRECT & UNSPARING. Cut straight to core failure modes, flawed assumptions, and scaling bottlenecks with maximum clarity and zero fluff.`;
          skepticTemp = 0.85;
          arbiterTemp = 0.5;
        } else if (tone === 'rigorous') {
          toneInstruction = `\nDEBATE TONE: RIGOROUS & EMPIRICAL. Apply strict engineering and analytical standards. Verify every assumption, constraint, and edge case.`;
          skepticTemp = 0.75;
          arbiterTemp = 0.45;
        } else {
          toneInstruction = `\nDEBATE TONE: BALANCED & CANDID. Deliver objective, clear, and intellectually honest dialectical analysis. Prioritize technical correctness and pragmatic reality.`;
          skepticTemp = 0.75;
          arbiterTemp = 0.5;
        }

        const resolveSeatConfig = (seat: any, roleName: string, fallbackProv: string, fallbackModel: string) => {
          const chosen = seat || { provider: fallbackProv, model: fallbackModel };
          const prov = chosen.provider;
          const hasGemini = Boolean(keys.gemini || env.GEMINI_API_KEY);

          if (prov === 'gemini') {
            if (!hasGemini) {
              const alt = getExtractionConfig(keys, env);
              if (alt) {
                sendEvent('notice', {
                  message: `Google Gemini unconfigured. Redirecting ${roleName} stage to ${alt.provider.toUpperCase()}.`
                });
                return { provider: alt.provider, model: alt.model };
              }
            }
            return chosen;
          }

          const hasKey = Boolean(keys[prov]?.trim() || (env as any)[`${prov.toUpperCase()}_API_KEY`]);
          if (!hasKey) {
            if (hasGemini) {
              sendEvent('notice', {
                message: `No API key provided for ${prov.toUpperCase()}. Falling back to Gemini for ${roleName} stage.`
              });
              return { provider: 'gemini', model: 'gemini-2.5-flash' };
            } else {
              const alt = getExtractionConfig(keys, env);
              if (alt) {
                sendEvent('notice', {
                  message: `Requested provider ${prov.toUpperCase()} unconfigured. Redirecting to ${alt.provider.toUpperCase()}.`
                });
                return { provider: alt.provider, model: alt.model };
              }
            }
          }
          return chosen;
        };

        const architectConfig = resolveSeatConfig(seats.architect, 'Analyst', 'gemini', 'gemini-2.5-flash');
        const skepticConfig = resolveSeatConfig(seats.skeptic, 'Critic', keys.groq ? 'groq' : 'gemini', keys.groq ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash');
        const verifierConfig = resolveSeatConfig(seats.verifier, 'Verifier', keys.sambanova ? 'sambanova' : 'gemini', keys.sambanova ? 'Qwen2.5-72B-Instruct' : 'gemini-2.5-flash');
        const arbiterConfig = resolveSeatConfig(seats.arbiter, 'Synthesizer', 'gemini', 'gemini-2.5-flash');

        const emitStatus = (role: string, agentName: string, taskDescription: string) => {
          sendEvent('status', {
            role,
            agentName,
            message: `${agentName}: ${taskDescription}`,
            timestamp: Date.now(),
          });
          sendEvent('heartbeat', {
            role,
            agentName,
            bpm: 0,
            taskReminder: taskDescription,
            statusText: `${agentName} processing: ${taskDescription}`,
            timestamp: Date.now(),
          });
        };

        // PLAN: turn the question into an explicit scope before retrieval.
        // This is the main difference between "chat with search" and a research workflow.
        let researchPlan: string[] = [];
        let researchPlanContext = '';
        try {
          await sendEvent('status', { message: 'Planning the research scope and evidence strategy...' });
          const plannerPrompt = `USER QUESTION:
${prompt}

RESEARCH METHOD:
${researchMethod}

Create a compact research plan before evidence retrieval. Return ONLY valid JSON:
{
  "scope": "one sentence defining what this inquiry covers and what it does not",
  "subquestions": ["2-5 concrete subquestions"],
  "searchQueries": ["2-4 high-value search queries"],
  "evidenceStandard": "one sentence describing what counts as strong evidence"
}`;

          const plannerRaw = await callAgentWithStream({
            provider: architectConfig.provider,
            model: architectConfig.model,
            apiKey: keys[architectConfig.provider],
            systemInstruction: 'You are the research planner. Define scope, subquestions, retrieval queries, and an evidence standard. Do not answer the question yet.',
            userPrompt: plannerPrompt,
            temperature: 0.2,
            enableSearchGrounding: false,
            onChunk: () => {},
            onUsage: (usage) => emitUsage('planner', usage),
            env,
            signal: req.signal,
          });

          const cleanedPlan = plannerRaw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
          const parsedPlan = JSON.parse(cleanedPlan);
          const scope = typeof parsedPlan.scope === 'string' ? parsedPlan.scope.trim() : '';
          const subquestions = Array.isArray(parsedPlan.subquestions) ? parsedPlan.subquestions.filter((q: any) => typeof q === 'string' && q.trim()).map((q: string) => q.trim()) : [];
          const searchQueries = Array.isArray(parsedPlan.searchQueries) ? parsedPlan.searchQueries.filter((q: any) => typeof q === 'string' && q.trim()).map((q: string) => q.trim()) : [];
          const evidenceStandard = typeof parsedPlan.evidenceStandard === 'string' ? parsedPlan.evidenceStandard.trim() : '';

          researchPlan = [
            scope ? 'Scope: ' + scope : '',
            ...subquestions.map((q: string, i: number) => 'Subquestion ' + (i + 1) + ': ' + q),
            searchQueries.length ? 'Retrieval queries: ' + searchQueries.join(' | ') : '',
            evidenceStandard ? 'Evidence standard: ' + evidenceStandard : '',
          ].filter(Boolean);

          researchPlanContext = researchPlan.length
            ? '\n\n--- RESEARCH PLAN ---\n' + researchPlan.join('\n') + '\n--- END RESEARCH PLAN ---'
            : '';

          await sendEvent('research_plan', {
            method: researchMethod,
            plan: researchPlan,
            searchQueries,
            scope,
            evidenceStandard,
          });
        } catch (planError: any) {
          console.warn('Research planning stage failed; continuing with method guidance:', planError);
          researchPlan = [`Method: ${researchMethod}`, 'Planner unavailable; continue with explicit evidence/uncertainty checks.'];
          researchPlanContext = '\n\n--- RESEARCH PLAN ---\n' + researchPlan.join('\n') + '\n--- END RESEARCH PLAN ---';
          await sendEvent('notice', { message: 'Research planner unavailable. Continuing with the selected method.' });
        }

        let groundingContext = '';
        let discoveredSources: any[] = [];
        if (enableSearchGrounding) {
          await sendEvent('status', {
            message: `Grounding analysis with real-time web search (${searchEngine.toUpperCase()})...`,
          });

          try {
            const groundingResult = await performSearchGrounding(prompt, searchEngine as SearchEngineProvider, keys, env);
            if (groundingResult) {
              discoveredSources = groundingResult.results.map((r, idx) => {
                let domain = 'web-source';
                try {
                  domain = new URL(r.url).hostname.replace('www.', '');
                } catch {}
                const isPrimary = domain.endsWith('.org') || domain.endsWith('.gov') || domain.endsWith('.edu') || domain.includes('github') || domain.includes('apache') || domain.includes('arxiv');
                return {
                  id: `src-${idx + 1}`,
                  title: r.title,
                  url: r.url,
                  domain,
                  snippet: r.snippet,
                  isPrimary,
                  citationIndex: idx + 1,
                };
              });

              await sendEvent('search_grounding', {
                engine: groundingResult.engine,
                engineName: groundingResult.engineName,
                query: groundingResult.query,
                summary: groundingResult.summary || undefined,
                resultsCount: groundingResult.results.length,
                sources: discoveredSources,
              });

              if (groundingResult.results.length > 0 || groundingResult.summary) {
                const snippets = groundingResult.results
                  .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   "${r.snippet}"`)
                  .join('\n\n');

                groundingContext = `\n\n---
[VERIFIED REAL-TIME SEARCH GROUNDING - Source Engine: ${groundingResult.engineName}]
${groundingResult.summary ? `Summary / Answer: ${groundingResult.summary}\n` : ''}
Key Live Web Citations & Snippets:
${snippets}
---
Ground your technical architecture, critique, and trade-off claims in the above real-time empirical findings and citations.`;
              }
            }
          } catch (err: any) {
            console.warn('Search grounding error:', err);
          }
        }

        const groundedPrompt = `${prompt}${researchPlanContext}${groundingContext}${methodInstruction}${heartbeatContext ? `\n\n--- HEARTBEAT CHECKPOINT ---\n${heartbeatContext}\n--- END HEARTBEAT ---` : ''}`;

        if (effectiveProtocol === 'solo') {
          await sendEvent('round_start', {
            round: 1,
            role: 'solo',
            agentName: 'Solo Assistant',
            title: 'Lightweight Research & Analysis',
            provider: architectConfig.provider,
            model: architectConfig.model,
            description: 'Direct response to your query using a single active model and grounding resources.',
          });

          emitStatus('solo', 'Solo Assistant', 'Generating fast single-model analysis...');

          const soloSystemPrompt = `You are a helpful, expert technical research assistant. 
Your goal is to provide a comprehensive, clear, and logically sound response to the user's technical inquiry.
Directives:
1. FALSE PREMISE & ASSUMPTION DETECTION: If you detect any false premise or incorrect assumption, proactively address this directly at the very beginning under "Premise Correction".
${toneInstruction}${methodOutputInstruction}
Structure your response in clean Markdown with clear headings.`;

          let soloContent = '';
          const soloStart = Date.now();
          soloContent = await callAgentWithStream({
            provider: architectConfig.provider,
            model: architectConfig.model,
            apiKey: keys[architectConfig.provider],
            systemInstruction: soloSystemPrompt,
            userPrompt: groundedPrompt,
            temperature: 0.7,
            enableSearchGrounding: enableSearchGrounding,
            onChunk: (chunk) => {
              sendEvent('token', { round: 1, token: chunk });
            },
            onUsage: (usage) => emitUsage(1, usage),
            env,
          });

          await sendEvent('round_complete', {
            round: 1,
            role: 'solo',
            durationMs: Date.now() - soloStart,
            content: soloContent,
          });

          const totalDurationMs = Date.now() - startTime;
          const { evidenceGraph, researchMetrics } = await generateRealEvidenceGraph({
            prompt,
            finalSynthexis: soloContent,
            proposalContent: soloContent,
            critiqueContent: '',
            discoveredSources,
            researchPlan,
            durationMs: totalDurationMs,
            isSolo: true,
            apiKey: keys.gemini || env.GEMINI_API_KEY,
            env,
          });

          await sendEvent('evidence_graph', { evidenceGraph, researchMetrics });
          await sendEvent('complete', {
            finalOutput: soloContent,
            evidenceGraph,
            researchMetrics,
            usage: {
              inputTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.inputTokens || 0), 0),
              outputTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.outputTokens || 0), 0),
              totalTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.totalTokens || 0), 0),
              reasoningTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.reasoningTokens || 0), 0),
              estimated: false,
              byRound: usageByRound,
            },

            metrics: {
              durationMs: totalDurationMs,
              contentionLevel: 'None (Solo Inquiry)',
              resolvedPointsCount: 0,
            },
          });
          await writer.close();
          return;
        }

        // Standard Multi-Round Dialectic Research Flow
        // STAGE 1: ANALYST
        await sendEvent('round_start', {
          round: 1,
          role: 'architect',
          agentName: 'Analyst',
          title: 'Initial Proposal & Architecture',
          provider: architectConfig.provider,
          model: architectConfig.model,
          description: 'Constructs the technical proposal, data models, and trade-off foundations.',
        });

        emitStatus('architect', 'Analyst', 'Drafting initial solution proposal');
        await runHeartbeat(1, architectConfig, 'Analyst', 'Frame the question, stay inside scope, distinguish evidence from inference, and do not invent facts.', prompt);

        const architectSystemPrompt = `You are the **Lead Analyst** in a rigorous multi-model dialectical review pipeline.
Your objective is to propose a robust, production-grade technical solution or analysis for the user inquiry.
Directives:
1. Formulate a comprehensive first-principles solution with concrete architectural choices.
2. Outline key trade-offs and operational assumptions.
3. Be proactive about potential failure modes and state clearly what trade-offs you are making.
${toneInstruction}
Structure in clean Markdown with clear headings.`;

        let proposalContent = '';
        const round1Start = Date.now();
        proposalContent = await callAgentWithStream({
          provider: architectConfig.provider,
          model: architectConfig.model,
          apiKey: keys[architectConfig.provider],
          systemInstruction: architectSystemPrompt,
          userPrompt: groundedPrompt,
          temperature: 0.7,
          enableSearchGrounding: searchEngine === 'google',
          onChunk: (chunk) => {
            sendEvent('token', { round: 1, token: chunk });
          },
          onUsage: (usage) => emitUsage(1, usage),
          env,
          signal: req.signal,
        });

        const extractionConfig = getExtractionConfig(keys, env);

        await sendEvent('status', { message: 'Condensing Analyst proposal for model context...' });
        const proposalSummary = await summarizeStage(
          proposalContent,
          'Analyst (Proposal)',
          extractionConfig?.apiKey,
          env,
          extractionConfig?.provider as any,
          extractionConfig?.model
        );

        await sendEvent('round_complete', {
          round: 1,
          role: 'architect',
          durationMs: Date.now() - round1Start,
          content: proposalContent,
          summary: proposalSummary,
        });

        // STAGE 2: CRITIC
        await sendEvent('round_start', {
          round: 2,
          role: 'skeptic',
          agentName: 'Critic',
          title: 'Adversarial Review & Edge Cases',
          provider: skepticConfig.provider,
          model: skepticConfig.model,
          description: 'Audits assumptions, failure modes, scaling bottlenecks, and security vulnerabilities.',
        });

        emitStatus('skeptic', 'Critic', 'Auditing proposal for edge cases and failure modes');
        await runHeartbeat(2, skepticConfig, 'Critic', 'Challenge the proposal, search for unsupported claims, contradictions, and edge cases.', proposalContent);

        const skepticSystemPrompt = `You are the **Lead Critic** in a multi-model dialectical review pipeline.
Your objective is to stress-test the Analyst proposal for correctness, scaling limits, edge cases, and hidden assumptions.
${toneInstruction}
Structure with clear headings: Core Vulnerabilities, Edge Cases, and Concrete Recommendations.`;

        const skepticUserPrompt = `USER INQUIRY: ${prompt}

ANALYST PROPOSAL (CONDENSED):
${proposalSummary}

FULL PROPOSAL:
${proposalContent}

Stress-test this proposal rigorously. Identify genuine technical vulnerabilities, edge cases, and operational limits.`;

        let critiqueContent = '';
        const round2Start = Date.now();
        critiqueContent = await callAgentWithStream({
          provider: skepticConfig.provider,
          model: skepticConfig.model,
          apiKey: keys[skepticConfig.provider],
          systemInstruction: skepticSystemPrompt,
          userPrompt: skepticUserPrompt,
          temperature: skepticTemp,
          enableSearchGrounding: false,
          onChunk: (chunk) => {
            sendEvent('token', { round: 2, token: chunk });
          },
          onUsage: (usage) => emitUsage(2, usage),
          env,
          signal: req.signal,
        });

        await sendEvent('status', { message: 'Condensing Critic review for model context...' });
        const critiqueSummary = await summarizeStage(
          critiqueContent,
          'Critic (Red-Team)',
          extractionConfig?.apiKey,
          env,
          extractionConfig?.provider as any,
          extractionConfig?.model
        );

        await sendEvent('round_complete', {
          round: 2,
          role: 'skeptic',
          durationMs: Date.now() - round2Start,
          content: critiqueContent,
          summary: critiqueSummary,
        });

        let verifierContent = '';
        let verifierSummary = '';

        // Execute Verifier Stage ONLY IF effectiveProtocol is 'quad' or default (Deep Mode)
        if (effectiveProtocol === 'quad' || effectiveProtocol === 'deep') {
          const verifierRoundNum = 3;
          await sendEvent('round_start', {
            round: verifierRoundNum,
            role: 'verifier',
            agentName: 'Verifier',
            title: 'Factual & Constraint Verification',
            provider: verifierConfig.provider,
            model: verifierConfig.model,
            description: 'Audits claims for empirical validity, constraint violations, and factual precision.',
          });

          emitStatus('verifier', 'Verifier', 'Verifying facts, math, and constraints across proposal and critique');
          await runHeartbeat(verifierRoundNum, verifierConfig, 'Verifier', 'Verify important claims and constraints; mark uncertainty instead of guessing.', `${proposalSummary}\n${critiqueSummary}`);

          const verifierSystemPrompt = `You are the **Lead Verifier** in a multi-model dialectical review pipeline.
Your objective is to independently verify claims, math, benchmarks, and constraint assumptions across the Analyst proposal and Critic review.
Structure your audit in clear Markdown:
### Verified Facts & Constraints
### Unsubstantiated Claims / Risk Assumptions
### Recommended Adjustments`;

          const verifierUserPrompt = `USER INQUIRY: ${prompt}

ANALYST PROPOSAL (CONDENSED):
${proposalSummary}

CRITIC REVIEW (CONDENSED):
${critiqueSummary}

Perform rigorous empirical and constraint verification on these analyses.`;

          const roundVerifierStart = Date.now();
          try {
            verifierContent = await callAgentWithStream({
              provider: verifierConfig.provider,
              model: verifierConfig.model,
              apiKey: keys[verifierConfig.provider],
              systemInstruction: verifierSystemPrompt,
              userPrompt: verifierUserPrompt,
              temperature: 0.3,
              enableSearchGrounding: false,
              onChunk: (chunk) => {
                sendEvent('token', { round: verifierRoundNum, token: chunk });
              },
              onUsage: (usage) => emitUsage(verifierRoundNum, usage),
              env,
              signal: req.signal,
            });
          } catch (err: any) {
            const errMsg = err?.message || 'API error or connection timeout';
            console.warn(`[Verifier Stage Error] ${verifierConfig.provider}/${verifierConfig.model} failed:`, errMsg);
            verifierContent = `*Verifier Stage Notice: Independent verification model (${verifierConfig.provider}/${verifierConfig.model}) was unavailable (${errMsg}). Final synthexis proceeded directly with Analyst and Critic outputs.*`;
            
            await sendEvent('stage_warning', {
              round: verifierRoundNum,
              role: 'verifier',
              message: `Verifier model (${verifierConfig.provider}) unavailable: ${errMsg}. Synthexis proceeded without independent verification.`,
            });
          }

          verifierSummary = await summarizeStage(
            verifierContent,
            'Verifier (Audit)',
            extractionConfig?.apiKey,
            env,
            extractionConfig?.provider as any,
            extractionConfig?.model
          );

          await sendEvent('round_complete', {
            round: verifierRoundNum,
            role: 'verifier',
            durationMs: Date.now() - roundVerifierStart,
            content: verifierContent,
            summary: verifierSummary,
          });
        }

        // SYNTHESIZER (Final Resolution)
        const finalRoundNum = (effectiveProtocol === 'quad' || effectiveProtocol === 'deep') ? 4 : 3;
        await sendEvent('round_start', {
          round: finalRoundNum,
          role: 'arbiter',
          agentName: 'Synthesizer',
          title: 'Final Executive Resolution',
          provider: arbiterConfig.provider,
          model: arbiterConfig.model,
          description: 'Synthesizes the definitive resolution, integrating all validated mitigations and boundaries.',
        });

        emitStatus('arbiter', 'Synthesizer', 'Synthesizing final executive resolution');
        await runHeartbeat(finalRoundNum, arbiterConfig, 'Synthesizer', 'Resolve the evidence without forcing agreement; preserve contradictions and uncertainty.', `${proposalSummary}\n${critiqueSummary}\n${verifierSummary}`);

        const arbiterSystemPrompt = `You are the **Lead Synthesizer** in a multi-model dialectical review pipeline.
Your objective is to produce the final, definitive synthesized response for the user inquiry.
Directives:
1. Review the Analyst's proposal, the Critic's red-teaming${verifierSummary ? ', and the Verifier\'s empirical audit' : ''}.
2. Adjudicate impartially: thoroughly integrate mitigations for every genuine edge case.
3. Deliver a comprehensive, high-caliber, practical solution.
4. Clearly specify operational boundaries and limitations: state candidly when NOT to use this approach.
5. SYNTHEXIS CRITERIA: Ensure the synthexis has at least ${agreementThreshold}% logical consistency and factual alignment between model claims.
6. CONTRADICTION STRATEGY: ${autoResolve ? 'Auto-resolve opposing claims by identifying empirical common ground and technical synthexis.' : 'Do not auto-resolve: clearly list any unresolved disagreements and contradictory viewpoints under a separate "Unresolved Contradictions" section.'}
${toneInstruction}
Structure your response in clean Markdown with clear headings.`;

        const arbiterUserPrompt = `USER INQUIRY: ${prompt}

---
STAGE 1 - ANALYST PROPOSAL:
${proposalContent}

---
STAGE 2 - CRITIC REVIEW (CONDENSED):
${critiqueSummary}
${verifierSummary ? `\n---\nSTAGE 3 - VERIFIER AUDIT (CONDENSED):\n${verifierSummary}` : ''}

Synthesize the final, definitive, high-integrity answer for the user.`;

        let finalSynthexis = '';
        const finalRoundStart = Date.now();
        finalSynthexis = await callAgentWithStream({
          provider: arbiterConfig.provider,
          model: arbiterConfig.model,
          apiKey: keys[arbiterConfig.provider],
          systemInstruction: arbiterSystemPrompt,
          userPrompt: arbiterUserPrompt,
          temperature: arbiterTemp,
          enableSearchGrounding: false,
          onChunk: (chunk) => {
            sendEvent('token', { round: finalRoundNum, token: chunk });
          },
          onUsage: (usage) => emitUsage(finalRoundNum, usage),
          env,
          signal: req.signal,
        });

        await sendEvent('round_complete', {
          round: finalRoundNum,
          role: 'arbiter',
          durationMs: Date.now() - finalRoundStart,
          content: finalSynthexis,
        });

        const totalDurationMs = Date.now() - startTime;
        await sendEvent('status', { message: 'Auditing factual claims and building evidence graph...' });

        const { evidenceGraph, researchMetrics } = await generateRealEvidenceGraph({
          prompt,
          finalSynthexis,
          proposalContent,
          critiqueContent: critiqueSummary || '',
          discoveredSources,
          durationMs: totalDurationMs,
          apiKey: extractionConfig?.apiKey,
          env,
          provider: extractionConfig?.provider as any,
          model: extractionConfig?.model,
        });

        await sendEvent('evidence_graph', { evidenceGraph, researchMetrics });
        await sendEvent('complete', {
          finalOutput: finalSynthexis,
          evidenceGraph,
          researchMetrics,
          usage: {
            inputTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.inputTokens || 0), 0),
            outputTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.outputTokens || 0), 0),
            totalTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.totalTokens || 0), 0),
            reasoningTokens: Object.values(usageByRound).reduce((sum: number, u: any) => sum + (u.reasoningTokens || 0), 0),
            estimated: false,
            byRound: usageByRound,
          },
          metrics: {
            durationMs: totalDurationMs,
            contentionLevel: researchMetrics.claimsContradicted > 0 ? 'Moderate' : 'Low',
            resolvedPointsCount: researchMetrics.claimsSupported,
          },
        });
      } catch (err: any) {
        console.error('Debate pipeline error:', err);
        await sendEvent('error', {
          message: err.message || 'An unexpected error occurred during debate deliberation.',
        });
      } finally {
        try {
          await writer.close();
        } catch {}
      }
    })();

    const cors = getCorsHeaders(req, env);
    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...cors,
      },
    });
  }

  return createJsonResponse({ error: 'Endpoint not found', path }, 404, req, env);
}
