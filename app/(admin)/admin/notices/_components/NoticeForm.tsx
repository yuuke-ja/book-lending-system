"use client";

import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NoticeEditor from "./NoticeEditor";

const NOTICE_DRAFT_KEY = "noticeDraft";

type SelectedBook = {
  id: string;
  title: string;
  thumbnail: string | null;
};

export default function NoticeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<JSONContent | null>(null);
  const [initialContent, setInitialContent] = useState<JSONContent | null>(null);
  const [selectedBook, setSelectedBook] = useState<SelectedBook | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedDraft = sessionStorage.getItem(NOTICE_DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as {
          title?: unknown;
          content?: unknown;
        };

        if (typeof draft.title === "string") {
          setTitle(draft.title);
        }

        if (draft.content && typeof draft.content === "object") {
          const restoredContent = draft.content as JSONContent;
          setContent(restoredContent);
          setInitialContent(restoredContent);
          setResetKey((current) => current + 1);
        }
      } catch {
        // 壊れた一時データは破棄する
      } finally {
        sessionStorage.removeItem(NOTICE_DRAFT_KEY);
      }
    }

    const selectedBookValue = sessionStorage.getItem("selectedBook");
    if (!selectedBookValue) {
      return;
    }

    try {
      const book = JSON.parse(selectedBookValue) as {
        bookId?: unknown;
        booktitle?: unknown;
        bookthumbnail?: unknown;
      };

      if (typeof book.bookId === "string" && typeof book.booktitle === "string") {
        setSelectedBook({
          id: book.bookId,
          title: book.booktitle,
          thumbnail:
            typeof book.bookthumbnail === "string" ? book.bookthumbnail : null,
        });
      }
    } catch {
      // 壊れた選択データは破棄する
    } finally {
      sessionStorage.removeItem("selectedBook");
    }
  }, []);

  function openBookPicker() {
    sessionStorage.setItem(
      NOTICE_DRAFT_KEY,
      JSON.stringify({
        title,
        content,
      })
    );
    router.push("/community/book-picker?returnTo=/admin/notices");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/admin/notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          bookId: selectedBook?.id ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        window.alert(`エラー: ${data.error ?? "登録に失敗しました"}`);
        return;
      }

      window.alert("お知らせが保存されました");
      setTitle("");
      setContent(null);
      setInitialContent(null);
      setSelectedBook(null);
      setResetKey((current) => current + 1);
      router.refresh();
    } catch {
      window.alert("エラー: お知らせの登録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="notice-title" className="block text-sm font-medium text-zinc-800">
          タイトル
        </label>
        <input
          id="notice-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-800">本文</p>
        <NoticeEditor
          key={resetKey}
          onChange={setContent}
          initialContent={initialContent}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-zinc-800">紐付ける本</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openBookPicker}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700"
          >
            {selectedBook ? "本を選び直す" : "本を選択"}
          </button>
          {selectedBook && (
            <button
              type="button"
              onClick={() => setSelectedBook(null)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700"
            >
              紐付けを外す
            </button>
          )}
        </div>

        {selectedBook && (
          <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
              {selectedBook.thumbnail ? (
                <img
                  src={selectedBook.thumbnail}
                  alt={selectedBook.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[9px] text-zinc-400">NO IMAGE</span>
              )}
            </div>
            <p className="text-sm font-medium text-zinc-800">
              {selectedBook.title}
            </p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "登録中..." : "お知らせを登録"}
      </button>
    </form>
  );
}
