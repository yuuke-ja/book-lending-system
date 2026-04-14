"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LinkedBook } from "../../_components/types";

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

function getScrollTop() {
  const main = document.querySelector("main");
  return main instanceof HTMLElement && main.scrollHeight > main.clientHeight
    ? main.scrollTop
    : window.scrollY;
}

export default function CommentComposer({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [commentInput, setCommentInput] = useState("");
  const [linkedBooks, setLinkedBooks] = useState<LinkedBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (!threadId) {
      return;
    }

    const savedCommentDraftState = sessionStorage.getItem("commentDraftState");
    if (!savedCommentDraftState) {
      return;
    }

    try {
      const { draft, scrollY, savedThreadId } = JSON.parse(savedCommentDraftState);
      if (savedThreadId !== threadId) {
        return;
      }

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

      if (typeof draft === "string") {
        setCommentInput(draft);
      }

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
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem("commentDraftState");
    }
  }, [threadId]);

  const openbookpicker = () => {
    sessionStorage.setItem(
      "commentDraftState",
      JSON.stringify({
        savedThreadId: threadId,
        draft: commentInput,
        scrollY: getScrollTop(),
      })
    );
    router.push("/community/book-picker");
  };

  const handleCommentSubmit = async () => {
    if (!threadId || !commentInput.trim() || isSubmittingComment) {
      return;
    }

    try {
      setIsSubmittingComment(true);
      setError(null);

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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

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
  );
}
