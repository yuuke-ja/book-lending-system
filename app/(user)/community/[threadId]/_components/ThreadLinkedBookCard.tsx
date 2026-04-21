"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type LinkedBook } from "../../_components/types";

export default function ThreadLinkedBookCard({
  book,
  threadId,
}: {
  book: LinkedBook;
  threadId: string;
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(false);

  const handleClick = (bookId: string) => {
    if (isNavigatingRef.current) {
      return;
    }

    isNavigatingRef.current = true;
    setIsNavigating(true);

    void fetch("/api/thread/book-link-click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType: "book_link_click",
        bookId,
        sourceType: "thread",
        sourceId: threadId,
      }),
      keepalive: true,
    }).catch((error) => {
      console.error("スレッド本リンククリックログの送信に失敗:", error);
    });

    router.push(`/book/${bookId}`);
  };

  return (
    <button
      type="button"
      onClick={() => handleClick(book.id)}
      disabled={isNavigating}
      className="relative mt-6 block w-full overflow-hidden rounded-3xl border border-indigo-200 bg-white p-5 text-left shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-indigo-500" />
      <div className="flex items-center gap-5 pl-2">
        <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
          {book.thumbnail ? (
            <img
              src={book.thumbnail}
              alt={book.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-[10px] text-zinc-400">NO IMAGE</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mt-3 line-clamp-2 text-2xl font-bold leading-tight text-zinc-900">
            {book.title}
          </p>
        </div>
      </div>
    </button>
  );
}
