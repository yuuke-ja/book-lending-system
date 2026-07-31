import { db } from "@/lib/db";

type SearchHistoryRow = {
  searchType: "book_list" | "ai_query";
  query: string;
  occurredAt: Date;
  count: string;
};

export async function getSearchHistory() {
  const result = await db.query<SearchHistoryRow>(
    `SELECT "searchType","query","occurredAt","count"   
      FROM "SearchEvent"
      ORDER BY "occurredAt" DESC, id DESC
      LIMIT 30
     `
  );

  return result.rows;
}
export async function getzerokSearchHistory() {
  const rsult = await db.query<SearchHistoryRow>(
    `SELECT "searchType","query","occurredAt","count"   
      FROM "SearchEvent"
      WHERE count = 0
      ORDER BY "occurredAt" DESC, id DESC
      LIMIT 30
     `
  );
  return rsult.rows;
}
