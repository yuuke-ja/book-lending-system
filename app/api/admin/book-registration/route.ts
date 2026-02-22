import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { randomUUID } from "crypto";
export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = session.user?.email;
  const isAdmin = email ? await Admin(email) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const pending = await db.query(
      `SELECT * FROM "PendingBook"`
    );

    await db.transaction(async (tx) => {
      for (const pb of pending.rows) {
        //PendingBookをBookに登録または更新
        await tx.query(
          `INSERT INTO "Book" (id, "googleBookId", isbn13, title, authors, description, thumbnail)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (isbn13)
           DO UPDATE SET
             "googleBookId" = EXCLUDED."googleBookId",
             title = EXCLUDED.title,
             authors = EXCLUDED.authors,
             description = EXCLUDED.description,
             thumbnail = EXCLUDED.thumbnail`,
          [
            randomUUID(),
            pb.googleBookId,
            pb.isbn13,
            pb.title,
            pb.authors,
            pb.description,
            pb.thumbnail,
          ]
        );
      }
      await tx.query(`DELETE FROM "PendingBook"`);
    });

    return NextResponse.json(
      { message: "All pending books registered successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to register books" },
      { status: 500 }
    );
  }
}
