import { db } from "@/lib/db";
export async function Admin(email?: string) {
  if (!email) return false;
  try {
    const admin = await db.query(
      `SELECT * FROM "Admin" WHERE email = $1`,
      [email]
    );
    return (admin.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("管理者判定に失敗:", error);
    return false;
  }
}
