import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UnsubscribeBody;
  const endpoint = body.endpoint;

  if (!endpoint) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  await db.query(
    `DELETE FROM "PushSubscription" WHERE "userEmail" = $1 AND endpoint = $2`,
    [email, endpoint]
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
