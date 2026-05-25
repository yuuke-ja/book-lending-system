CREATE TABLE IF NOT EXISTS "AiChatMessage" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userEmail" TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB,
  intent TEXT,
  "searchQuery" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiChatMessage_role_check"
    CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS "AiChatMessage_userEmail_createdAt_id_idx"
  ON "AiChatMessage" ("userEmail", "createdAt" DESC, id DESC);

ALTER TABLE "AiRecommendation"
ADD COLUMN IF NOT EXISTS "userMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "AiRecommendation_userMessageId_idx"
  ON "AiRecommendation" ("userMessageId");

ALTER TABLE "AiRecommendation"
DROP CONSTRAINT IF EXISTS "AiRecommendation_userMessageId_fkey";

ALTER TABLE "AiRecommendation"
ADD CONSTRAINT "AiRecommendation_userMessageId_fkey"
  FOREIGN KEY ("userMessageId")
  REFERENCES "AiChatMessage"(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
