/* 管理者がタグを生成 */
CREATE TABLE IF NOT EXISTS "TagList" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tag TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
/* 書籍とタグの中間テーブル */
CREATE TABLE IF NOT EXISTS "BookTag" (
  "bookId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("bookId", "tagId"),
  CONSTRAINT "BookTag_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "TagList"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BookTag_tagId_bookId_idx"
  ON "BookTag" ("tagId", "bookId");
