import "server-only";

import { db } from "@/lib/db";

export type RecommendBook = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  thumbnail: string | null;
  rank: number;
};

export async function getUserRecommendations(
  userEmail: string
): Promise<RecommendBook[]> {
  // おすすめの本を取得
  const result = await db.query<RecommendBook>(
    `SELECT
       b.id,
       b.title,
       b.authors,
       b.isbn13,
       b.thumbnail,
       recommendation.rank
     FROM "UserRecommendation" recommendation
     JOIN "Book" b
       ON b.id = recommendation."bookId"
     WHERE recommendation."userEmail" = $1
     ORDER BY recommendation.rank ASC
     LIMIT 8`,
    [userEmail]
  );

  return result.rows;
}
