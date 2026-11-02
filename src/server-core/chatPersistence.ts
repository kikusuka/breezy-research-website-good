/**
 * Owner-scoped durable chat persistence for the canonical Cloudflare Worker.
 *
 * This module intentionally returns a clear unavailable response until a real D1
 * binding is configured. It never falls back to another backend's database.
 */
import type { BackendEnv, D1DatabaseBinding } from './types';

const MAX_TITLE = 300;
const MAX_PROMPT = 20_000;
const MAX_OUTPUT = 2_000_000;
const MAX_PAGE_SIZE = 100;
/** Default per-account cap on stored message text. Override with the STORAGE_LIMIT_BYTES variable. */
export const DEFAULT_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const TERMINAL = new Set(['completed', 'interrupted', 'failed', 'cancelled']);

type JsonResponseFactory = (data: unknown, status?: number, req?: Request, env?: BackendEnv) => Response;

function jsonError(respond: JsonResponseFactory, req: Request, env: BackendEnv, status: number, code: string, error: string) {
  return respond({ ok: false, code, error }, status, req, env);
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

export function storageLimitBytes(env: BackendEnv): number {
  const raw = Number(typeof env.STORAGE_LIMIT_BYTES === 'string' ? env.STORAGE_LIMIT_BYTES : NaN);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_STORAGE_LIMIT_BYTES;
}

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

async function usedBytes(db: D1DatabaseBinding, ownerUid: string): Promise<number> {
  const row = await db.prepare('SELECT bytes FROM storage_usage WHERE owner_uid = ?').bind(ownerUid).first<{ bytes: number }>();
  return Math.max(0, Number(row?.bytes ?? 0));
}

const addUsage = (db: D1DatabaseBinding, ownerUid: string, delta: number, now: number) => db.prepare(
  'INSERT INTO storage_usage (owner_uid, bytes, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_uid) DO UPDATE SET bytes = bytes + excluded.bytes, updated_at = excluded.updated_at'
).bind(ownerUid, delta, now);

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
  ownerUid: string,
  respond: JsonResponseFactory
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith('/api/chat/')) return null;

  const db = dbFrom(env);
  if (!db) {
    return jsonError(respond, req, env, 503, 'CHAT_PERSISTENCE_UNAVAILABLE', 'Durable chat history is not configured on this backend yet. Your existing local chat remains separate.');
  }

  if (path === '/api/chat/storage' && req.method === 'GET') {
    const used = await usedBytes(db, ownerUid);
    const limit = storageLimitBytes(env);
    return respond({ ok: true, usedBytes: used, limitBytes: limit, remainingBytes: Math.max(0, limit - used), full: used >= limit }, 200, req, env);
  }

  // Largest conversations first, so a full account can see what to delete.
  if (path === '/api/chat/storage/conversations' && req.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), MAX_PAGE_SIZE);
    const result = await db.prepare(
      'SELECT c.id, c.title, c.updated_at, COALESCE(SUM(LENGTH(CAST(m.content AS BLOB))), 0) AS bytes FROM conversations c LEFT JOIN chat_messages m ON m.conversation_id = c.id AND m.owner_uid = c.owner_uid WHERE c.owner_uid = ? AND c.deleted_at IS NULL GROUP BY c.id ORDER BY bytes DESC, c.updated_at DESC LIMIT ?'
    ).bind(ownerUid, limit).all();
    return respond({ ok: true, conversations: result.results || [], limit }, 200, req, env);
  }

  const root = '/api/chat/conversations';
  const now = Date.now();

  if (path === root && req.method === 'GET') {
    const rawLimit = Number(url.searchParams.get('limit') || 30);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))) : 30;
    const beforeRaw = url.searchParams.get('before') || '';
    const cursor = Number(beforeRaw);
    const beforeId = url.searchParams.get('beforeId') || '';
    const hasStableCursor = Number.isFinite(cursor) && cursor > 0 && safeId(beforeId);
    const result = hasStableCursor
      ? await db.prepare(
          'SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE owner_uid = ? AND deleted_at IS NULL AND (updated_at < ? OR (updated_at = ? AND id < ?)) ORDER BY updated_at DESC, id DESC LIMIT ?'
        ).bind(ownerUid, cursor, cursor, beforeId, limit).all()
      : Number.isFinite(cursor) && cursor > 0
        ? await db.prepare(
            'SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE owner_uid = ? AND deleted_at IS NULL AND updated_at < ? ORDER BY updated_at DESC, id DESC LIMIT ?'
          ).bind(ownerUid, cursor, limit).all()
        : await db.prepare(
            'SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE owner_uid = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT ?'
          ).bind(ownerUid, limit).all();
    const conversations = result.results || [];
    const last = conversations[conversations.length - 1] as { id?: string; updated_at?: number } | undefined;
    return respond({
      ok: true,
      conversations,
      limit,
      nextCursor: conversations.length === limit && last?.id && typeof last.updated_at === 'number'
        ? { before: last.updated_at, beforeId: last.id }
        : null,
    }, 200, req, env);
  }

  if (path === root && req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return jsonError(respond, req, env, 400, 'INVALID_JSON', 'Send a valid JSON object.');
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE) : 'New chat';
    const id = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO conversations (id, owner_uid, title, created_at, updated_at, last_message_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL, NULL)'
    ).bind(id, ownerUid, title || 'New chat', now, now).run();
    return respond({ ok: true, conversation: { id, title: title || 'New chat', created_at: now, updated_at: now, last_message_at: null } }, 201, req, env);
  }

  const runMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)\/runs$/);
  if (runMatch && req.method === 'POST') {
    const conversationId = decodeURIComponent(runMatch[1]);
    if (!safeId(conversationId)) return jsonError(respond, req, env, 400, 'INVALID_CONVERSATION_ID', 'The conversation ID is invalid.');
    const body = await readJson(req);
    if (!body) return jsonError(respond, req, env, 400, 'INVALID_JSON', 'Send a valid JSON object.');
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!prompt || prompt.length > MAX_PROMPT) return jsonError(respond, req, env, 400, 'INVALID_PROMPT', 'Prompt must contain 1–20,000 characters.');
    if (!idempotencyKey || idempotencyKey.length > 128) return jsonError(respond, req, env, 400, 'INVALID_IDEMPOTENCY_KEY', 'A unique idempotency key of at most 128 characters is required.');

    const conversation = await db.prepare(
      'SELECT id, title FROM conversations WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
    ).bind(conversationId, ownerUid).first<{ id: string; title: string }>();
    if (!conversation) return jsonError(respond, req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');

    const existing = await db.prepare(
      'SELECT id, conversation_id, initiating_message_id, status, created_at, updated_at, partial_output FROM chat_runs WHERE owner_uid = ? AND idempotency_key = ?'
    ).bind(ownerUid, idempotencyKey).first<Record<string, unknown>>();
    if (existing) return respond({ ok: true, run: existing, duplicate: true }, 200, req, env);

    const incomingBytes = byteLength(prompt);
    const usedNow = await usedBytes(db, ownerUid);
    const limitNow = storageLimitBytes(env);
    if (usedNow + incomingBytes > limitNow) {
      return respond({
        ok: false, code: 'STORAGE_QUOTA_EXCEEDED',
        error: 'Your Breezy server storage is full. Delete conversations or connect your own storage to keep saving.',
        usedBytes: usedNow, limitBytes: limitNow,
      }, 413, req, env);
    }

    const messageId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    // Allocate the sequence atomically. A MAX(sequence_no) read followed by a later
    // insert can collide when two tabs send messages at the same time.
    const sequence = await db.prepare(
      'UPDATE conversations SET next_sequence = next_sequence + 1 WHERE id = ? AND owner_uid = ? RETURNING next_sequence - 1 AS sequence_no'
    ).bind(conversationId, ownerUid).first<{ sequence_no: number }>();
    if (!sequence) return jsonError(respond, req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
    const sequenceNo = Number(sequence.sequence_no);
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
      addUsage(db, ownerUid, incomingBytes, now),
    ]);

    return respond({
      ok: true,
      run: { id: runId, conversation_id: conversationId, initiating_message_id: messageId, status: 'queued', created_at: now, updated_at: now, partial_output: '' },
      message: { id: messageId, conversation_id: conversationId, role: 'user', content: prompt, sequence_no: sequenceNo, status: 'complete', created_at: now, provider, model },
    }, 201, req, env);
  }

  const messagesMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch && req.method === 'GET') {
    const conversationId = decodeURIComponent(messagesMatch[1]);
    if (!safeId(conversationId)) return jsonError(respond, req, env, 400, 'INVALID_CONVERSATION_ID', 'The conversation ID is invalid.');
    const rawLimit = Number(url.searchParams.get('limit') || 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))) : 50;
    const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
    const conversation = await db.prepare(
      'SELECT id FROM conversations WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
    ).bind(conversationId, ownerUid).first();
    if (!conversation) return jsonError(respond, req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
    const result = await db.prepare(
      'SELECT id, conversation_id, sequence_no, role, content, status, created_at, provider, model FROM chat_messages WHERE conversation_id = ? AND owner_uid = ? AND sequence_no < ? ORDER BY sequence_no DESC LIMIT ?'
    ).bind(conversationId, ownerUid, Number.isFinite(before) ? before : Number.MAX_SAFE_INTEGER, limit).all();
    return respond({ ok: true, messages: (result.results || []).reverse(), limit }, 200, req, env);
  }

  const conversationMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)$/);
  if (conversationMatch) {
    const conversationId = decodeURIComponent(conversationMatch[1]);
    if (!safeId(conversationId)) return jsonError(respond, req, env, 400, 'INVALID_CONVERSATION_ID', 'The conversation ID is invalid.');
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (!body || typeof body.title !== 'string') return jsonError(respond, req, env, 400, 'INVALID_TITLE', 'A conversation title is required.');
      const title = body.title.trim();
      if (!title || title.length > MAX_TITLE) return jsonError(respond, req, env, 400, 'INVALID_TITLE', 'Title must contain 1–300 characters.');
      const result = await db.prepare(
        'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND owner_uid = ? AND deleted_at IS NULL'
      ).bind(title, now, conversationId, ownerUid).run();
      if (!result.meta?.changes) return jsonError(respond, req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
      return respond({ ok: true, id: conversationId, title, updated_at: now }, 200, req, env);
    }
    if (req.method === 'DELETE') {
      // Hard delete: the user asked for the data to go, and quota is only freed if the rows are really removed.
      const owned = await db.prepare(
        'SELECT c.id AS id, COALESCE(SUM(LENGTH(CAST(m.content AS BLOB))), 0) AS bytes FROM conversations c LEFT JOIN chat_messages m ON m.conversation_id = c.id AND m.owner_uid = c.owner_uid WHERE c.id = ? AND c.owner_uid = ? GROUP BY c.id'
      ).bind(conversationId, ownerUid).first<{ id: string; bytes: number }>();
      if (!owned) return jsonError(respond, req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
      const freed = Math.max(0, Number(owned.bytes) || 0);
      await db.batch([
        // Clear retry links first so the RESTRICT foreign key cannot block the cascade.
        db.prepare('UPDATE chat_runs SET retry_of_run_id = NULL WHERE conversation_id = ? AND owner_uid = ?').bind(conversationId, ownerUid),
        db.prepare('DELETE FROM conversations WHERE id = ? AND owner_uid = ?').bind(conversationId, ownerUid),
        db.prepare('UPDATE storage_usage SET bytes = MAX(0, bytes - ?), updated_at = ? WHERE owner_uid = ?').bind(freed, now, ownerUid),
      ]);
      return respond({ ok: true, id: conversationId, freedBytes: freed }, 200, req, env);
    }
  }

  const runMatchById = path.match(/^\/api\/chat\/runs\/([^/]+)$/);
  if (runMatchById && req.method === 'GET') {
    const runId = decodeURIComponent(runMatchById[1]);
    if (!safeId(runId)) return jsonError(respond, req, env, 400, 'INVALID_RUN_ID', 'The run ID is invalid.');
    const run = await db.prepare(
      'SELECT id, conversation_id, initiating_message_id, status, created_at, updated_at, finished_at, partial_output, error_code, error_message, retry_of_run_id FROM chat_runs WHERE id = ? AND owner_uid = ?'
    ).bind(runId, ownerUid).first();
    if (!run) return jsonError(respond, req, env, 404, 'RUN_NOT_FOUND', 'This run does not exist or is not available to this account.');
    return respond({ ok: true, run }, 200, req, env);
  }

  const checkpointMatch = path.match(/^\/api\/chat\/runs\/([^/]+)\/checkpoint$/);
  if (checkpointMatch && req.method === 'POST') {
    const runId = decodeURIComponent(checkpointMatch[1]);
    if (!safeId(runId)) return jsonError(respond, req, env, 400, 'INVALID_RUN_ID', 'The run ID is invalid.');
    const body = await readJson(req);
    if (!body) return jsonError(respond, req, env, 400, 'INVALID_JSON', 'Send a valid JSON object.');
    const partialOutput = typeof body.partialOutput === 'string' ? body.partialOutput : '';
    const status = typeof body.status === 'string' ? body.status : 'running';
    const errorCode = typeof body.errorCode === 'string' ? body.errorCode.slice(0, 100) : null;
    const errorMessage = typeof body.errorMessage === 'string' ? body.errorMessage.slice(0, 1000) : null;
    if (partialOutput.length > MAX_OUTPUT) return jsonError(respond, req, env, 413, 'OUTPUT_TOO_LARGE', 'The saved output exceeds the 2,000,000-character limit.');
    if (!['running', ...TERMINAL].includes(status)) return jsonError(respond, req, env, 400, 'INVALID_RUN_STATUS', 'Run status is invalid.');

    const run = await db.prepare(
      'SELECT id, conversation_id, status, partial_output FROM chat_runs WHERE id = ? AND owner_uid = ?'
    ).bind(runId, ownerUid).first<{ id: string; conversation_id: string; status: string; partial_output: string }>();
    if (!run) return jsonError(respond, req, env, 404, 'RUN_NOT_FOUND', 'This run does not exist or is not available to this account.');
    if (TERMINAL.has(run.status)) return respond({ ok: true, run, alreadyTerminal: true }, 200, req, env);

    const now = Date.now();
    const terminal = TERMINAL.has(status);
    const output = partialOutput || run.partial_output || '';
    const assistantId = terminal && output ? crypto.randomUUID() : null;
    const seq = assistantId ? await db.prepare(
      'UPDATE conversations SET next_sequence = next_sequence + 1 WHERE id = ? AND owner_uid = ? RETURNING next_sequence - 1 AS sequence_no'
    ).bind(run.conversation_id, ownerUid).first<{ sequence_no: number }>() : null;
    if (assistantId && !seq) return jsonError(respond, req, env, 404, 'CONVERSATION_NOT_FOUND', 'This conversation does not exist or is not available to this account.');
    const sequenceNo = Number(seq?.sequence_no ?? 0);
    const statements = [];
    if (assistantId) {
      statements.push(db.prepare(
        'INSERT INTO chat_messages (id, conversation_id, owner_uid, sequence_no, role, content, status, created_at, provider, model) SELECT ?, conversation_id, owner_uid, ?, \'assistant\', ?, ?, ?, NULL, NULL FROM chat_runs WHERE id = ? AND owner_uid = ? AND status IN (\'queued\', \'running\')'
      ).bind(assistantId, sequenceNo, output, status === 'completed' ? 'complete' : 'partial', now, runId, ownerUid));
    }
    if (assistantId) statements.push(addUsage(db, ownerUid, byteLength(output), now));
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
    return respond({ ok: true, run: updated }, 200, req, env);
  }

  return jsonError(respond, req, env, 404, 'CHAT_ROUTE_NOT_FOUND', 'The requested chat persistence route does not exist.');
}
