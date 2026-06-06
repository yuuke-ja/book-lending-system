ALTER TABLE "TagList" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "BookTag" ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS "TagSubterm" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tagId" TEXT NOT NULL,
  subterm TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "TagSubterm_tagId_fkey"
    FOREIGN KEY ("tagId")
    REFERENCES "TagList"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "TagSubterm_tagId_subterm_unique"
    UNIQUE ("tagId", subterm)
);

CREATE INDEX IF NOT EXISTS "TagSubterm_tagId_idx"
  ON "TagSubterm" ("tagId");

CREATE INDEX IF NOT EXISTS "BookTag_source_idx"
  ON "BookTag" (source);
