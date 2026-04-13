"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rating } from "@smastrom/react-rating";
import "@smastrom/react-rating/style.css";
import type { BookListBook, BookListTag } from "@/lib/books/book-list-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type BookListClientProps = {
  initialBooks: BookListBook[];
  initialLoanedBookIds: string[];
  initialTags: BookListTag[];
};

export default function BookListClient({
  initialBooks,
  initialLoanedBookIds,
  initialTags,
}: BookListClientProps) {
  const router = useRouter();
  const [searchBooks, setSearchBooks] = useState<BookListBook[] | null>(null);
  const [loanedBooks, setLoanedBooks] = useState<string[]>(initialLoanedBookIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const displayBooks = searchBooks ?? initialBooks;
  const hasSearched = searchBooks !== null;
  const loanedSet = new Set(loanedBooks);

  const runSearch = useCallback((query: string) => {
    if (!query) {
      setSearchBooks(null);
      return;
    }

    const full = fetch(`/api/book/search/full-text?query=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error("全文検索に失敗しました");
        return res.json();
      });

    const tag = fetch(`/api/book/search/tag?query=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error("タグ検索に失敗しました");
        return res.json();
      });

    Promise.all([full, tag])
      .then(([fullBooks, tagBooks]) => {
        const merged = [...(fullBooks as BookListBook[]), ...(tagBooks as BookListBook[])];
        const unique = Array.from(new Map(merged.map((book) => [book.id, book])).values());
        setSearchBooks(unique);
      })
      .catch((err) => {
        console.error("検索エラー:", err);
        alert(err instanceof Error ? err.message : "エラーが発生しました");
      });
  }, []);

  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch("/api/book/Everyoneborrowed");
      if (!res.ok) throw new Error("貸出状況の取得に失敗しました");
      const data = await res.json();
      const bookIds = Array.isArray(data)
        ? data.map((loan) => loan.bookId).filter(Boolean)
        : [];
      setLoanedBooks(bookIds);
    } catch (err) {
      console.error("貸出状況取得エラー:", err);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("loan-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Loan" },
        () => {
          void fetchLoans();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchLoans]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const mergedQuery = [...selectedTags, searchQuery.trim()].filter(Boolean).join(" ");
            runSearch(mergedQuery);
          }}
          className="space-y-2"
        >
          <label
            htmlFor="book-search-input"
            className="block text-xs font-semibold tracking-[0.08em] text-zinc-500"
          >
            検索
          </label>
          <div className="flex gap-2">
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 focus-within:border-zinc-400">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTags((prev) => prev.filter((value) => value !== tag));
                    }}
                    className="text-zinc-500 hover:text-zinc-700"
                    aria-label={`${tag}を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="book-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="タイトル・著者・概要で検索"
                className="min-w-[160px] flex-1 border-none bg-transparent p-0 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              検索
            </button>
          </div>
        </form>
        {initialTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {initialTags.map((item) => {
              const isSelected = selectedTags.includes(item.tag);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedTags((prev) =>
                      prev.includes(item.tag)
                        ? prev.filter((tag) => tag !== item.tag)
                        : [...prev, item.tag]
                    );
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${isSelected
                    ? "border-zinc-800 bg-zinc-800 text-white"
                    : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                    }`}
                >
                  #{item.tag}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {hasSearched && displayBooks.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          検索結果がありません
        </div>
      )}
      <div className="grid gap-2 [grid-template-columns:repeat(3,minmax(0,1fr))] sm:gap-3 sm:[grid-template-columns:repeat(4,minmax(0,1fr))] md:gap-4 md:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {displayBooks.map((book) => (
          <div
            key={book.id}
            className="flex h-full min-w-0 cursor-pointer flex-col rounded-md border border-zinc-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-3"
            onClick={() => {
              router.push(`/book/${book.id}`);
            }}
            role="link"
            tabIndex={0}
            aria-label={`${book.title}の詳細ページを開く`}
          >
            <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded bg-zinc-100 sm:h-40 md:h-56">
              {book.thumbnail ? (
                <img
                  src={book.thumbnail}
                  alt={book.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-xs text-zinc-500">NO IMAGE</div>
              )}
            </div>
            <div className="mt-2 flex flex-1 flex-col gap-1 md:mt-3">
              <h2 className="line-clamp-2 text-[11px] font-semibold leading-tight text-zinc-900 md:text-sm">
                {book.title}
              </h2>
              <div className="mt-1 hidden md:block">
                {book.tags && book.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {book.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 text-[10px] leading-none text-zinc-600"
                      >
                        #{tag.tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="hidden line-clamp-1 text-xs text-zinc-600 md:block">
                {book.authors?.join(", ")}
              </p>
              <div className="mt-1 w-full max-w-[64px] md:max-w-[120px]">
                <Rating
                  style={{ maxWidth: "100%" }}
                  value={Number(book.averageRating ?? 0)}
                  readOnly
                />
              </div>
              {loanedSet.has(book.id) && (
                <span className="mt-1 inline-block w-fit rounded bg-red-100 px-1.5 py-0.5 text-[9px] text-red-700 md:px-2 md:text-[10px]">
                  貸出中
                </span>
              )}
              <p className="mt-auto hidden pt-2 text-[11px] text-zinc-500 md:block">
                ISBN: {book.isbn13}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
