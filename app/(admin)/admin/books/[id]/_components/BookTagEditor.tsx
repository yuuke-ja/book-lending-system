"use client";

import LoadingSpinner from "@/app/_components/LoadingSpinner";
import { useCallback, useEffect, useState } from "react";

type TagItem = {
  id: string;
  tag: string;
};

type TagAdd = {
  bookId: string;
  title: string;
  tags: TagItem[];
};

type UpdateTag = {
  bookId: string;
  tagId: string;
  isRemove: boolean;
  new: boolean;
};

type BookTagEditorProps = {
  bookId: string;
  title: string;
  initialTags: TagItem[];
  allTags: TagItem[];
};

export default function BookTagEditor({
  bookId,
  title,
  initialTags,
  allTags,
}: BookTagEditorProps) {
  const [currentTags, setCurrentTags] = useState<TagItem[]>(initialTags);
  const [tagadd, setTagadd] = useState<TagAdd | null>(null);
  const [updatetag, setUpdatetag] = useState<UpdateTag[]>(
    initialTags.map((tag) => ({
      bookId,
      tagId: tag.id,
      isRemove: false,
      new: false,
    }))
  );
  const [isSavingTags, setIsSavingTags] = useState(false);

  const toggleTagInDraft = useCallback((bookId: string, tagId: string) => {
    setUpdatetag((prev) => {
      const exists = prev.some((item) => item.tagId === tagId);
      if (!exists) {
        return [...prev, { bookId, tagId, isRemove: false, new: true }];
      }
      return prev.map((item) =>
        item.tagId === tagId ? { ...item, isRemove: !item.isRemove } : item
      );
    });
  }, []);

  async function saveBookTags(targetBookId: string, updates: UpdateTag[]) {
    try {
      const tags = Array.from(
        new Set(
          updates
            .filter((item) => item.bookId === targetBookId && !item.isRemove)
            .map((item) => item.tagId)
        )
      );
      const res = await fetch("/api/admin/updatetags", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookId: targetBookId,
          tags,
        }),
      });
      if (!res.ok) throw new Error("タグの保存に失敗しました");

      const nextTags = allTags.filter((tag) => tags.includes(tag.id));
      setCurrentTags(nextTags);
      setTagadd((prev) =>
        prev
          ? {
              ...prev,
              tags: nextTags,
            }
          : prev
      );
      setUpdatetag(
        tags.map((tagId) => ({
          bookId: targetBookId,
          tagId,
          isRemove: false,
          new: false,
        }))
      );
    } catch (err) {
      console.error("タグ保存エラー:", err);
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    }
  }

  useEffect(() => {
    if (!tagadd) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [tagadd]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
              >
                #{tag.tag}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setTagadd({
              bookId,
              title,
              tags: currentTags,
            });
            setUpdatetag(
              currentTags.map((tag) => ({
                bookId,
                tagId: tag.id,
                isRemove: false,
                new: false,
              }))
            );
          }}
          className="inline-flex w-fit rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          タグ変更
        </button>
      </div>

      {tagadd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-edit-title"
        >
          <div className="flex h-[560px] max-h-[calc(100vh-2rem)] w-[720px] max-w-[92vw] min-w-0 flex-col overflow-hidden rounded-lg bg-white shadow-lg sm:min-w-[360px]">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2
                id="tag-edit-title"
                className="min-w-0 truncate text-base font-semibold text-zinc-900"
              >
                タグ変更: {tagadd.title}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setTagadd(null);
                  setUpdatetag([]);
                }}
                className="ml-3 shrink-0 text-xl leading-none text-zinc-500 hover:text-zinc-800"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {tagadd.tags.length === 0 && (
                    <p className="text-sm text-zinc-700">
                      タグはまだありません。
                    </p>
                  )}
                  {tagadd.tags.map((tag) => {
                    const removed = updatetag.some(
                      (item) => item.tagId === tag.id && item.isRemove
                    );
                    return (
                      <span
                        key={tag.id}
                        className={`inline-flex rounded border px-1 py-0.5 text-[10px] leading-none ${
                          removed
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-zinc-300 bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        #{tag.tag}
                        <button
                          type="button"
                          onClick={() => toggleTagInDraft(tagadd.bookId, tag.id)}
                          className={
                            removed
                              ? "text-red-600 hover:text-red-700"
                              : "text-zinc-500 hover:text-zinc-700"
                          }
                          aria-label={`${tag.tag}を削除`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>

                {allTags.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
                      候補タグ
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((item) => {
                        const isSelected = updatetag.some(
                          (draft) =>
                            draft.tagId === item.id &&
                            !draft.isRemove &&
                            draft.new
                        );
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              toggleTagInDraft(tagadd.bookId, item.id)
                            }
                            style={
                              isSelected
                                ? {
                                    borderColor: "#15803d",
                                    backgroundColor: "#15803d",
                                    color: "#ffffff",
                                  }
                                : undefined
                            }
                            className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
                          >
                            #{item.tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={isSavingTags}
                    onClick={async () => {
                      if (isSavingTags) return;
                      setIsSavingTags(true);
                      try {
                        await saveBookTags(tagadd.bookId, updatetag);
                      } finally {
                        setIsSavingTags(false);
                      }
                    }}
                    className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingTags ? <LoadingSpinner /> : "変更を保存"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
