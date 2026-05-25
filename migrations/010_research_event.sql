CREATE TABLE "ResearchEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  "eventType" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT event_type_check
    CHECK ("eventType" IN ('post_view', 'book_detail_view', 'loan')),

  CONSTRAINT source_type_check
    CHECK ("sourceType" IN ('thread', 'comment', 'direct'))
);

CREATE INDEX "ResearchEvent_eventType_userEmail_bookId_occurredAt_idx"
  ON "ResearchEvent" ("eventType", "userEmail", "bookId", "occurredAt");

CREATE INDEX "ResearchEvent_eventType_sourceType_occurredAt_idx"
  ON "ResearchEvent" ("eventType", "sourceType", "occurredAt");

CREATE INDEX "ResearchEvent_occurredAt_id_idx"
  ON "ResearchEvent" ("occurredAt" DESC, id DESC);
