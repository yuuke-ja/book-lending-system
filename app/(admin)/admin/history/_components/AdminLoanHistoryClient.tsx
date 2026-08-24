"use client";

import { useState } from "react";
import type { SerializedLoanHistoryRow } from "@/lib/loans/get-loan-history";

type GroupMode = "book" | "user";
type StatusFilter = "all" | "borrowing" | "returned";
type LoanHistoryRow = SerializedLoanHistoryRow;

type AdminLoanHistoryPageProps = {
  rows: LoanHistoryRow[];
  error: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminLoanHistoryPage({
  rows,
  error,
}: AdminLoanHistoryPageProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>("book");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const currentGroupLabel = groupMode === "book" ? "本ごと" : "ユーザーごと";
  const currentStatusLabel =
    statusFilter === "all"
      ? "すべて"
      : statusFilter === "borrowing"
        ? "貸出中"
        : "返却済み";

  const filteredRows = rows.filter((row: LoanHistoryRow) => {
    if (statusFilter === "all") return true;
    return row.status === statusFilter;
  });

  const groupedRows: Record<string, LoanHistoryRow[]> = {};
  filteredRows.forEach((row) => {
    const key = groupMode === "book" ? row.bookId : row.userEmail;
    if (!groupedRows[key]) groupedRows[key] = [];
    groupedRows[key].push(row);
  });

  const groupEntries = Object.entries(groupedRows);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500">
          LOAN HISTORY
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">貸出履歴</h1>
        <p className="mt-2 text-sm text-zinc-600">
          表示単位と状態で絞り込んで、貸出履歴を確認できます。
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-zinc-500">
              表示単位
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={groupMode}
                onChange={(event) =>
                  setGroupMode(event.target.value as GroupMode)
                }
                className="min-w-44 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="book">本ごと</option>
                <option value="user">ユーザーごと</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-zinc-500">
              状態
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="min-w-44 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">すべて</option>
                <option value="borrowing">貸出中</option>
                <option value="returned">返却済み</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
        <p className="mt-2">
          表示単位: {currentGroupLabel} / 状態: {currentStatusLabel}
        </p>
        <p className="mt-2">
          絞り込み結果: {filteredRows.length} 件 / {groupEntries.length} グループ
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
          {error}
        </div>
      ) : groupEntries.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          条件に一致する貸出履歴はありません。
        </div>
      ) : (
        <div className="space-y-4">
          {groupEntries.map(([groupKey, groupRows]) => {
            const firstRow = groupRows[0];

            return (
              <section
                key={groupKey}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                      {groupMode === "book" ? firstRow.bookTitle : firstRow.userEmail}
                    </h2>
                    {groupMode === "book" ? (
                      <div className="mt-1 space-y-1 text-sm text-zinc-600">
                        <p>
                          {firstRow.bookAuthors.length > 0
                            ? firstRow.bookAuthors.join(" / ")
                            : "著者情報なし"}
                        </p>
                        <p>ISBN/JAN: {firstRow.bookIsbn13}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-zinc-600">
                        貸出履歴 {groupRows.length} 件
                      </p>
                    )}
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {groupRows.length} 件
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {groupRows.map((row) => (
                    <article
                      key={row.loanId}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-zinc-900">
                            {groupMode === "book" ? row.userEmail : row.bookTitle}
                          </p>
                          {groupMode === "user" ? (
                            <p className="text-sm text-zinc-600">
                              {row.bookAuthors.length > 0
                                ? row.bookAuthors.join(" / ")
                                : "著者情報なし"}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${row.status === "borrowing"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                            }`}
                        >
                          {row.status === "borrowing" ? "貸出中" : "返却済み"}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-3">
                        <p>貸出日: {formatDate(row.loanedAt)}</p>
                        <p>返却期限: {formatDate(row.dueAt)}</p>
                        <p>返却日: {formatDate(row.returnedAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
