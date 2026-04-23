import { notFound } from "next/navigation";
import StarRating from "@/app/(user)/book-list/_components/Rating";
import { getBookById } from "@/lib/books/get-book-by-id";
import { auth } from "@/lib/auth";
import { recordResearchEvent } from "@/lib/research-event.server";
import BookThreadSection from "./_components/BookThreadSection";
import BackButton from "./_components/BackButton";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await getBookById(id);

  if (!book) {
    notFound();
  }

  const session = await auth();
  const userEmail = session?.user?.email;

  if (userEmail) {
    await recordResearchEvent({
      eventType: "book_detail_view",
      userEmail,
      bookId: book.id,
      sourceType: "direct",
      sourceId: null,
    });
  }

  return (
    <section className="space-y-6">
      <BackButton />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex items-start justify-center">
            <div className="flex h-72 w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              {book.thumbnail ? (
                <img
                  src={book.thumbnail}
                  alt={book.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-sm text-zinc-500">NO IMAGE</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
                BOOK
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900">
                {book.title}
              </h1>
              {book.authors && book.authors.length > 0 && (
                <p className="text-sm text-zinc-600">{book.authors.join(", ")}</p>
              )}
              <p className="text-sm text-zinc-500">ISBN/JAN: {book.isbn13}</p>
            </div>

            <StarRating
              value={book.averageRating}
              ratingCount={book.ratingCount}
              showSummaryPanel
              maxWidth={132}
            />

            {book.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    #{tag.tag}
                  </span>
                ))}
              </div>
            )}

            {book.description && (
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                {book.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <BookThreadSection bookId={book.id} />
    </section>
  );
}
