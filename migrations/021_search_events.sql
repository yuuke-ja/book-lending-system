CREATE TABLE IF NOT EXISTS "SearchEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userEmail" TEXT NOT NULL,
  "searchType" TEXT NOT NULL,
  query TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SearchEvent_searchType_check"
    CHECK ("searchType" IN ('book_list', 'ai_query'))
);

CREATE TABLE IF NOT EXISTS "SearchEventTag" (
  "searchEventId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY ("searchEventId", "tagId"),

  CONSTRAINT "SearchEventTag_searchEventId_fkey"
    FOREIGN KEY ("searchEventId")
    REFERENCES "SearchEvent"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "SearchEventTag_tagId_fkey"
    FOREIGN KEY ("tagId")
    REFERENCES "TagList"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SearchEvent_searchType_occurredAt_idx"
  ON "SearchEvent" ("searchType", "occurredAt");

CREATE INDEX IF NOT EXISTS "SearchEventTag_tagId_searchEventId_idx"
  ON "SearchEventTag" ("tagId", "searchEventId");

CREATE INDEX IF NOT EXISTS "TagList_tag_pgroonga_idx"
  ON "TagList"
  USING pgroonga (tag)
  WITH (
    tokenizer = 'TokenMecab',
    normalizer = 'NormalizerNFKC150'
  );

CREATE INDEX IF NOT EXISTS "TagSubterm_subterm_pgroonga_idx"
  ON "TagSubterm"
  USING pgroonga (subterm)
  WITH (
    tokenizer = 'TokenMecab',
    normalizer = 'NormalizerNFKC150'
  );
