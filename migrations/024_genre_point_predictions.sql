CREATE TABLE IF NOT EXISTS "GenrePointPrediction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "predictionMonth" DATE NOT NULL,
  "tagId" TEXT NOT NULL,
  "predictedPoints" DOUBLE PRECISION NOT NULL,
  "modelName" TEXT NOT NULL DEFAULT 'ridge',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GenrePointPrediction_predictedPoints_check"
    CHECK ("predictedPoints" >= 0),

  CONSTRAINT "GenrePointPrediction_tagId_fkey"
    FOREIGN KEY ("tagId")
    REFERENCES "TagList"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "GenrePointPrediction_predictionMonth_tagId_key"
    UNIQUE ("predictionMonth", "tagId")
);

CREATE INDEX IF NOT EXISTS "GenrePointPrediction_predictionMonth_idx"
  ON "GenrePointPrediction" ("predictionMonth");
