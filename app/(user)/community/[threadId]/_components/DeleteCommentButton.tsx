"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { deleteComment } from "@/lib/action/comment";

export default function DeleteCommentButton({
  commentId,
}: {
  commentId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    if (!window.confirm("このコメントを削除しますか？")) return;

    setIsDeleting(true);

    const result = await deleteComment(commentId);

    if (!result.ok) {
      window.alert(result.error);
      setIsDeleting(false);
      return;
    }

    setMessage(result.message ?? "コメントを削除しました");

    window.setTimeout(() => {
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
        className="inline-flex min-w-16 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? (
          <>
            <Spinner className="size-3.5" aria-hidden="true" />
            削除中...
          </>
        ) : (
          "削除"
        )}
      </button>
    </>
  );
}
