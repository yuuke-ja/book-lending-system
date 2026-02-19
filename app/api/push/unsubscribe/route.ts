import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.pushSubscription.deleteMany({
    where: {
      userEmail: email,
      endpoint,
    },
  });

  return Response.json({ ok: true }, { status: 200 });
}
