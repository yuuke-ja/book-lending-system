'use client';

import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { BookDetailsModal } from './_components/BookDetailsModal';
import StarRating from './_components/Rating';
import { Rating } from '@smastrom/react-rating';

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
  averageRating?: number | null;
  ratingCount?: number | null;
};

type ReviewComment = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export default function BookListPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [usercomment, setUsercomment] = useState('');
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [isPostingReview, setIsPostingReview] = useState(false);
  const [loanedBooks, setLoanedBooks] = useState<string[]>([]);
  const loanedSet = new Set(loanedBooks);
  // 貸出状況を取得する（貸出中判定に使う）
  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch('/api/book/Everyoneborrowed');
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

  //本をクリックしたらコメントを習得する。
  async function getcomment(bookId: string) {
    try {
      const res = await fetch(`/api/book/review?bookId=${bookId}`);
      if (!res.ok) throw new Error('レビューのコメントの取得に失敗しました');
      const data = await res.json();
      const comment = data.userReview?.comment ?? '';
      setDraftComment(comment);
      setUsercomment(comment);
      setDraftRating(Number(data.userReview?.rating ?? 0));
      setReviewComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      console.error('レビュー取得エラー:', err);
      setDraftComment('');
      setUsercomment('');
      setDraftRating(0);
      setReviewComments([]);
    }
  }
  async function postreview() {
    if (!selectedBook) {
      alert('本が選択されていません');
      return;
    }
    if (draftRating < 1) {
      alert('星を1つ以上選んでください');
      return;
    }
    if (isPostingReview) return;

    setIsPostingReview(true);
    try {
      const res = await fetch('/api/book/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: selectedBook.id,
          rating: draftRating,
          comment: usercomment,
        }),
      });
      if (!res.ok) throw new Error('レビューの投稿に失敗しました');

      const contentType = res.headers.get('content-type') ?? '';
      let message = 'レビューを投稿しました';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        message = data?.message ?? message;
      }
      alert(message);
      setIsReviewModalOpen(false);
      await getcomment(selectedBook.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsPostingReview(false);
    }
  }

  useEffect(() => {
    setIsReviewModalOpen(false);
    setDraftRating(0);
    setDraftComment('');
    setUsercomment('');
    setReviewComments([]);
  }, [selectedBook?.id]);

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
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedBook(null);
          }}
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
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm text-zinc-600">
                {selectedBook.authors?.join(', ')}
              </p>
              <p className="text-xs text-zinc-500">
                ISBN: {selectedBook.isbn13}
              </p>
              <StarRating
                value={selectedBook.averageRating ?? 0}
                ratingCount={selectedBook.ratingCount ?? 0}
                maxWidth={112}
                showSummaryPanel
                compact
                onReviewClick={() => setIsReviewModalOpen(true)}
              />
              {selectedBook.description && (
                <p className="text-sm font-medium text-zinc-700">
                  {selectedBook.description}
                </p>
              )}

              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-zinc-500">
                  コメント一覧
                </p>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                  {reviewComments.length === 0 && (
                    <p className="text-sm text-zinc-500">コメントはまだありません。</p>
                  )}
                  {reviewComments.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-md border border-zinc-200 bg-white p-2.5"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">

                        <Rating
                          style={{ maxWidth: 84 }}
                          value={Number(review.rating ?? 0)}
                          readOnly
                        />
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-zinc-700">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </BookDetailsModal>
      )}
      {selectedBook && isReviewModalOpen && (
        <BookDetailsModal
          isOpen={true}
          onClose={() => setIsReviewModalOpen(false)}
          title={`レビュー投稿: ${selectedBook.title}`}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
                あなたの評価
              </p>
              <div>
                <Rating
                  style={{ maxWidth: 140 }}
                  value={draftRating}
                  onChange={setDraftRating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="review-comment"
                className="text-xs font-semibold tracking-[0.08em] text-zinc-500"
              >
                レビュー本文
              </label>
              <textarea
                id="review-comment"
                value={usercomment}
                onChange={(e) => setUsercomment(e.target.value)}
                rows={6}
                placeholder={draftComment ? 'レビューを編集してください' : '感想を書いてください'}
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-800 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={postreview}
                disabled={isPostingReview}
                className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                {isPostingReview ? '投稿中...' : '投稿する'}
              </button>
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
            onClick={async () => {
              setSelectedBook(book);
              await getcomment(book.id);
            }}
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
              <div className="mt-1">
                <Rating style={{ maxWidth: 120 }} value={Number(book.averageRating ?? 0)} readOnly />
              </div>
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
