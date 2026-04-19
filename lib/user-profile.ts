import { db } from "@/lib/db";

export async function getUserProfile(userEmail: string) {
  const result = await db.query(
    `SELECT email, nickname, avatarurl AS "avatarUrl"
       FROM "User"
       WHERE email = $1
       LIMIT 1`,
    [userEmail]
  );
  return result.rows[0];
}
