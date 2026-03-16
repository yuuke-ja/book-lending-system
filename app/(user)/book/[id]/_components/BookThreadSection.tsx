"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Thread = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
};

export default function BookThreadSection({ bookId }: { bookId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadInput, setThreadInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);

  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/community/thread?bookId=${encodeURIComponent(bookId)}`
      );
      if (!res.ok) {
        throw new Error("スレッドの取得に失敗しました");
      }

      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const handleThreadSubmit = async () => {
    if (!threadInput.trim() || isSubmittingThread) {
      return;
    }

    try {
      setIsSubmittingThread(true);

      const res = await fetch("/api/community/thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "BOOK_TOPIC",
          bookId,
          content: threadInput.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("投稿の作成に失敗しました");
      }

      setThreadInput("");
      await fetchThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingThread(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await fetchThreads();
    };

    run();
  }, [fetchThreads]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
              THREADS
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">
              この本に関する投稿
            </h2>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <textarea
            className="min-h-28 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none"
            placeholder="この本について投稿する"
            value={threadInput}
            onChange={(e) => setThreadInput(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleThreadSubmit}
              disabled={isSubmittingThread}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {isSubmittingThread ? "送信中..." : "この本について投稿する"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600">
            読み込み中...
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
            まだ投稿はありません
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/community/${thread.id}`}
                className="block rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <p className="text-xs text-zinc-500">
                  {new Date(thread.createdAt).toLocaleString("ja-JP")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                  {thread.content}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
