"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import CommentTree, { type ThreadCommentNode } from "./_components/CommentTree";
import { type LinkedBook } from "../_components/types";

type Thread = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  linkedBook: LinkedBook | null;
};

type ThreadComment = {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  linkedBooks: LinkedBook[];
};

const getErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim() !== "") {
      return data.error;
    }
  } catch {
    // ignore
  }

  return fallback;
};

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = Array.isArray(params.threadId)
    ? params.threadId[0]
    : params.threadId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roots, setroots] = useState<ThreadCommentNode[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [linkedBooks, setLinkedBooks] = useState<LinkedBook[]>([]);
  const selectedBookId = searchParams.get("bookId");
  const selectedBookTitle = searchParams.get("bookTitle");
  const selectedBookThumbnail = searchParams.get("bookThumbnail");
  const target = searchParams.get("target");
  const draft = searchParams.get("draft");
  const scrollY = searchParams.get("scrollY");

  const getScrollTop = () => {
    const main = document.querySelector("main");
    return main instanceof HTMLElement && main.scrollHeight > main.clientHeight
      ? main.scrollTop
      : window.scrollY;
  };

  const fetchThreadData = async (currentThreadId: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/community/thread/${currentThreadId}`);
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "スレッドの取得に失敗しました"));
      }

      const data = await res.json();
      const commentList: ThreadComment[] = Array.isArray(data.comments)
        ? data.comments
        : [];

      setThread(data.thread ?? null);

      const list: Record<string, ThreadCommentNode> = {};
      commentList.forEach((item) => {
        list[item.id] = { ...item, children: [] };
      });

      const rootList: ThreadCommentNode[] = [];
      commentList.forEach((item) => {
        if (item.parentCommentId && list[item.parentCommentId]) {
          list[item.parentCommentId].children.push(list[item.id]);
        } else {
          rootList.push(list[item.id]);
        }
      });

      setroots(rootList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!threadId || !commentInput.trim() || isSubmittingComment) {
      return;
    }

    try {
      setIsSubmittingComment(true);

      const res = await fetch("/api/community/comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          content: commentInput.trim(),
          bookIds: linkedBooks.map((book) => book.id),
        }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "コメントの投稿に失敗しました"));
      }

      setCommentInput("");
      setLinkedBooks([]);
      await fetchThreadData(threadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  useEffect(() => {
    if (!threadId) return;
    void fetchThreadData(threadId);
  }, [threadId]);

  useEffect(() => {
    if (
      target !== "comment" ||
      !threadId ||
      (!selectedBookId && draft === null && scrollY === null)
    ) {
      return;
    }

    if (selectedBookId && selectedBookTitle) {
      setLinkedBooks([
        {
          id: selectedBookId,
          title: selectedBookTitle,
          thumbnail: selectedBookThumbnail,
        },
      ]);
    }
    if (draft !== null) {
      setCommentInput(draft);
    }
    router.replace(`/community/${threadId}`, { scroll: false });
    if (scrollY !== null) {
      const top = Number(scrollY);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const main = document.querySelector("main");
          if (
            main instanceof HTMLElement &&
            main.scrollHeight > main.clientHeight &&
            Number.isFinite(top)
          ) {
            main.scrollTo({ top });
            return;
          }
          if (Number.isFinite(top)) {
            window.scrollTo({ top });
          }
        });
      });
    }
  }, [
    draft,
    router,
    scrollY,
    selectedBookId,
    selectedBookThumbnail,
    selectedBookTitle,
    target,
    threadId,
  ]);

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
        {error}
      </div>
    );
  }

  const handleOpenBookPicker = () => {
    const commentReturnParams = new URLSearchParams({
      target: "comment",
      scrollY: String(getScrollTop()),
    });
    if (commentInput !== "") {
      commentReturnParams.set("draft", commentInput);
    }
    const commentReturnTo = `/community/${threadId}?${commentReturnParams.toString()}`;
    router.push(
      `/community/book-picker?returnTo=${encodeURIComponent(commentReturnTo)}`
    );
  };
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/community");
  };

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <button
          type="button"
          onClick={handleBack}
          aria-label="戻る"
          title="戻る"
          className="inline-flex h-10 w-10 items-center justify-center text-lg font-semibold text-zinc-700"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-5 w-5"
          >
            <path
              d="M12.5 5 7.5 10l5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
          THREAD
        </p>
        <div className="mt-5 whitespace-pre-wrap text-lg leading-8 text-zinc-800">
          {thread?.content ?? "スレッド本文がありません"}
        </div>

        {thread?.linkedBook && (
          <div className="relative mt-6 overflow-hidden rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
            <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-indigo-500" />
            <div className="flex items-center gap-5 pl-2">
              <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {thread.linkedBook.thumbnail ? (
                  <img
                    src={thread.linkedBook.thumbnail}
                    alt={thread.linkedBook.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-[10px] text-zinc-400">NO IMAGE</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="mt-3 line-clamp-2 text-2xl font-bold leading-tight text-zinc-900">
                  {thread.linkedBook.title}
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <h2 className="text-2xl font-bold text-zinc-900">コメント投稿</h2>

        <div className="mt-5 space-y-4">
          <textarea
            className="min-h-32 w-full rounded-2xl border border-zinc-300 px-5 py-4 text-base text-zinc-900 outline-none"
            placeholder="コメントを書く"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenBookPicker}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
              >
                {linkedBooks.length > 0 ? "本を選び直す" : "本を紐付ける"}
              </button>
              {linkedBooks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLinkedBooks([])}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                >
                  外す
                </button>
              )}
            </div>

            {linkedBooks.map((book) => (
              <div
                key={book.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                  {book.thumbnail ? (
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="text-[10px] text-zinc-400">NO IMAGE</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-zinc-800">
                    {book.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCommentSubmit}
              disabled={isSubmittingComment}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white"
            >
              {isSubmittingComment ? "送信中..." : "コメントする"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900">コメント</h2>
        </div>

        <div className="mt-6 space-y-5">
          {roots.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
              コメントはまだありません
            </div>
          ) : (
            <CommentTree
              comments={roots}
              threadId={threadId}
              onReload={async () => {
                await fetchThreadData(threadId);
              }}
            />
          )}
        </div>
      </section>
    </section>
  );
}
