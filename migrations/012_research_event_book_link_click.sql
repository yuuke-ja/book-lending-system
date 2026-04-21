ALTER TABLE "ResearchEvent"
DROP CONSTRAINT IF EXISTS event_type_check;

ALTER TABLE "ResearchEvent"
ADD CONSTRAINT event_type_check
  CHECK ("eventType" IN ('post_view', 'book_detail_view', 'loan', 'book_link_click'));
