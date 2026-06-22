import { NextResponse } from "next/server";

import { Admin } from "@/lib/admin";
import { testBookEmbeddings } from "@/lib/ai/embedding-test";
import { auth } from "@/lib/auth";

type RequestBody = {
  mode?: unknown;
  query?: unknown;
  bookId?: unknown;
  limit?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  if (!(await Admin(email))) {
    return NextResponse.json(
      { error: "管理者以外はアクセスできません" },
      { status: 403 }
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "リクエスト形式が不正です" },
      { status: 400 }
    );
  }

  const mode = body.mode === "book" ? "book" : "query";
  const limit = Number(body.limit ?? 10);

  if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
    return NextResponse.json(
      { error: "表示件数は1〜50で指定してください" },
      { status: 400 }
    );
  }

  try {
    const results = await testBookEmbeddings({
      mode,
      query: typeof body.query === "string" ? body.query : undefined,
      bookId: typeof body.bookId === "string" ? body.bookId : undefined,
      limit,
    });

    return NextResponse.json({ mode, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ベクトル検索に失敗しました";
    const isInputError =
      message === "検索語を入力してください" ||
      message === "基準にする本を選択してください" ||
      message === "選択した本のEmbeddingがありません";

    console.error("Embedding精度テストに失敗:", error);
    return NextResponse.json(
      { error: message },
      { status: isInputError ? 400 : 500 }
    );
  }
}
