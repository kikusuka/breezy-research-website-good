/**
 * Owner-scoped durable chat persistence for the canonical Cloudflare Worker.
 *
 * This module intentionally returns a clear unavailable response until a real D1
 * binding is configured. It never falls back to another backend's database.
 */
import type { BackendEnv, D1DatabaseBinding } from './types';
import { createJsonResponse } from './router';

const MAX_TITLE = 300;
const MAX_PROMPT = 20_000;
const MAX_OUTPUT = 2_000_000;
const MAX_PAGE_SIZE = 100;
const TERMINAL = new Set(['completed', 'interrupted', 'failed', 'cancelled']);

function jsonError(req: Request, env: BackendEnv, status: number, code: string, error: string) {
  return createJsonResponse({ ok: false, code, error }, status, req, env);
}

function dbFrom(env: BackendEnv): D1DatabaseBinding | null {
  return env.DB && typeof env.DB === 'object' ? env.DB : null;
}

function safeId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

function titleFromPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, MAX_TITLE) || 'New chat';
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function handleChatPersistenceRequest(
  req: Request,
  env: BackendEnv,
  ownerUid: string
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith('/api/chat/')) return null;

  const db = dbFrom(env);
  if (!db) {
    return jsonError(req, env, 503, 'CHAT_PERSISTENCE_UNAVAILABLE', 'Durable chat history is not configured on this backend yet. Your existing local chat remains separate.');
  }

  const root = '/api/chat/conversations';
  const now = Date.now();

  if (path === root && req.method === 'GET') {
    const rawLimit = Number(url.searchParams.get('limit') || 30);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))) : 30;
    const cursor = Number(url.searchParams.get('before') || 0);
    const result = cursor > 0
      ? await db.prepare(
          'SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE owner_uid = ? AND deleted_at IS NULL AND updated_at < ? ORDER BY updated_at DESC LIMIT ?'
        ).bind(ownerUid, cursor, limit).all()
      : await db.prepare(
          'SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE owner_uid = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?'
        ).bind(ownerUid, limit).all();
    return createJsonResponse({ ok: true, conversations: result.results || [], limit }, 200, req, env);
  }

  if (path === root && req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return jsonError(req, env, 400, 'INVALID_JSON', 'Send a valid JSON object.');
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE) : 'New chat';
    const id = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO conversations (id, owner_uid, title, created_at, updated_at, last_message_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL, NULL)'
    ).bind(id, ownerUid, title || 'New chat', now, now).run();
    return createJsonResponse({ ok: true, conversation: { id, title: title || 'New chat', created_at: now, updated_at: now, last_message_at: null } }, 201, req, env);
  }

  const runMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)\/runs$/);
  if (runMatch && req.method === 'POST') {
    const conversationId = decodeURIComponent(runMatch[1]);
    if (!safeId(conversationId)) return jsonError(req, env, 400, 'INVALID_CONVERSATION_ID', 'The conversation ID is invalid.');
    const body = await readJson(req);
    if (!body) return jsonError(req, env, 400, 'INVALID_JSON', 'Send a valid JSON object.');
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!prompt || prompt.length > MAX_PROMPT) return jsonError(req, env, 400, 'INVALID_PROMPT', 'Prompt must contain 1–200,000 characters.');
    if (!idempotencyKey || idempotencyKey.length > 128) return jsonError(req, env, 400, 'INVALID_IDEMPOTENCY_KEY', 'A unique idempotency key of at most 128 characters is required.');

    const conversation = await db.prepare(
      'SELECT id, title FROM conversations WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
    ).bind(conversationId, ownerUid).first<{ id: string; title: string }>();
    if (!conversation) return jsonError(req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');

    const existing = await db.prepare(
      'SELECT id, conversation_id, initiating_message_id, status, created_at, updated_at, partial_output FROM chat_runs WHERE owner_uid = ? AND idempotency_key = ?'
    ).bind(ownerUid, idempotencyKey).first<Record<string, unknown>>();
    if (existing) return createJsonResponse({ ok: true, run: existing, duplicate: true }, 200, req, env);

    const messageId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const sequence = await db.prepare(
      'SELECT COALESCE(MAX(sequence_no), -1) + 1 AS next_sequence FROM chat_messages WHERE conversation_id = ? AND owner_uid = ?'
    ).bind(conversationId, ownerUid).first<{ next_sequence: number }>();
    const sequenceNo = Number(sequence?.next_sequence ?? 0);
    const provider = typeof body.provider === 'string' ? body.provider.slice(0, 64) : null;
    const model = typeof body.model === 'string' ? body.model.slice(0, 200) : null;

    await db.batch([
      db.prepare(
        'INSERT INTO chat_messages (id, conversation_id, owner_uid, sequence_no, role, content, status, created_at, provider, model) VALUES (?, ?, ?, ?, \'user\', ?, \'complete\', ?, ?, ?)'
      ).bind(messageId, conversationId, ownerUid, sequenceNo, prompt, now, provider, model),
      db.prepare(
        'UPDATE conversations SET updated_at = ?, last_message_at = ?, title = CASE WHEN title = \'New chat\' THEN ? ELSE title END WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
      ).bind(now, now, titleFromPrompt(prompt), conversationId, ownerUid),
      db.prepare(
        'INSERT INTO chat_runs (id, conversation_id, owner_uid, initiating_message_id, status, created_at, updated_at, finished_at, cancel_requested_at, partial_output, error_code, error_message, idempotency_key, retry_of_run_id) VALUES (?, ?, ?, ?, \'queued\', ?, ?, NULL, NULL, \'\', NULL, NULL, ?, NULL)'
      ).bind(runId, conversationId, ownerUid, messageId, now, now, idempotencyKey),
    ]);

    return createJsonResponse({
      ok: true,
      run: { id: runId, conversation_id: conversationId, initiating_message_id: messageId, status: 'queued', created_at: now, updated_at: now, partial_output: '' },
      message: { id: messageId, conversation_id: conversationId, role: 'user', content: prompt, sequence_no: sequenceNo, status: 'complete', created_at: now, provider, model },
    }, 201, req, env);
  }

  const messagesMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch && req.method === 'GET') {
    const conversationId = decodeURIComponent(messagesMatch[1]);
    if (!safeId(conversationId)) return jsonError(req, env, 400, 'INVALID_CONVERSATION_ID', 'The conversation ID is invalid.');
    const rawLimit = Number(url.searchParams.get('limit') || 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))) : 50;
    const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
    const conversation = await db.prepare(
      'SELECT id FROM conversations WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
    ).bind(conversationId, ownerUid).first();
    if (!conversation) return jsonError(req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
    const result = await db.prepare(
      'SELECT id, conversation_id, sequence_no, role, content, status, created_at, provider, model FROM chat_messages WHERE conversation_id = ? AND owner_uid = ? AND sequence_no < ? ORDER BY sequence_no DESC LIMIT ?'
    ).bind(conversationId, ownerUid, Number.isFinite(before) ? before : Number.MAX_SAFE_INTEGER, limit).all();
    return createJsonResponse({ ok: true, messages: (result.results || []).reverse(), limit }, 200, req, env);
  }

  const conversationMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)$/);
  if (conversationMatch) {
    const conversationId = decodeURIComponent(conversationMatch[1]);
    if (!safeId(conversationId)) return jsonError(req, env, 400, 'INVALID_CONVERSATION_ID', 'The conversation ID is invalid.');
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (!body || typeof body.title !== 'string') return jsonError(req, env, 400, 'INVALID_TITLE', 'A conversation title is required.');
      const title = body.title.trim();
      if (!title || title.length > MAX_TITLE) return jsonError(req, env, 400, 'INVALID_TITLE', 'Title must contain 1–300 characters.');
      const result = await db.prepare(
        'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
      ).bind(title, now, conversationId, ownerUid).run();
      if (!result.meta?.changes) return jsonError(req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
      return createJsonResponse({ ok: true, id: conversationId, title, updated_at: now }, 200, req, env);
    }
    if (req.method === 'DELETE') {
      const result = await db.prepare(
        'UPDATE conversations SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
      ).bind(now, now, conversationId, ownerUid).run();
      if (!result.meta?.changes) return jsonError(req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
      return createJsonResponse({ ok: true, id: conversationId, deleted_at: now }, 200, req, env);
    }
  }

  const runMatchById = path.match(/^\/api\/chat\/runs\/([^/]+)$/);
  if (runMatchById && req.method === 'GET') {
    const runId = decodeURIComponent(runMatchById[1]);
    if (!safeId(runId)) return jsonError(req, env, 400, 'INVALID_RUN_ID', 'The run ID is invalid.');
    const run = await db.prepare(
      'SELECT id, conversation_id, initiating_message_id, status, created_at, updated_at, finished_at, partial_output, error_code, error_message, retry_of_run_id FROM chat_runs WHERE id = ? AND owner_uid = ?'
    ).bind(runId, ownerUid).first();
    if (!run) return jsonError(req, env, 404, 'RUN_NOT_FOUND', 'This run does not exist or is not available to this account.');
    return createJsonResponse({ ok: true, run }, 200, req, env);
  }

  const checkpointMatch = path.match(/^\/api\/chat\/runs\/([^/]+)\/checkpoint$/);
  if (checkpointMatch && req.method === 'POST') {
    const runId = decodeURIComponent(checkpointMatch[1]);
    if (!safeId(runId)) return jsonError(req, env, 400, 'INVALID_RUN_ID', 'The run ID is invalid.');
    const body = await readJson(req);
    if (!body) return jsonError(req, env, 400, 'INVALID_JSON', 'Send a valid JSON object.');
    const partialOutput = typeof body.partialOutput === 'string' ? body.partialOutput : '';
    const status = typeof body.status === 'string' ? body.status : 'running';
    const errorCode = typeof body.errorCode === 'string' ? body.errorCode.slice(0, 100) : null;
    const errorMessage = typeof body.errorMessage === 'string' ? body.errorMessage.slice(0, 1000) : null;
    if (partialOutput.length > MAX_OUTPUT) return jsonError(req, env, 413, 'OUTPUT_TOO_LARGE', 'The saved output exceeds the 2,000,000-character limit.');
    if (!['running', ...TERMINAL].includes(status)) return jsonError(req, env, 400, 'INVALID_RUN_STATUS', 'Run status is invalid.');

    const run = await db.prepare(
      'SELECT id, conversation_id, status, partial_output FROM chat_runs WHERE id = ? AND owner_uid = ?'
    ).bind(runId, ownerUid).first<{ id: string; conversation_id: string; status: string; partial_output: string }>();
    if (!run) return jsonError(req, env, 404, 'RUN_NOT_FOUND', 'This run does not exist or is not available to this account.');
    if (TERMINAL.has(run.status)) return createJsonResponse({ ok: true, run, alreadyTerminal: true }, 200, req, env);

    const now = Date.now();
    const terminal = TERMINAL.has(status);
    const output = partialOutput || run.partial_output || '';
    const assistantId = terminal && output ? crypto.randomUUID() : null;
    const seq = assistantId ? await db.prepare(
      'SELECT COALESCE(MAX(sequence_no), -1) + 1 AS next_sequence FROM chat_messages WHERE conversation_id = ? AND owner_uid = ?'
    ).bind(run.conversation_id, ownerUid).first<{ next_sequence: number }>() : null;
    const sequenceNo = Number(seq?.next_sequence ?? 0);
    const statements = [];
    if (assistantId) {
      statements.push(db.prepare(
        'INSERT INTO chat_messages (id, conversation_id, owner_uid, sequence_no, role, content, status, created_at, provider, model) SELECT ?, conversation_id, owner_uid, ?, \'assistant\', ?, ?, ?, NULL, NULL FROM chat_runs WHERE id = ? AND owner_uid = ? AND status IN (\'queued\', \'running\')'
      ).bind(assistantId, sequenceNo, output, status === 'completed' ? 'complete' : 'partial', now, runId, ownerUid));
    }
    statements.push(db.prepare(
      'UPDATE chat_runs SET status = ?, updated_at = ?, finished_at = ?, partial_output = ?, error_code = ?, error_message = ? WHERE id = ? AND owner_uid = ? AND status IN (\'queued\', \'running\')'
    ).bind(status, now, terminal ? now : null, output, errorCode, errorMessage, runId, ownerUid));
    if (terminal && output) {
      statements.push(db.prepare(
        'UPDATE conversations SET updated_at = ?, last_message_at = ? WHERE id = (SELECT conversation_id FROM chat_runs WHERE id = ? AND owner_uid = ?) AND owner_uid = ? AND deleted_at IS NULL'
      ).bind(now, now, runId, ownerUid, ownerUid));
    }
    await db.batch(statements);
    const updated = await db.prepare(
      'SELECT id, conversation_id, initiating_message_id, status, created_at, updated_at, finished_at, partial_output, error_code, error_message, retry_of_run_id FROM chat_runs WHERE id = ? AND owner_uid = ?'
    ).bind(runId, ownerUid).first();
    return createJsonResponse({ ok: true, run: updated }, 200, req, env);
  }

  return jsonError(req, env, 404, 'CHAT_ROUTE_NOT_FOUND', 'The requested chat persistence route does not exist.');
}
