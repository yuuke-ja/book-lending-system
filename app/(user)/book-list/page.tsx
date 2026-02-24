'use client';

import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { BookDetailsModal } from './_components/BookDetailsModal';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [loanedBooks, setLoanedBooks] = useState<string[]>([]);
  const loanedSet = new Set(loanedBooks);

  // 貸出状況を取得する（貸出中判定に使う）
  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch('/api/book/loan');
      if (!res.ok) throw new Error('貸出状況の取得に失敗しました');
      const data = await res.json();
      const bookIds = Array.isArray(data)
        ? data.map((loan) => loan.bookId).filter(Boolean)
        : [];
      setLoanedBooks(bookIds);
    } catch (err) {
      console.error('貸出状況取得エラー:', err);
    }
  }, []);

  // 初回レンダリング時に貸出状況を取得する
  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // SupabaseのLoanテーブル変更をリアルタイム購読。
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('loan-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Loan' },
        () => {
          fetchLoans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLoans]);

  useEffect(() => {
    // 本一覧を取得する
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        読み込み中...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        エラー: {error}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {selectedBook && (
        <BookDetailsModal
          isOpen={true}
          onClose={() => setSelectedBook(null)}
          title={selectedBook.title}
        >
          {loanedSet.has(selectedBook.id) && (
            <p className="mb-2 text-xs font-semibold text-red-600">貸出中</p>
          )}
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">本一覧</h1>
        <p className="mt-1 text-sm text-zinc-600">
          登録済みの本を一覧表示します。カードを押すと詳細を確認できます。
        </p>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {books.map((book) => (
          <div
            key={book.id}
            className="flex h-full flex-col rounded-md border border-zinc-200 bg-white p-3 shadow-sm"
            onClick={() => setSelectedBook(book)}
          >
            <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded bg-zinc-100">
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
              <h2 className="line-clamp-2 text-sm font-semibold text-zinc-900">
                {book.title}
              </h2>
              <p className="line-clamp-1 text-xs text-zinc-600">
                {book.authors?.join(", ")}
              </p>
              {loanedSet.has(book.id) && (
                <span className="mt-1 inline-block w-fit rounded bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                  貸出中
                </span>
              )}
              <p className="mt-auto pt-2 text-[11px] text-zinc-500">
                ISBN: {book.isbn13}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
