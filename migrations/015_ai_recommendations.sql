CREATE TABLE IF NOT EXISTS "AiRecommendation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "bookId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userEmail" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  CONSTRAINT "AiRecommendation_bookId_fkey"
    FOREIGN KEY ("bookId")
    REFERENCES "Book"(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AiRecommendation_userEmail_createdAt_idx"
  ON "AiRecommendation" ("userEmail", "createdAt");

CREATE INDEX IF NOT EXISTS "AiRecommendation_userEmail_bookId_createdAt_idx"
  ON "AiRecommendation" ("userEmail", "bookId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiRecommendation_bookId_idx"
  ON "AiRecommendation" ("bookId");
