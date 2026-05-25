CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "BookEmbedding" (
  "bookId" TEXT PRIMARY KEY REFERENCES "Book"(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384) NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "BookEmbedding_embedding_hnsw_idx"
  ON "BookEmbedding"
  USING hnsw (embedding vector_cosine_ops);
