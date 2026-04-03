"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type LinkedBook } from "./_components/types";

type ThreadResponse = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  bookTitle?: string | null;
  bookThumbnail?: string | null;
};

type Thread = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  linkedBook: LinkedBook | null;
};

const getKindLabel = (kind: string) => {
  if (kind === "BOOK_TOPIC") {
    return "本についての投稿";
  }

  if (kind === "BOOK_REQUEST") {
    return "本を探す相談";
  }

  return kind;
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

export default function CommunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [threadInput, setThreadInput] = useState("");
  const [linkedBooks, setLinkedBooks] = useState<LinkedBook[]>([]);
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);
  const draft = searchParams.get("draft");
  const scrollY = searchParams.get("scrollY");

  const fetchThreads = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/community/thread");
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "スレッドの取得に失敗しました"));
      }

      const data: ThreadResponse[] = await res.json();

      setThreads(
        Array.isArray(data)
          ? data.map((thread) => ({
            id: thread.id,
            content: thread.content,
            bookId: thread.bookId,
            kind: thread.kind,
            createdAt: thread.createdAt,
            linkedBook: thread.bookId
              ? {
                id: thread.bookId,
                title: thread.bookTitle ?? "関連する本",
                thumbnail: thread.bookThumbnail ?? null,
              }
              : null,
          }))
          : []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchThreads();
  }, []);

  useEffect(() => {
    const selectedBook = sessionStorage.getItem("selectedBook");
    if (selectedBook) {
      try {
        const { bookId, booktitle, bookthumbnail } = JSON.parse(selectedBook);
        setLinkedBooks([
          {
            id: bookId,
            title: booktitle,
            thumbnail: bookthumbnail,
          },
        ]);
      } catch {
        // ignore
      } finally {
        sessionStorage.removeItem("selectedBook");
      }
    }
    if (draft === null && scrollY === null) {
      return;
    }



    if (draft !== null) {
      setThreadInput(draft);
    }
    router.replace("/community", { scroll: false });
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
  ]);

  const handleThreadSubmit = async () => {
    if (!threadInput.trim() || isSubmittingThread) {
      return;
    }

    const selectedBook = linkedBooks[0] ?? null;
    const submitKind = selectedBook ? "BOOK_TOPIC" : "BOOK_REQUEST";

    try {
      setIsSubmittingThread(true);
      setSubmitError(null);

      const res = await fetch("/api/community/thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: submitKind,
          bookId: selectedBook?.id ?? null,
          content: threadInput.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "投稿の作成に失敗しました"));
      }

      const createdThread: ThreadResponse = await res.json();

      setThreads((prev) => [
        {
          id: createdThread.id,
          content: createdThread.content,
          bookId: createdThread.bookId,
          kind: createdThread.kind,
          createdAt: createdThread.createdAt,
          linkedBook: selectedBook
            ? {
              id: selectedBook.id,
              title: selectedBook.title,
              thumbnail: selectedBook.thumbnail,
            }
            : null,
        },
        ...prev,
      ]);
      setThreadInput("");
      setLinkedBooks([]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingThread(false);
    }
  };

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

  const openbookpicker = () => {
    router.push("/community/book-picker");
  };

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <textarea
          className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none"
          placeholder={
            linkedBooks.length > 0
              ? "この本について投稿する"
              : "本について質問する"
          }
          value={threadInput}
          onChange={(e) => setThreadInput(e.target.value)}
        />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openbookpicker}
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

        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleThreadSubmit}
            disabled={isSubmittingThread}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {isSubmittingThread ? "送信中..." : "投稿する"}
          </button>
        </div>
      </div>

      <section className="space-y-4">
        {threads.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-7 text-sm text-zinc-600 shadow-sm">
            まだスレッドはありません
          </div>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/community/${thread.id}`}
              className="block rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
                  {getKindLabel(thread.kind)}
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(thread.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
              <div className="mt-4 whitespace-pre-wrap text-lg leading-8 text-zinc-800">
                {thread.content}
              </div>

              {thread.linkedBook && (
                <div className="relative mt-6 overflow-hidden rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
                  <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-indigo-500" />
                  <div className="flex items-center gap-5 pl-2">
                    <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
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
                      <p className="text-xs font-semibold tracking-[0.08em] text-indigo-600">
                        LINKED BOOK
                      </p>
                      <p className="mt-3 line-clamp-2 text-2xl font-bold leading-tight text-zinc-900">
                        {thread.linkedBook.title}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Link>
          ))
        )}
      </section>
    </section>
  );
}
