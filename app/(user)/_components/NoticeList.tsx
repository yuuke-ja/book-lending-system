"use client";

import { ChevronRight, Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Notice } from "@/lib/notices/type";
import NoticeContent from "./NoticeContent";

type NoticeListProps = {
  notices: Notice[];
};

export default function NoticeList({ notices }: NoticeListProps) {
  const [openedNotice, setOpenedNotice] = useState<Notice | null>(null);

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-md sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
              NOTICE
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">
              お知らせ
            </h2>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {notices.length}件
          </span>
        </div>

        {notices.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            現在お知らせはありません。
          </div>
        ) : (
          <div className="max-h-[192px] overflow-y-auto border-y border-zinc-200">
            {notices.map((notice) => {
              return (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => setOpenedNotice(notice)}
                  className="flex min-h-16 w-full items-center gap-3 border-b border-zinc-200 px-2 py-2.5 text-left transition last:border-b-0 hover:bg-zinc-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100">
                    {notice.linkedBook?.thumbnail ? (
                      <img
                        src={notice.linkedBook.thumbnail}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Megaphone
                        className="h-5 w-5 text-blue-600"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {notice.title}
                    </p>
                    <time className="mt-1 block text-xs text-zinc-500">
                      {new Date(notice.createdAt).toLocaleDateString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </time>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-zinc-400"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {openedNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpenedNotice(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
            className="flex h-[600px] w-[560px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="notice-modal-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  {openedNotice.title}
                </h2>
                <time className="mt-1 block text-xs text-zinc-500">
                  {new Date(openedNotice.createdAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })}
                </time>
              </div>
              <button
                type="button"
                onClick={() => setOpenedNotice(null)}
                aria-label="お知らせを閉じる"
                title="閉じる"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <NoticeContent content={openedNotice.content} />

              {openedNotice.linkedBook && (
                <Link
                  href={`/book/${openedNotice.linkedBook.id}`}
                  className="flex items-center gap-4 border-t border-zinc-200 pt-5"
                >
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                    {openedNotice.linkedBook.thumbnail ? (
                      <img
                        src={openedNotice.linkedBook.thumbnail}
                        alt={openedNotice.linkedBook.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-400">
                        NO IMAGE
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-500">
                      関連する本
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">
                      {openedNotice.linkedBook.title}
                    </p>
                    <p className="mt-2 text-xs font-medium text-blue-600">
                      本の詳細を見る
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
