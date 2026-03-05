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
  tags?: { id: string; tag: string }[] | null;
};

type ReviewComment = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type TagItem = {
  id: string;
  tag: string;
};

type TagAdd = {
  bookId: string;
  title: string;
  tags: { id: string; tag: string }[];
};
type UpdateTag = {
  bookId: string;
  tagId: string;
  isRemove: boolean;
  new: boolean;
};

export default function BookListPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchBooks, setSearchBooks] = useState<Book[] | null>(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagadd, setTagadd] = useState<TagAdd | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [taglist, setTaglist] = useState<TagItem[]>([]);
  const [updatetag, setUpdatetag] = useState<UpdateTag[]>([]);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const displayBooks = searchBooks ?? books;
  const hasSearched = searchBooks !== null;
  const loanedSet = new Set(loanedBooks);
  const runSearch = useCallback((query: string) => {
    if (!query) {
      setSearchBooks(null);
      return;
    }
    const full = fetch(`/api/book/search/full-text?query=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error('全文検索に失敗しました');
        return res.json();
      });

    const tag = fetch(`/api/book/search/tag?query=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error('タグ検索に失敗しました');
        return res.json();
      });

    //全文検索とタグ検索を並列処理
    Promise.all([full, tag])
      .then(([fullBooks, tagBooks]) => {
        const merged = [...(fullBooks as Book[]), ...(tagBooks as Book[])];
        const unique = Array.from(
          new Map(merged.map((book) => [book.id, book])).values()
        );
        setSearchBooks(unique);
      })
      .catch((err) => {
        console.error('検索エラー:', err);
        alert(err instanceof Error ? err.message : 'エラーが発生しました');
      });
  }, []);

  //タグ候補クリック時に、タグ状態を追加/削除トグルする。
  const toggleTagInDraft = useCallback((bookId: string, tagId: string) => {
    setUpdatetag((prev) => {
      const exists = prev.some((item) => item.tagId === tagId);
      if (!exists) {
        return [...prev, { bookId, tagId, isRemove: false, new: true }];
      }
      return prev.map((item) =>
        item.tagId === tagId ? { ...item, isRemove: !item.isRemove } : item
      );
    });
  }, []);

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
  //本のタグ編集したものを更新する
  async function saveBookTags(bookId: string, updates: UpdateTag[]) {
    try {
      const tags = Array.from(
        new Set(
          updates
            .filter((item) => item.bookId === bookId && !item.isRemove)
            .map((item) => item.tagId)
        )
      );
      const res = await fetch('/api/admin/updatetags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          tags,
        }),
      });
      if (!res.ok) throw new Error('タグの保存に失敗しました');

      setBooks((prev) =>
        prev.map((book) =>
          book.id === bookId ? {
            ...book,
            tags: taglist.filter((t) => tags.includes(t.id)),
          } : book
        )
      );
      setTagadd((prev) => prev ? {
        ...prev,
        tags: taglist.filter((t) => tags.includes(t.id)),
      } : prev);
      setUpdatetag(
        tags.map((tagId) => ({
          bookId,
          tagId,
          isRemove: false,
          new: false,
        }))
      );
    } catch (err) {
      console.error('タグ保存エラー:', err);
      alert(err instanceof Error ? err.message : 'エラーが発生しました');
    }
  }

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

  //タグ候補
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch(`/api/book/search/gettag`)
        if (!res.ok) throw new Error('タグの取得に失敗しました');
        const data = await res.json();
        setTaglist(Array.isArray(data) ? data : []);

        console.log('タグの取得に成功:', data);
      }
      catch (err) {
        console.error('タグの取得エラー:', err);
        setTaglist([]);
      }
    }
    fetchTags();
  }, []);

  //管理者APIへアクセスし、管理者権限の有無を判定
  useEffect(() => {
    const fetchIsAdmin = async () => {
      try {
        const res = await fetch('/api/admin/tags', { cache: 'no-store' });
        setIsAdmin(res.ok);
      } catch {
        setIsAdmin(false);
      }
    };
    fetchIsAdmin();
  }, []);


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
      alert('星を1つ以上選おんでください');
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
      {selectedBook && !tagadd && (
        <BookDetailsModal
          isOpen={true}
          onClose={() => {
            setIsReviewModalOpen(false);
            setTagadd(null);
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
              <div className="mt-1">
                {selectedBook.tags && selectedBook.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedBook.tags.map((tag) => (
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
      {selectedBook && isReviewModalOpen && !tagadd && (
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
      {tagadd && isAdmin && (
        <BookDetailsModal
          isOpen={true}
          onClose={() => {
            setTagadd(null);
            setUpdatetag([]);
          }}
          title={`タグ変更: ${tagadd.title}`}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {tagadd.tags.length === 0 && (
                <p className="text-sm text-zinc-700">タグはまだありません。</p>
              )}
              {tagadd.tags.map((tag) => {
                const removed = updatetag.some(
                  (item) => item.tagId === tag.id && item.isRemove
                );
                return (
                  <span
                    key={tag.id}
                    className={`inline-flex rounded border px-1 py-0.5 text-[10px] leading-none ${removed
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-zinc-300 bg-zinc-50 text-zinc-600'
                      }`}
                  >
                    #{tag.tag}
                    <button
                      type="button"
                      onClick={() => toggleTagInDraft(tagadd.bookId, tag.id)}
                      className={
                        removed
                          ? 'text-red-600 hover:text-red-700'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }
                      aria-label={`${tag.tag}を削除`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            {taglist.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
                  候補タグ
                </p>
                <div className="flex flex-wrap gap-2">
                  {taglist.map((item) => {
                    const isSelected = updatetag.some(
                      (draft) => draft.tagId === item.id && !draft.isRemove && draft.new
                    );
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleTagInDraft(tagadd.bookId, item.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${isSelected
                          ? 'border-green-700 bg-green-700 text-white'
                          : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                          }`}
                      >
                        #{item.tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center justify-end">

            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={isSavingTags}
                onClick={async () => {
                  if (isSavingTags) return;
                  setIsSavingTags(true);
                  try {
                    await saveBookTags(tagadd.bookId, updatetag);
                  } finally {
                    setIsSavingTags(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingTags && (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent"
                    aria-hidden="true"
                  />
                )}
                {isSavingTags ? '保存中...' : '変更を保存'}
              </button>
            </div>
          </div>
        </BookDetailsModal>
      )}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const mergedQuery = [...selectedTags, searchQuery.trim()].filter(Boolean).join(' ');
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
        {taglist.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {taglist.map((item) => {
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
                    ? 'border-zinc-800 bg-zinc-800 text-white'
                    : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
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
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {displayBooks.map((book) => (
          <div
            key={book.id}
            className="flex h-full flex-col rounded-md border border-zinc-200 bg-white p-3 shadow-sm"
            onClick={async () => {
              setTagadd(null);
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
              <div className="mt-1">
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


              <p className="line-clamp-1 text-xs text-zinc-600">
                {book.authors?.join(", ")}
              </p>
              <div className="mt-1">
                <Rating style={{ maxWidth: 120 }} value={Number(book.averageRating ?? 0)} readOnly />
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReviewModalOpen(false);
                    const currentTags = book.tags ?? [];
                    setTagadd({
                      bookId: book.id,
                      title: book.title,
                      tags: currentTags,
                    });
                    setUpdatetag(
                      currentTags.map((tag) => ({
                        bookId: book.id,
                        tagId: tag.id,
                        isRemove: false,
                        new: false,
                      }))
                    );
                  }}
                  className="mt-1 w-fit rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  タグ変更
                </button>
              )}
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
