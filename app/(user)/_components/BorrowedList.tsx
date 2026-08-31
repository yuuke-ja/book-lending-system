import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getBorrowedList } from "@/lib/loans/get-user-loans";

type Loan = {
  id: string;
  loanedAt: string;
  dueAt?: string | null;
  book: {
    id: string;
    title: string;
    authors: string[];
    isbn13: string;
    thumbnail?: string | null;
  };
};

type BorrowedBooksListProps = {
  sectionId?: string;
};

export default async function BorrowedBooksList({
  sectionId = "borrowed-books",
}: BorrowedBooksListProps) {
  const session = await auth();
  const userEmail = session?.user?.email;
  let borrowedList: Loan[] = [];
  let error: string | null = null;

  try {
    if (userEmail) {
      borrowedList = await getBorrowedList(userEmail);
    }
  } catch (e) {
    console.error(e);
    error = "貸出履歴の取得に失敗しました";
  }

  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
            LOAN HISTORY
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">
            貸出履歴
          </h3>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {borrowedList.length}冊
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && borrowedList.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          貸出履歴はありません。
        </div>
      )}

      {!error && borrowedList.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex w-max gap-4">
            {borrowedList.map((borrowed) => {
              return (
                <Link
                  key={borrowed.id}
                  href={`/book/${borrowed.book.id}`}
                  className="flex w-[240px] shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 hover:shadow-sm sm:w-[280px]"
                >
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100">
                    {borrowed.book.thumbnail ? (
                      <Image
                        src={borrowed.book.thumbnail}
                        alt={borrowed.book.title}
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
                    <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
                      {borrowed.book.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                      {borrowed.book.authors.join(", ")}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      ISBN/JAN: {borrowed.book.isbn13}
                    </p>


                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
