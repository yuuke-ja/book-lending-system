CREATE EXTENSION IF NOT EXISTS pgroonga;

CREATE INDEX IF NOT EXISTS "Book_search_idx"
  ON "Book" USING pgroonga (title, description);

CREATE INDEX IF NOT EXISTS "Book_authors_search_idx"
  ON "Book" USING pgroonga (authors);
