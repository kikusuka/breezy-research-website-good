-- Breezy durable chat history — initial Cloudflare D1/SQLite schema.
-- Apply only after the D1 binding and migration process are configured.
-- Every child row carries owner_uid and uses a composite foreign key so a row
-- cannot be attached to another account's conversation by mistake.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat' CHECK (length(title) <= 300),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER,
  deleted_at INTEGER,
  UNIQUE (id, owner_uid)
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated
  ON conversations (owner_uid, deleted_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  owner_uid TEXT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 0),
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL CHECK (length(content) <= 2000000),
  status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('partial', 'complete', 'error')),
  created_at INTEGER NOT NULL,
  provider TEXT,
  model TEXT,
  FOREIGN KEY (conversation_id, owner_uid)
    REFERENCES conversations (id, owner_uid) ON DELETE CASCADE,
  UNIQUE (id, owner_uid),
  UNIQUE (conversation_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_owner_conversation_order
  ON chat_messages (owner_uid, conversation_id, sequence_no ASC);

CREATE TABLE IF NOT EXISTS chat_runs (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  owner_uid TEXT NOT NULL,
  initiating_message_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'running', 'completed', 'interrupted', 'failed', 'cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER,
  cancel_requested_at INTEGER,
  partial_output TEXT NOT NULL DEFAULT '' CHECK (length(partial_output) <= 2000000),
  error_code TEXT,
  error_message TEXT CHECK (error_message IS NULL OR length(error_message) <= 1000),
  idempotency_key TEXT,
  retry_of_run_id TEXT,
  FOREIGN KEY (conversation_id, owner_uid)
    REFERENCES conversations (id, owner_uid) ON DELETE CASCADE,
  FOREIGN KEY (initiating_message_id, owner_uid)
    REFERENCES chat_messages (id, owner_uid) ON DELETE CASCADE,
  FOREIGN KEY (retry_of_run_id, owner_uid)
    REFERENCES chat_runs (id, owner_uid) ON DELETE SET NULL,
  UNIQUE (id, owner_uid)
);

CREATE INDEX IF NOT EXISTS idx_chat_runs_owner_status_updated
  ON chat_runs (owner_uid, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_runs_conversation_created
  ON chat_runs (owner_uid, conversation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_runs_owner_idempotency
  ON chat_runs (owner_uid, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
