import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const gettag = await db.query(
      `SELECT id, tag FROM "TagList" ORDER BY tag ASC`
    );
    return NextResponse.json(gettag.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get tags" }, { status: 500 });
  }
}