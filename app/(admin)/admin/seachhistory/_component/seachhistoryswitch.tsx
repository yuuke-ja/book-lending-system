"use client";

import { useState } from "react";

type SearchHistoryRow = {
  searchType: "book_list" | "ai_query";
  query: string;
  occurredAt: Date;
  count: string;
};

type SearchHistorySwitcherProps = {
  allHistory: SearchHistoryRow[];
  zeroHistory: SearchHistoryRow[];
};

export function SearchHistorySwitcher({
  allHistory,
  zeroHistory,
}: SearchHistorySwitcherProps) {
  const [zero, setZero] = useState(false);
  const which = zero ? zeroHistory : allHistory;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-zinc-900">検索履歴</h1>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setZero(false)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            !zero
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 bg-white text-zinc-700"
          }`}
        >
          すべて
        </button>

        <button
          type="button"
          onClick={() => setZero(true)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            zero
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 bg-white text-zinc-700"
          }`}
        >
          0件のみ
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {which.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            検索履歴はありません。
          </p>
        ) : (
          which.map((history, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-zinc-900">{history.query}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {history.searchType === "book_list"
                      ? "本一覧"
                      : "AIチャット"}
                  </p>
                </div>

                <span className="whitespace-nowrap text-sm text-zinc-600">
                  {history.count}件
                </span>
              </div>

              <p className="mt-2 text-xs text-zinc-400">
                {new Date(history.occurredAt).toLocaleString("ja-JP")}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
