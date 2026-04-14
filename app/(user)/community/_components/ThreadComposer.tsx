"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LinkedBook } from "./types";

const COMMUNITY_DRAFT_STATE_KEY = "communityDraftState";

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

export default function ThreadComposer() {
  const router = useRouter();
  const [threadInput, setThreadInput] = useState("");
  const [linkedBooks, setLinkedBooks] = useState<LinkedBook[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);

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

    const savedDraftState = sessionStorage.getItem(COMMUNITY_DRAFT_STATE_KEY);
    if (!savedDraftState) {
      return;
    }

    try {
      const { draft, scrollY } = JSON.parse(savedDraftState);
      if (typeof draft === "string") {
        setThreadInput(draft);
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
      sessionStorage.removeItem(COMMUNITY_DRAFT_STATE_KEY);
    }
  }, []);

  const openBookPicker = () => {
    sessionStorage.setItem(
      COMMUNITY_DRAFT_STATE_KEY,
      JSON.stringify({
        draft: threadInput,
        scrollY: getScrollTop(),
      })
    );
    router.push("/community/book-picker");
  };

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

      setThreadInput("");
      setLinkedBooks([]);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingThread(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <textarea
        className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none"
        placeholder="投稿を書く"
        value={threadInput}
        onChange={(e) => setThreadInput(e.target.value)}
      />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openBookPicker}
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
  );
}
