import Link from "next/link";

import EmbeddingTestClient from "./EmbeddingTestClient";
import { getEmbeddingTestBooks } from "@/lib/ai/embedding-test";

export default async function EmbeddingTestPage() {
  const books = await getEmbeddingTestBooks();

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← 管理者ページへ戻る
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
            ベクトル精度テスト
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            現在保存されているBookEmbeddingを使い、検索語または本に近い書籍を順位付きで確認します。この画面からDBは更新しません。
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Embedding作成済み: {books.length}冊
          </p>
        </div>

        <EmbeddingTestClient books={books} />
      </div>
    </main>
  );
}
