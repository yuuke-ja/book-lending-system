"use client";

import { useState } from "react";

export default function BookEmbeddingStatusBar({
  embeddingCount,
}: {
  embeddingCount: number;
}) {
  const [count, setCount] = useState(embeddingCount);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(path: "missing" | "rebuild") {
    setLoading(path);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/book-embeddings/${path}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "更新に失敗しました");
        return;
      }
      setCount((prev) => path === "rebuild" ? data.count : prev + data.count);
      setMessage(`${data.count ?? 0}件更新しました`);
    } catch (error) {
      console.error("Error occurred while updating embeddings:", error);
      setMessage("更新に失敗しました");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
      <p>AI検索データ</p>
      <p>作成済みの埋め込みの数: {count}</p>
      <button
        type="button"
        onClick={() => run("missing")}
        disabled={loading !== null}
        className="mr-2 mt-2 rounded bg-white px-3 py-1.5 text-zinc-800 ring-1 ring-zinc-300 disabled:opacity-50"
      >
        {loading === "missing" ? "作成中..." : "未作成分を作成"}
      </button>
      <button
        type="button"
        onClick={() => run("rebuild")}
        disabled={loading !== null}
        className="mt-2 rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {loading === "rebuild" ? "再作成中..." : "全部再作成"}
      </button>
      {message && <p className="mt-2">{message}</p>}
    </div>
  );
}
