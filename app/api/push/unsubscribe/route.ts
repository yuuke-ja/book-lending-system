import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as UnsubscribeBody;
  const endpoint = body.endpoint;

  if (!endpoint) {
    return new Response("Invalid endpoint", { status: 400 });
  }

  await db.query(
    `DELETE FROM "PushSubscription" WHERE "userEmail" = $1 AND endpoint = $2`,
    [email, endpoint]
  );

  return Response.json({ ok: true }, { status: 200 });
}
