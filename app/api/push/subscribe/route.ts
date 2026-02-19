import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userEmail: email,
      endpoint,
      p256dh,
      auth: authKey,
    },
    update: {
      userEmail: email,
      p256dh,
      auth: authKey,
    },
  });

  return Response.json({ ok: true }, { status: 200 });
}
