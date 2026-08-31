import { db } from "@/lib/db";
export async function Admin(email?: string) {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();
  const adminEmailDomain = process.env.ADMIN_EMAIL_DOMAIN;

  if (adminEmailDomain && normalizedEmail.endsWith(`@${adminEmailDomain}`)) {
    return true;
  }

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
