"use client";
import { useEffect, useState } from "react";

type ReturnStatusData = {
  dueToday: { bookTitle: string; dueDate: string }[];
  overdue: { bookTitle: string; dueDate: string }[];
};

export default function ReturnStatus() {
  const [status, setStatus] = useState<ReturnStatusData>({
    dueToday: [],
    overdue: [],
  });
  const [openType, setOpenType] = useState<"dueToday" | "overdue" | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/book/bookStatus");
        if (!res.ok) throw new Error();
        const data: ReturnStatusData = await res.json();
        setStatus(data);
      } catch (error) {
        setStatus({ dueToday: [], overdue: [] });
      }
    };
    fetchStatus();
  }, []);
  useEffect(() => {
    if (!openType) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenType(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openType]);
  const dueTodayCount = status.dueToday.length;
  const overdueCount = status.overdue.length;
  const hasAny = dueTodayCount + overdueCount > 0;
  const modalTitle =
    openType === "dueToday" ? "返却期限が今日の本" : "返却期限を過ぎている本";
  const modalItems =
    openType === "dueToday" ? status.dueToday : status.overdue;
  return (
    <div className="mb-2">

      {!hasAny ? (
        <div className="rounded-lg border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-500">
          返却期限が近い本はありません
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpenType("dueToday")}
            className="w-full max-w-[320px] rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-left transition hover:brightness-95 sm:w-[260px]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-orange-700">返却期限が今日</p>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                {dueTodayCount}冊
              </span>
            </div>
            <p className="mt-2 text-[11px] text-orange-700/80">一覧を見る</p>
          </button>

          <button
            type="button"
            onClick={() => setOpenType("overdue")}
            className="w-full max-w-[320px] rounded-lg border border-red-200 bg-red-50/70 p-3 text-left transition hover:brightness-95 sm:w-[260px]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-red-700">返却期限を過ぎている</p>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                {overdueCount}冊
              </span>
            </div>
            <p className="mt-2 text-[11px] text-red-700/80">一覧を見る</p>
          </button>
        </div>
      )}

      {openType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpenType(null)}
        >
          <div
            className="h-[360px] w-[360px] rounded-2xl bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modalTitle}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setOpenType(null)}
                className="rounded-full px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                閉じる
              </button>
            </div>
            {modalItems.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                一覧がありません
              </p>
            ) : (
              <ul className="max-h-[270px] space-y-2 overflow-auto pr-1 text-sm text-zinc-800">
                {modalItems.map((item, idx) => (
                  <li key={idx} className="rounded-lg border border-zinc-200 p-2">
                    <div className="font-medium">{item.bookTitle}</div>
                    <div className="text-xs text-zinc-500">
                      期限: {new Date(item.dueDate).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
