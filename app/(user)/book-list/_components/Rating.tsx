"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rating } from "@smastrom/react-rating";
import "@smastrom/react-rating/style.css";

type RatingProps = {
  bookId?: string;
  value?: number;
  maxWidth?: number;
  ratingCount?: number | null;
  showSummaryPanel?: boolean;
  compact?: boolean;
};

export default function StarRating({
  bookId,
  value,
  maxWidth = 120,
  ratingCount,
  showSummaryPanel = false,
  compact = false,
}: RatingProps) {
  const router = useRouter();
  const safeValue = Number(value ?? 0);
  const [openStarModal, setOpenStarModal] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [isPostingReview, setIsPostingReview] = useState(false);

  useEffect(() => {
    if (!bookId) return;

    let cancelled = false;

    async function fetchUserReview() {
      try {
        const res = await fetch(`/api/book/review?bookId=${bookId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("レビューの取得に失敗しました");

        const data = await res.json();
        if (!cancelled) {
          setDraftRating(Number(data.userReview?.rating ?? 0));
        }
      } catch (error) {
        console.error("レビュー取得エラー:", error);
        if (!cancelled) {
          setDraftRating(0);
        }
      }
    }

    fetchUserReview();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  async function postreview() {
    if (!bookId) {
      alert("本が選択されていません");
      return;
    }

    if (draftRating < 1) {
      alert("星を1つ以上選んでください");
      return;
    }

    if (isPostingReview) return;

    setIsPostingReview(true);
    try {
      const res = await fetch("/api/book/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookId,
          rating: draftRating,
        }),
      });

      if (!res.ok) {
        throw new Error("レビューの送信に失敗しました");
      }
      setOpenStarModal(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setIsPostingReview(false);
    }
  }

  if (showSummaryPanel) {
    return (
      <>
        {openStarModal && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
                  あなたの評価
                </p>
                <Rating
                  style={{ maxWidth: 140 }}
                  value={draftRating}
                  onChange={setDraftRating}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenStarModal(false)}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={postreview}
                  disabled={isPostingReview}
                  className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {isPostingReview ? "送信中..." : "送信"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          className={
            compact
              ? "w-fit"
              : "rounded-lg border border-zinc-200 bg-zinc-50 p-3"
          }
        >
          <div
            className={
              compact
                ? "flex items-center gap-2"
                : "flex items-center justify-between gap-3"
            }
          >
            <div>
              <div
                className={
                  compact
                    ? "flex items-center gap-1.5"
                    : "mt-1 flex items-center gap-2"
                }
              >
                <Rating style={{ maxWidth }} value={safeValue} readOnly />
                <span
                  className={
                    compact
                      ? "text-xs font-semibold text-zinc-800"
                      : "text-sm font-semibold text-zinc-800"
                  }
                >
                  {safeValue.toFixed(1)}
                </span>
                <span className="text-xs text-zinc-500">
                  ({Number(ratingCount ?? 0)}件)
                </span>
              </div>
            </div>

            {bookId && (
              <button
                type="button"
                onClick={() => setOpenStarModal(true)}
                className={
                  compact
                    ? "shrink-0 px-1 py-0.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900"
                    : "shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                }
              >
                レビューする
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  return <Rating style={{ maxWidth }} value={safeValue} readOnly />;
}
