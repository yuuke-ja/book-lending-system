import { NextResponse } from "next/server";
import { db } from "@/lib/db";


export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-sync-secret");
  if (secret !== process.env.ADMIN_SYNC_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const data = await request.json();
  const emails: string[] = data.emails;

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


  return NextResponse.json({ ok: true, count: emails.length });
}
