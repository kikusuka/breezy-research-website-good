-- Per-account storage counter so quota checks cost one row read instead of a table scan.
-- Counts message text bytes (UTF-8) plus nothing else; see src/server-core/chatPersistence.ts.
-- Apply after 0002_conversation_sequence_allocator.sql.
CREATE TABLE IF NOT EXISTS storage_usage (
  owner_uid TEXT PRIMARY KEY NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  updated_at INTEGER NOT NULL
);

-- Backfill from existing live conversations.
INSERT OR REPLACE INTO storage_usage (owner_uid, bytes, updated_at)
SELECT m.owner_uid, SUM(LENGTH(CAST(m.content AS BLOB))), CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM chat_messages m
JOIN conversations c ON c.id = m.conversation_id AND c.owner_uid = m.owner_uid
WHERE c.deleted_at IS NULL
GROUP BY m.owner_uid;
