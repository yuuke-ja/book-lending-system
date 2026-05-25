ALTER TABLE "ResearchEvent"
DROP CONSTRAINT IF EXISTS source_type_check;

ALTER TABLE "ResearchEvent"
ADD CONSTRAINT source_type_check
  CHECK ("sourceType" IN ('thread', 'comment', 'direct', 'ai_chat'));
