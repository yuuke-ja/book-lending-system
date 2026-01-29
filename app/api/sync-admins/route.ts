import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-sync-secret");
  if (secret !== process.env.ADMIN_SYNC_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const data = await request.json();
  const emails: string[] = data.emails;

  await prisma.$transaction([
    prisma.admin.deleteMany(),
    prisma.admin.createMany({
      data: emails.map((email) => ({ email })),
      skipDuplicates: true,
    }),
  ]);


  return NextResponse.json({ ok: true, count: emails.length });
}
