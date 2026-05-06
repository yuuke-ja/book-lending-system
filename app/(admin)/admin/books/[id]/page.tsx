import { notFound } from "next/navigation";
import StarRating from "../_components/Rating";
import { getBookById } from "@/lib/books/get-book-by-id";
import { getTagList } from "@/lib/books/get-tag-list";
import { auth } from "@/lib/auth";
import { recordResearchEvent } from "@/lib/research-event.server";
import BackButton from "./_components/BackButton";
import BookInfoEditor from "./_components/BookInfoEditor";
import BookTagEditor from "./_components/BookTagEditor";

export default async function AdminBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [book, allTags] = await Promise.all([getBookById(id), getTagList()]);

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
              <BookInfoEditor
                bookId={book.id}
                initialTitle={book.title}
                initialDescription={book.description}
              />
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

            <BookTagEditor
              bookId={book.id}
              title={book.title}
              initialTags={book.tags}
              allTags={allTags}
            />
          </div>
        </div>
      </div>

    </section>
  );
}
