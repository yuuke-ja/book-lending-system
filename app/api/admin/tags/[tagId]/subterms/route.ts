import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    tagId: string;
  }>;
};

async function requireAdmin() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "ログインエラー" }, { status: 401 });
  }

  const email = session.user?.email;
  if (!email || !(await Admin(email))) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;
    const { tagId } = await context.params;
    const result = await db.query(
      `SELECT id, "tagId", subterm FROM "TagSubterm" WHERE "tagId" = $1 ORDER BY subterm ASC`,
      [tagId]
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "小要素の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;
    const { tagId } = await context.params;
    const { subterms } = (await request.json()) as { subterms?: string[] };
    if (!subterms?.length) {
      return NextResponse.json({ error: "小要素の形式が不正です" }, { status: 400 });
    }

    await db.query(
      `INSERT INTO "TagSubterm" ("tagId", subterm)
       SELECT $1, trim(subterm)
       FROM unnest($2::text[]) AS input(subterm)
       WHERE trim(subterm) <> ''
       ON CONFLICT ("tagId", subterm) DO UPDATE
       SET "updatedAt" = now()`,
      [tagId, subterms]
    );

    const result = await db.query(
      `SELECT id, "tagId", subterm FROM "TagSubterm" WHERE "tagId" = $1 ORDER BY subterm ASC`,
      [tagId]
    );

    return NextResponse.json(result.rows, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "小要素の保存に失敗しました" }, { status: 500 });
  }
}
