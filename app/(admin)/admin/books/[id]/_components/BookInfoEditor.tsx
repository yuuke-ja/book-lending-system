"use client";

import LoadingSpinner from "@/app/_components/LoadingSpinner";
import { useState } from "react";

type BookInfoEditorProps = {
  bookId: string;
  initialTitle: string;
  initialDescription: string | null;
};

export default function BookInfoEditor({
  bookId,
  initialTitle,
  initialDescription,
}: BookInfoEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function changedetail() {
    try {
      setIsSaving(true);

      const res = await fetch(`/api/admin/books/${bookId}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
        }),
      });

      if (!res.ok) {
        throw new Error("変更に失敗しました");
      }

      alert("変更しました");
    } catch (error) {
      console.error("変更失敗", error);
      alert("変更に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-book-id={bookId}>
      <div className="space-y-1">
        <label
          htmlFor="book-title"
          className="text-xs font-semibold tracking-[0.08em] text-zinc-500"
        >
          タイトル
        </label>
        <textarea
          id="book-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-2xl font-semibold text-zinc-900 outline-none focus:border-zinc-500"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="book-description"
          className="text-xs font-semibold tracking-[0.08em] text-zinc-500"
        >
          詳細説明
        </label>
        <textarea
          id="book-description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-7 text-zinc-700 outline-none focus:border-zinc-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={changedetail}
          disabled={isSaving}
          className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <LoadingSpinner /> : "変更を保存"}
        </button>
      </div>
    </div>
  );
}
