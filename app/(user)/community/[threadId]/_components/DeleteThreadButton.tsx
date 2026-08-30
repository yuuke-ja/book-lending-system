"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { deleteThread } from "@/lib/action/thread";

export default function DeleteThreadButton({
  threadId,
}: {
  threadId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    if (!window.confirm("この投稿を削除しますか？")) return;

    setIsDeleting(true);

    const result = await deleteThread(threadId);

    if (!result.ok) {
      window.alert(result.error);
      setIsDeleting(false);
      return;
    }

    setMessage(result.message ?? "スレッドを削除しました");

    window.setTimeout(() => {
      router.replace("/community");
      router.refresh();
    }, 800);
  }

  return (
    <>
      {message && (
        <div
          role="status"
          className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          {message}
        </div>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex min-w-20 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? (
          <>
            <Spinner aria-hidden="true" />
            削除中...
          </>
        ) : (
          "削除"
        )}
      </button>
    </>
  );
}
