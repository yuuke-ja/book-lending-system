"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { type LinkedBook } from "../../_components/types";
import type { ThreadCommentNode } from "./types";
export type { ThreadCommentNode } from "./types";

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
  depth = 0,
}: {
  comment: ThreadCommentNode;
  threadId: string;
  depth?: number;
}) {
  const router = useRouter();
  const [isReplying, setIsReplying] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [linkedBooks, setLinkedBooks] = useState<LinkedBook[]>([]);
  const commentRef = useRef<HTMLDivElement>(null);

  const getScrollTop = () => {
    const main = document.querySelector("main");
    return main instanceof HTMLElement && main.scrollHeight > main.clientHeight
      ? main.scrollTop
      : window.scrollY;
  };

  useEffect(() => {
    const element = commentRef.current;
    if (!element || comment.linkedBooks.length === 0) {
      return;
    }

    let sent = false;
    let timer: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (sent) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timer !== null) {
            return;
          }

          timer = window.setTimeout(() => {
            if (sent) return;
            sent = true;
            fetch("/api/comment/research-event", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                eventType: "post_view",
                bookId: comment.linkedBooks[0].id,
                sourceType: "comment",
                sourceId: comment.id,
              }),
              keepalive: true,
            })

              .catch(() => {
                // ignore
              });
          }, 1000);
          return;
        }
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0.5] }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [comment.id, comment.linkedBooks]);

  useEffect(() => {
    const savedReplyDraftState = sessionStorage.getItem("replyDraftState");
    if (!savedReplyDraftState) {
      return;
    }

    try {
      const { draft, scrollY, savedThreadId, savedReplyTo } = JSON.parse(savedReplyDraftState);
      if (savedThreadId !== threadId || savedReplyTo !== comment.id) {
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
        setReplyInput(draft);
      }
      setIsReplying(true);

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
    }
    sessionStorage.removeItem("replyDraftState");
  }, [comment.id, threadId]);

  // 送信処理
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
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // 本紐付け処理
  const openbookpicker = () => {
    sessionStorage.setItem(
      "replyDraftState",
      JSON.stringify({
        savedThreadId: threadId,
        savedReplyTo: comment.id,
        draft: replyInput,
        scrollY: getScrollTop(),
      })
    );
    router.push("/community/book-picker");
  };

  return (
    <div ref={commentRef} className={depth > 0 ? "ml-6 border-l border-zinc-200 pl-5" : ""}>
      <div className="text-sm text-zinc-700">
        {/*投稿日時と本文を表示*/}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img
              src={comment.authorAvatarUrl || "/default-avatar.svg"}
              alt={comment.nickname ?? "投稿者"}
              className="h-10 w-10 rounded-full border border-zinc-200 bg-zinc-100 object-cover"
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-zinc-900">
                {comment.nickname || "未設定"}
              </p>
              <p className="text-sm text-zinc-400">
                {new Date(comment.createdAt).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-zinc-800">
            {comment.content}
          </p>
        </div>
        { /*紐付けられている本があれば一覧表示*/}
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
      {/*返信*/}
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
          {/*子コメント再帰*/}
          {comment.children.map((child) => (
            <CommentTreeItem
              key={child.id}
              comment={child}
              threadId={threadId}
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
}: {
  comments: ThreadCommentNode[];
  threadId: string;
}) {
  return (
    <>
      {comments.map((comment) => (
        <CommentTreeItem key={comment.id} comment={comment} threadId={threadId} />
      ))}
    </>
  );
}
