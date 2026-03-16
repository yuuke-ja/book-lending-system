"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type LinkedBook } from "../../_components/types";

export type ThreadCommentNode = {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  linkedBooks: LinkedBook[];
  children: ThreadCommentNode[];
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

function CommentTreeItem({
  comment,
  threadId,
  onReload,
  depth = 0,
}: {
  comment: ThreadCommentNode;
  threadId: string;
  onReload: () => Promise<void>;
  depth?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isReplying, setIsReplying] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [linkedBooks, setLinkedBooks] = useState<LinkedBook[]>([]);
  const selectedBookId = searchParams.get("bookId");
  const selectedBookTitle = searchParams.get("bookTitle");
  const selectedBookThumbnail = searchParams.get("bookThumbnail");
  const replyTo = searchParams.get("replyTo");
  const draft = searchParams.get("draft");
  const scrollY = searchParams.get("scrollY");

  const getScrollTop = () => {
    const main = document.querySelector("main");
    return main instanceof HTMLElement && main.scrollHeight > main.clientHeight
      ? main.scrollTop
      : window.scrollY;
  };

  useEffect(() => {
    if (
      replyTo !== comment.id ||
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
      setReplyInput(draft);
    }
    setIsReplying(true);
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
    comment.id,
    draft,
    replyTo,
    router,
    scrollY,
    selectedBookId,
    selectedBookThumbnail,
    selectedBookTitle,
    threadId,
  ]);

  const handleReplySubmit = async () => {
    if (!replyInput.trim() || isSubmittingReply) {
      return;
    }

    try {
      setIsSubmittingReply(true);

      const res = await fetch("/api/community/comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          parentCommentId: comment.id,
          content: replyInput.trim(),
          bookIds: linkedBooks.map((book) => book.id),
        }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "返信の投稿に失敗しました"));
      }

      setReplyInput("");
      setLinkedBooks([]);
      setIsReplying(false);
      await onReload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleOpenBookPicker = () => {
    const replyReturnParams = new URLSearchParams({
      replyTo: comment.id,
      scrollY: String(getScrollTop()),
    });
    if (replyInput !== "") {
      replyReturnParams.set("draft", replyInput);
    }
    const replyReturnTo = `/community/${threadId}?${replyReturnParams.toString()}`;
    router.push(
      `/community/book-picker?returnTo=${encodeURIComponent(replyReturnTo)}`
    );
  };

  return (
    <div className={depth > 0 ? "ml-6 border-l border-zinc-200 pl-5" : ""}>
      <div className="text-sm text-zinc-700">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-zinc-400">
              {new Date(comment.createdAt).toLocaleString("ja-JP")}
            </p>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-zinc-800">
            {comment.content}
          </p>
        </div>

        {comment.linkedBooks.length > 0 && (
          <div className="mt-4 space-y-3">
            {comment.linkedBooks.map((book) => (
              <div
                key={book.id}
                className="relative inline-flex max-w-[520px] overflow-hidden rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm"
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 bg-indigo-500" />
                <div
                  onClick={() => {
                    router.push(`/book/${book.id}`);
                  }}
                  className="flex items-center gap-4 pl-1"
                >
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
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
                  <div className="min-w-0">
                    <p className="mt-2 line-clamp-2 max-w-[320px] text-lg font-bold leading-tight text-zinc-900">
                      {book.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsReplying((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {isReplying ? "返信フォームを閉じる" : "返信する"}
          </button>
        </div>
      </div>

      {isReplying && (
        <div className="mt-4 ml-11 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <textarea
            className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none"
            placeholder="返信を書く"
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
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
              onClick={handleReplySubmit}
              disabled={isSubmittingReply}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {isSubmittingReply ? "送信中..." : "返信する"}
            </button>
          </div>
        </div>
      )}

      {comment.children.length > 0 && (
        <div className="mt-4 space-y-5">
          {comment.children.map((child) => (
            <CommentTreeItem
              key={child.id}
              comment={child}
              threadId={threadId}
              onReload={onReload}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentTree({
  comments,
  threadId,
  onReload,
}: {
  comments: ThreadCommentNode[];
  threadId: string;
  onReload: () => Promise<void>;
}) {
  return (
    <>
      {comments.map((comment) => (
        <CommentTreeItem
          key={comment.id}
          comment={comment}
          threadId={threadId}
          onReload={onReload}
        />
      ))}
    </>
  );
}
