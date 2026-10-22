-- Allocate unique message sequence numbers with one atomic write.
-- Apply after 0001_chat_persistence.sql.
ALTER TABLE conversations
  ADD COLUMN next_sequence INTEGER NOT NULL DEFAULT 0 CHECK (next_sequence >= 0);

UPDATE conversations
SET next_sequence = COALESCE(
  (SELECT MAX(sequence_no) + 1
   FROM chat_messages
   WHERE chat_messages.conversation_id = conversations.id
     AND chat_messages.owner_uid = conversations.owner_uid),
  0
);
