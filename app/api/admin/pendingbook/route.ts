import { connection, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";

export async function GET() {
  await connection();
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = session.user?.email;
    const isAdmin = email ? await Admin(email) : false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pendingBooks = await db.query(
      `SELECT * FROM "PendingBook" ORDER BY "createdAt" DESC`
    );

    return NextResponse.json(pendingBooks.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch pending books" },
      { status: 500 }
    );
  }
}
