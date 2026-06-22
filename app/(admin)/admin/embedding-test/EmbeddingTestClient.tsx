"use client";

import { FormEvent, useState } from "react";

import type {
  EmbeddingTestBook,
  EmbeddingTestMode,
  EmbeddingTestResult,
} from "@/lib/ai/embedding-test";

export default function EmbeddingTestClient({
  books,
}: {
  books: EmbeddingTestBook[];
}) {
  const [mode, setMode] = useState<EmbeddingTestMode>("query");
  const [query, setQuery] = useState("web");
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<EmbeddingTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/book-embeddings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query, bookId, limit }),
      });
      const data = await response.json();

      if (!response.ok) {
        setResults([]);
        setError(data.error ?? "テストに失敗しました");
        return;
      }

      setResults(data.results ?? []);
    } catch (testError) {
      console.error("Embedding test request failed:", testError);
      setResults([]);
      setError("テストに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={runTest}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-zinc-900">
            テスト方法
          </legend>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="query"
                checked={mode === "query"}
                onChange={() => setMode("query")}
              />
              検索語に近い本
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="book"
                checked={mode === "book"}
                onChange={() => setMode("book")}
              />
              選んだ本に近い本
            </label>
          </div>
        </fieldset>

        {mode === "query" ? (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-900">検索語</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例: React、Webアプリ開発、料理の本"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
        ) : (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-900">基準の本</span>
            <select
              value={bookId}
              onChange={(event) => setBookId(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block max-w-40 space-y-2">
          <span className="text-sm font-semibold text-zinc-900">表示件数</span>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading || (mode === "book" && books.length === 0)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "計算中..." : "精度をテスト"}
        </button>

        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>

      {results.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">検索結果</h2>
            <p className="text-xs text-zinc-500">
              類似度は1に近いほど数値上は似ていますが、絶対値だけで正解とは判断できません。順位とスコア差、無関係な本の混入を確認してください。
            </p>
          </div>

          {results.map((book, index) => (
            <article
              key={book.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">
                    第{index + 1}位
                  </p>
                  <h3 className="mt-1 font-semibold text-zinc-900">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {book.authors?.join(", ") || "著者不明"}
                  </p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">
                    類似度 {book.similarity.toFixed(4)}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">
                    距離 {book.distance.toFixed(4)}
                  </span>
                </div>
              </div>

              {book.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {book.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-3 text-sm leading-6 text-zinc-700">
                {book.description || "説明文なし"}
              </p>

              <details className="mt-3 rounded-lg bg-zinc-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-700">
                  ベクトル化に使用した文章を見る
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-600">
                  {book.embeddingContent}
                </pre>
              </details>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
