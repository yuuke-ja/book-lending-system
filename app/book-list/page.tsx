'use client';

import { useEffect, useState } from 'react';
import { BookDetailsModal } from './_components/BookDetailsModal';

type Book = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  description?: string | null;
  thumbnail?: string | null;
}

export default function BookListPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const res = await fetch('/api/book/list');
        if (!res.ok) throw new Error('本の取得に失敗しました');
        const data = await res.json();
        setBooks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>エラー: {error}</p>;

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      {selectedBook && (
        <BookDetailsModal
          isOpen={true}
          onClose={() => setSelectedBook(null)}
          title={selectedBook.title}
        >
          <div className="flex gap-4">
            {selectedBook.thumbnail && (
              <img
                src={selectedBook.thumbnail}
                alt={selectedBook.title}
                className="h-80 w-60 object-contain"
              />
            )}
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">
                {selectedBook.authors?.join(', ')}
              </p>
              <p className="text-xs text-zinc-500">
                ISBN: {selectedBook.isbn13}
              </p>
              {selectedBook.description && (
                <p className="text-sm text-zinc-700 font-medium">
                  {selectedBook.description}
                </p>
              )}
            </div>
          </div>
        </BookDetailsModal>
      )}
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">本一覧</h1>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {books.map((book) => (
          <div
            key={book.id}
            className="flex h-full flex-col rounded-md border border-zinc-200 bg-white p-3 shadow-sm"
            onClick={() => setSelectedBook(book)}
          >
            <div className="flex h-56 items-center justify-center overflow-hidden rounded bg-zinc-100">
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
            <div className="mt-3 flex flex-1 flex-col gap-1">
              <h2 className="text-sm font-semibold text-zinc-900">
                {book.title}
              </h2>
              <p className="text-xs text-zinc-600">
                {book.authors?.join(", ")}
              </p>
              <p className="mt-auto text-[11px] text-zinc-500">
                ISBN: {book.isbn13}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
