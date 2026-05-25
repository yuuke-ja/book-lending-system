import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { createMissingBookEmbeddings } from "../book-embedding";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const email = session.user?.email;
  const isAdmin = email ? await Admin(email) : false;
  if (!isAdmin) {
    return NextResponse.json(
      { error: "管理者以外はアクセスできません" },
      { status: 403 }
    );
  }

  const count = await createMissingBookEmbeddings();
  return NextResponse.json({ ok: true, count });
}
