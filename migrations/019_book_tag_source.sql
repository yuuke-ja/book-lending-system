ALTER TABLE "BookTag"
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS "BookTag_source_idx"
  ON "BookTag" (source);
