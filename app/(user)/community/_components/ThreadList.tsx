import Link from "next/link";
import type { CommunityThread } from "./types";

const JST_TIMEZONE = "Asia/Tokyo";

export default function ThreadList({ threads }: { threads: CommunityThread[] }) {
  return (
    <section className="space-y-4">
      {threads.length === 0 ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-7 text-sm text-zinc-600 shadow-sm">
          まだスレッドはありません
        </div>
      ) : (
        threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/community/${thread.id}`}
            className="block rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <div className="flex items-center gap-3">
              <img
                src={thread.authorAvatarUrl || "/default-avatar.svg"}
                alt={thread.nickname ?? "投稿者"}
                className="h-10 w-10 rounded-full border border-zinc-200 bg-zinc-100 object-cover"
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-zinc-900">
                  {thread.nickname || "未設定"}
                </p>
                <p className="text-sm text-zinc-400">
                  {new Date(thread.createdAt).toLocaleString("ja-JP", {
                    timeZone: JST_TIMEZONE,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-4 whitespace-pre-wrap text-lg leading-8 text-zinc-800">
              {thread.content}
            </div>

            {thread.linkedBook && (
              <div className="relative mt-6 overflow-hidden rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
                <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-indigo-500" />
                <div className="flex items-center gap-5 pl-2">
                  <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                    {thread.linkedBook.thumbnail ? (
                      <img
                        src={thread.linkedBook.thumbnail}
                        alt={thread.linkedBook.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-[10px] text-zinc-400">NO IMAGE</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-[0.08em] text-indigo-600">
                      LINKED BOOK
                    </p>
                    <p className="mt-3 line-clamp-2 text-2xl font-bold leading-tight text-zinc-900">
                      {thread.linkedBook.title}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Link>
        ))
      )}
    </section>
  );
}
