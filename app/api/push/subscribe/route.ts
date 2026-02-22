import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

type SubscriptionBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as SubscriptionBody;
  const subscription = body.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !authKey) {
    return new Response("Invalid subscription", { status: 400 });
  }

  await db.query(
    `INSERT INTO "PushSubscription" (id, "userEmail", endpoint, p256dh, auth, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (endpoint)
     DO UPDATE SET
       "userEmail" = EXCLUDED."userEmail",
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       "updatedAt" = NOW()`,
    [randomUUID(), email, endpoint, p256dh, authKey]
  );

  return Response.json({ ok: true }, { status: 200 });
}
