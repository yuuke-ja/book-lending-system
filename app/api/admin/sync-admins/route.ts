import { NextResponse } from "next/server";
import { db } from "@/lib/db";


export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-sync-secret");
  if (secret !== process.env.ADMIN_SYNC_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const emails =
    typeof data === "object" && data !== null && "emails" in data
      ? (data as { emails?: unknown }).emails
      : undefined;
  if (
    !Array.isArray(emails) ||
    emails.some((email) => typeof email !== "string")
  ) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.query(`DELETE FROM "Admin"`);
      if (emails.length > 0) {
        await tx.query(
          `INSERT INTO "Admin" (email)
           SELECT DISTINCT t.email
           FROM UNNEST($1::text[]) AS t(email)
           ON CONFLICT (email) DO NOTHING`,
          [emails]
        );
      }
    });
  } catch (error) {
    console.error("管理者同期に失敗:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: emails.length });
}
