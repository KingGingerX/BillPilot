-- SyncdLab: Fix RLS for conversations and messages
-- Run this in the Supabase SQL editor at:
-- https://app.supabase.com/project/utdqoidgaygecyblttau/sql/new

-- ============================================================
-- CONVERSATIONS: Enable RLS + participant policy
-- ============================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_participant" ON conversations
  FOR ALL USING (auth.uid() = participant_a OR auth.uid() = participant_b);

-- ============================================================
-- MESSAGES: Fix broken policy, add correct read/write policies
-- ============================================================

-- Drop the old broken policy (only allowed seeing own sent messages)
DROP POLICY IF EXISTS "messages_own" ON messages;

-- Users can read all messages in their conversations
CREATE POLICY "messages_read" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_a = auth.uid() OR participant_b = auth.uid()
    )
  );

-- Users can only send messages as themselves in their own conversations
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_a = auth.uid() OR participant_b = auth.uid()
    )
  );

-- Users can mark messages in their conversations as read
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_a = auth.uid() OR participant_b = auth.uid()
    )
  )
  WITH CHECK (true);

-- ============================================================
-- REALTIME: Enable Realtime for messages table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
