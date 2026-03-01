CREATE TABLE IF NOT EXISTS "BookReview" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "bookId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  rating INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookReview_bookId_fkey"
    FOREIGN KEY ("bookId")
    REFERENCES "Book"(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT "BookReview_rating_check"
    CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS "BookReview_bookId_idx"
  ON "BookReview" ("bookId");

CREATE INDEX IF NOT EXISTS "BookReview_userEmail_idx"
  ON "BookReview" ("userEmail");

CREATE UNIQUE INDEX IF NOT EXISTS "BookReview_bookId_userEmail_key"
  ON "BookReview" ("bookId", "userEmail");
