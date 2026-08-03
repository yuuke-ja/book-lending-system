import Link from "next/link";
import Image from "next/image";

import { auth } from "@/lib/auth";
import { refreshAndGetUserRecommendations } from "@/lib/Recommended/refresh-and-get-user-recommendations";

type RecommendedBooksListProps = {
  sectionId?: string;
};

export default async function RecommendedBooksList({
  sectionId = "recommended-books",
}: RecommendedBooksListProps) {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return null;
  }

  const books = await getRecommendedBooks(userEmail);
  const hasError = books === null;

  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
            RECOMMENDED BOOKS
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">
            おすすめ本
          </h3>
        </div>
        {!hasError && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {books.length}冊
          </span>
        )}
      </div>

      {hasError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          おすすめ本の取得に失敗しました。
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          おすすめ本はまだありません。
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex w-max gap-4">
            {books.map((book) => (
              <Link
                key={book.id}
                href={`/book/${book.id}`}
                className="flex w-[240px] shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 hover:shadow-sm sm:w-[280px]"
              >
                <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100">
                  {book.thumbnail ? (
                    <Image
                      src={book.thumbnail}
                      alt={book.title}
                      width={80}
                      height={112}
                      sizes="80px"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-500">NO IMAGE</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-zinc-500">
                    #{book.rank}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">
                    {book.title}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                    {book.authors.join(", ")}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    ISBN/JAN: {book.isbn13}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

async function getRecommendedBooks(userEmail: string) {
  try {
    return await refreshAndGetUserRecommendations(userEmail);
  } catch (error) {
    console.error("おすすめ本の取得に失敗:", error);
    return null;
  }
}
