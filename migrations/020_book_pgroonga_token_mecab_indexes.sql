DROP INDEX IF EXISTS "Book_search_idx";
DROP INDEX IF EXISTS "Book_authors_search_idx";

CREATE INDEX IF NOT EXISTS "Book_search_idx"
  ON "Book"
  USING pgroonga (title, description)
  WITH (
    tokenizer = 'TokenMecab',
    normalizer = 'NormalizerNFKC150'
  );

CREATE INDEX IF NOT EXISTS "Book_authors_search_idx"
  ON "Book"
  USING pgroonga (authors)
  WITH (
    tokenizer = 'TokenMecab',
    normalizer = 'NormalizerNFKC150'
  );
