import { db } from "@/lib/db";

type ResearchEventType = "post_view" | "book_detail_view" | "loan";
type ResearchEventSourceType = "thread" | "comment" | "direct";

type ResearchEventQueryClient = {
  query(text: string, params?: unknown[]): Promise<unknown>;
};

type RecordResearchEventInput = {
  eventType: ResearchEventType;
  userEmail: string;
  bookId: string;
  sourceType: ResearchEventSourceType;
  sourceId?: string | null;
};

export async function recordResearchEvent(
  {
    eventType,
    userEmail,
    bookId,
    sourceType,
    sourceId = null,
  }: RecordResearchEventInput,
  client: ResearchEventQueryClient = db
) {
  await client.query(
    `INSERT INTO "ResearchEvent" ("eventType", "userEmail", "bookId", "sourceType", "sourceId")
     VALUES ($1, $2, $3, $4, $5)`,
    [eventType, userEmail, bookId, sourceType, sourceId]
  );
}
