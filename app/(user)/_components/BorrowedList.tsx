"use client";

import { useEffect, useState } from "react";

type Loan = {
  id: string;
  loanedAt: string;
  dueAt?: string | null;
  book: {
    title: string;
    authors: string[];
    isbn13: string;
    thumbnail?: string | null;
  };
};

type BorrowedBooksListProps = {
  sectionId?: string;
};

export default function BorrowedBooksList({
  sectionId = "borrowed-books",
}: BorrowedBooksListProps) {
  const [borrowedList, setBorrowedList] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/book/borrowed")
      .then(async (res) => {
        if (!res.ok) throw new Error("貸出中の本の取得に失敗しました");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setBorrowedList(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((e) => {
        if (!active) return;
        setBorrowedList([]);
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
            BORROWED BOOKS
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">
            貸し出し履歴
          </h3>
        </div>
        {!loading && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {borrowedList.length}冊
          </span>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          読み込み中...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && borrowedList.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          貸し出し履歴はありません。
        </div>
      )}

      {!loading && !error && borrowedList.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex w-max gap-4">
            {borrowedList.map((borrowed) => {
              const dueDate = borrowed.dueAt ? new Date(borrowed.dueAt) : null;

              return (
                <article
                  key={borrowed.id}
                  className="flex w-[240px] shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:w-[280px]"
                >
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100">
                    {borrowed.book.thumbnail ? (
                      <img
                        src={borrowed.book.thumbnail}
                        alt={borrowed.book.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-500">NO IMAGE</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
                      {borrowed.book.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                      {borrowed.book.authors.join(", ")}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      ISBN: {borrowed.book.isbn13}
                    </p>


                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
