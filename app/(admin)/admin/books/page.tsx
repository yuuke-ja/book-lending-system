import Link from "next/link";
import { getBookList } from "@/lib/books/get-book-list";
import type { BookListBook } from "@/lib/books/book-list-types";
import { getBookEmbeddingCount } from "@/lib/books/get-book-embedding-count";
import BookEmbeddingStatusBar from "./_components/BookEmbeddingStatusBar";
import StarRating from "./_components/Rating";

async function getAdminBookListData() {
  try {
    const books = await getBookList();
    return books;
  } catch (error) {
    console.error("管理者本一覧ページの初期表示に失敗:", error);
    return null;
  }
}

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = resolvedSearchParams.query?.trim() ?? "";
  const books = await getAdminBookListData();
  const embeddingCount = await getBookEmbeddingCount();

  if (!books) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        エラー: 本一覧の取得に失敗しました
      </div>
    );
  }

  function matchesQuery(book: BookListBook, query: string) {
    const searchText = [
      book.title,
      book.authors?.join(" "),
      book.isbn13,
      book.tags?.map((tag) => tag.tag).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => searchText.includes(word));
  }

  const displayBooks = query ? books.filter((book) => matchesQuery(book, query)) : books;
  const hasSearched = query.length > 0;

  return (
    <section className="space-y-5">
      <BookEmbeddingStatusBar embeddingCount={embeddingCount} />

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form action="/admin/books" className="space-y-2">
          <label
            htmlFor="book-search-input"
            className="block text-xs font-semibold tracking-[0.08em] text-zinc-500"
          >
            検索
          </label>
          <div className="flex gap-2">
            <input
              id="book-search-input"
              type="text"
              name="query"
              defaultValue={query}
              placeholder="タイトル・著者・概要で検索"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              検索
            </button>
          </div>
        </form>
      </div>

      {hasSearched && displayBooks.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          検索結果がありません
        </div>
      )}

      <div className="grid gap-2 [grid-template-columns:repeat(3,minmax(0,1fr))] sm:gap-3 sm:[grid-template-columns:repeat(4,minmax(0,1fr))] md:gap-4 md:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {displayBooks.map((book) => (
          <Link
            key={book.id}
            href={`/admin/books/${book.id}`}
            className="flex h-full min-w-0 flex-col rounded-md border border-zinc-200 bg-white p-2 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 md:p-3"
            aria-label={`${book.title}の詳細`}
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
                <StarRating value={Number(book.averageRating ?? 0)} maxWidth={120} />
              </div>
              <p className="mt-auto hidden pt-2 text-[11px] text-zinc-500 md:block">
                ISBN: {book.isbn13}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
