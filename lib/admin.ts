import { db } from "@/lib/db";
export async function Admin(email?: string) {
  if (!email) return false;
  const admin = await db.query(
    `SELECT * FROM "Admin" WHERE email = $1`,
    [email]
  );
  return (admin.rowCount ?? 0) > 0;
}