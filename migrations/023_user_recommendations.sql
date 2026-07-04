CREATE TABLE IF NOT EXISTS "UserRecommendation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userEmail" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  rank INTEGER NOT NULL,
  "candidateCount" INTEGER NOT NULL DEFAULT 1,
  distance DOUBLE PRECISION NOT NULL,
  "latestHistoryAt" TIMESTAMP(3) NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRecommendation_rank_check"
    CHECK (rank > 0),

  CONSTRAINT "UserRecommendation_candidateCount_check"
    CHECK ("candidateCount" > 0),

  CONSTRAINT "UserRecommendation_distance_check"
    CHECK (distance >= 0),

  CONSTRAINT "UserRecommendation_bookId_fkey"
    FOREIGN KEY ("bookId")
    REFERENCES "Book"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserRecommendation_userEmail_rank_idx"
  ON "UserRecommendation" ("userEmail", rank);

CREATE INDEX IF NOT EXISTS "UserRecommendation_userEmail_generatedAt_idx"
  ON "UserRecommendation" ("userEmail", "generatedAt" DESC);
