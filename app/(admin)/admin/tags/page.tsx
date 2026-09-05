"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  createTags,
  deleteTag as deleteTagAction,
} from "@/lib/action/admin/tag-list";
import {
  createTagSubterms,
  deleteTagSubterm,
} from "@/lib/action/admin/tag-subterms";
import {
  classifyAllBooks,
  classifyBooksForTag,
} from "@/lib/action/admin/tag-classification";
import { useCallback, useEffect, useState } from "react";

type TagItem = {
  id: string;
  tag: string;
};

type TagSubterm = {
  id: string;
  tagId: string;
  subterm: string;
};

export default function AdminTagsPage() {
  const [tagInputs, setTagInputs] = useState([""]);
  const [taglist, setTaglist] = useState<TagItem[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isAddingTags, setIsAddingTags] = useState(false);
  const [reclassifyingTarget, setReclassifyingTarget] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [tagStatusMessage, setTagStatusMessage] = useState("");
  const [selectedTag, setSelectedTag] = useState<TagItem | null>(null);
  const [tagSubterms, setTagSubterms] = useState<TagSubterm[]>([]);
  const [isLoadingSubterms, setIsLoadingSubterms] = useState(false);
  const [subtermInputs, setSubtermInputs] = useState([""]);
  const [isSavingSubterms, setIsSavingSubterms] = useState(false);
  const [deletingSubtermId, setDeletingSubtermId] = useState<string | null>(null);

  const showAlertMessage = useCallback((message: string) => {
    setTagStatusMessage("");
    window.alert(message);
  }, []);

  async function fetchTagList(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) setTagStatusMessage("ジャンル一覧を取得中...");
    try {
      const res = await fetch("/api/admin/tags", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTaglist(Array.isArray(data) ? data : []);
      if (!silent) setTagStatusMessage("");
    } catch {
      if (!silent) showAlertMessage("ジャンル一覧の取得に失敗しました");
    } finally {
      setIsLoadingTags(false);
    }
  }

  async function addTag() {
    if (isAddingTags) return;

    const tags = tagInputs.filter((value) => value.trim() !== "");
    if (tags.length === 0) {
      showAlertMessage("ジャンル名を入力してください");
      return;
    }

    setIsAddingTags(true);
    setTagStatusMessage("ジャンルを保存中...");
    try {
      const result = await createTags(tags);
      if (!result.ok) {
        showAlertMessage(result.error);
        return;
      }

      setTagInputs([""]);
      await fetchTagList({ silent: true });
      showAlertMessage("ジャンルを保存しました");
    } catch {
      showAlertMessage("ジャンルの保存に失敗しました");
    } finally {
      setIsAddingTags(false);
    }
  }
  async function handleReclassifyTags(tagId: string) {
    if (reclassifyingTarget) return;

    setReclassifyingTarget(tagId);
    try {
      const result = await classifyBooksForTag(tagId);
      if (!result.ok) {
        showAlertMessage(result.error);
        return;
      }

      showAlertMessage(result.message);
    } catch {
      showAlertMessage("ジャンルの付け直しに失敗しました");
    } finally {
      setReclassifyingTarget(null);
    }
  }

  async function handleReclassifyAllTags() {
    if (reclassifyingTarget) return;

    setReclassifyingTarget("all");
    try {
      const result = await classifyAllBooks();
      if (!result.ok) {
        showAlertMessage(result.error);
        return;
      }

      showAlertMessage(result.message);
    } catch {
      showAlertMessage("全ジャンルの付け直しに失敗しました");
    } finally {
      setReclassifyingTarget(null);
    }
  }

  async function deleteTag(tag: TagItem) {
    if (deletingTagId) return;
    if (!window.confirm(`${tag.tag}を削除しますか？`)) return;

    setDeletingTagId(tag.id);
    setTagStatusMessage("ジャンルを削除中...");
    try {
      const result = await deleteTagAction(tag.id);
      if (!result.ok) {
        showAlertMessage(result.error);
        return;
      }

      if (selectedTag?.id === tag.id) {
        setSelectedTag(null);
        setTagSubterms([]);
      }
      await fetchTagList({ silent: true });
      showAlertMessage("ジャンルを削除しました");
    } catch {
      showAlertMessage("ジャンルの削除に失敗しました");
    } finally {
      setDeletingTagId(null);
    }
  }

  const fetchSubterms = useCallback(async (tagId: string) => {
    setIsLoadingSubterms(true);
    try {
      const res = await fetch(`/api/admin/tags/${tagId}/subterms`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTagSubterms(Array.isArray(data) ? data : []);
    } catch {
      showAlertMessage("子要素の取得に失敗しました");
    } finally {
      setIsLoadingSubterms(false);
    }
  }, [showAlertMessage]);

  async function addSubterms() {
    if (!selectedTag) return;

    const subterms = subtermInputs.filter((value) => value.trim() !== "");

    if (subterms.length === 0) {
      showAlertMessage("子要素を入力してください");
      return;
    }

    setIsSavingSubterms(true);
    setTagStatusMessage("子要素を保存中...");
    try {
      const result = await createTagSubterms(selectedTag.id, subterms);
      if (!result.ok) {
        showAlertMessage(result.error);
        return;
      }

      setSubtermInputs([""]);
      await fetchSubterms(selectedTag.id);
      showAlertMessage("子要素を保存しました");
    } catch {
      showAlertMessage("子要素の保存に失敗しました");
    } finally {
      setIsSavingSubterms(false);
    }
  }

  async function deleteSubterm(subterm: TagSubterm) {
    if (!selectedTag) return;
    if (deletingSubtermId) return;
    if (!window.confirm(`${subterm.subterm}を削除しますか？`)) return;

    setDeletingSubtermId(subterm.id);
    setTagStatusMessage("子要素を削除中...");
    try {
      const result = await deleteTagSubterm(selectedTag.id, subterm.id);
      if (!result.ok) {
        showAlertMessage(result.error);
        return;
      }

      await fetchSubterms(selectedTag.id);
      showAlertMessage("子要素を削除しました");
    } catch {
      showAlertMessage("子要素の削除に失敗しました");
    } finally {
      setDeletingSubtermId(null);
    }
  }

  useEffect(() => {
    const fetchInitialTags = async () => {
      setTagStatusMessage("ジャンル一覧を取得中...");
      try {
        const res = await fetch("/api/admin/tags", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTaglist(Array.isArray(data) ? data : []);
        setTagStatusMessage("");
      } catch {
        showAlertMessage("ジャンル一覧の取得に失敗しました");
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchInitialTags();
  }, [showAlertMessage]);

  useEffect(() => {
    if (!selectedTag) {
      setTagSubterms([]);
      return;
    }

    fetchSubterms(selectedTag.id);
  }, [selectedTag, fetchSubterms]);

  return (
    <main className="min-h-screen bg-[#f0f4f8] p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ジャンル管理</h1>

      <div
        className={`mt-8 grid gap-4 lg:items-start ${
          selectedTag
            ? "max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]"
            : "max-w-xl"
        }`}
      >
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleReclassifyAllTags}
            disabled={reclassifyingTarget !== null}
            className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            {reclassifyingTarget === "all" ? (
              <>
                <Spinner aria-hidden="true" />
                処理中...
              </>
            ) : (
              "全部ジャンル付け直し"
            )}
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTag();
          }}
          className="mt-3 space-y-2"
        >
          {tagInputs.map((value, index) => (
            <textarea
              key={index}
              value={value}
              onChange={(e) =>
                setTagInputs((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? e.target.value : item
                  )
                )
              }
              placeholder="追加するジャンル名"
              disabled={isLoadingTags || isAddingTags}
              className="min-h-12 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
            />
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTagInputs((current) => [...current, ""])}
              disabled={isLoadingTags || isAddingTags}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
            >
              入力欄を追加
            </button>
            <button
              type="submit"
              disabled={isLoadingTags || isAddingTags}
              className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isAddingTags ? (
                <>
                  <Spinner aria-hidden="true" />
                  追加中...
                </>
              ) : (
                "まとめて追加"
              )}
            </button>
          </div>
        </form>



        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
          {isLoadingTags ? (
            <p className="text-sm text-zinc-600">ジャンルを読み込み中...</p>
          ) : taglist.length === 0 ? (
            <p className="text-sm text-zinc-600">ジャンルはまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600">
                  <tr>
                    <th scope="col" className="border-b border-zinc-200 px-4 py-3">
                      ジャンル名
                    </th>
                    <th scope="col" className="w-48 border-b border-zinc-200 px-4 py-3">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {taglist.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100 last:border-b-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {item.tag}
                      </td>

                      <td className="px-4 py-3 text-zinc-900">
                        <button
                          type="button"
                          onClick={() => setSelectedTag(item)}
                          className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
                        >
                          詳細
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTag(item)}
                          disabled={deletingTagId !== null}
                          className="ml-2 rounded-md border border-red-200 bg-white px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-600">{tagStatusMessage}</p>
      </section>

      {selectedTag && (
        <section className="rounded-md border border-zinc-200 bg-white p-3 text-left">
          <h3 className="text-sm font-semibold text-zinc-900">
            ジャンル詳細: {selectedTag.tag}
          </h3>
          <button
            type="button"
            onClick={() => handleReclassifyTags(selectedTag.id)}
            disabled={reclassifyingTarget !== null}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            {reclassifyingTarget === selectedTag.id ? (
              <>
                <Spinner aria-hidden="true" />
                処理中...
              </>
            ) : (
              "ジャンル付け直す"
            )}
          </button>
          <h4 className="mt-3 text-sm font-medium text-zinc-700">子要素</h4>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSubterms();
            }}
            className="mt-3 space-y-2"
          >
            {subtermInputs.map((value, index) => (
              <textarea
                key={index}
                value={value}
                onChange={(e) =>
                  setSubtermInputs((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? e.target.value : item
                    )
                  )
                }
                placeholder="SQL"
                disabled={isSavingSubterms}
                className="min-h-12 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
              />
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSubtermInputs((current) => [...current, ""])}
                disabled={isSavingSubterms}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
              >
                入力欄を追加
              </button>
              <button
                type="submit"
                disabled={isSavingSubterms}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isSavingSubterms ? (
                  <>
                    <Spinner aria-hidden="true" />
                    追加中...
                  </>
                ) : (
                  "まとめて追加"
                )}
              </button>
            </div>
          </form>

          {isLoadingSubterms ? (
            <p className="mt-2 text-sm text-zinc-600">子要素を読み込み中...</p>
          ) : tagSubterms.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">子要素はまだありません。</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {tagSubterms.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm text-zinc-800"
                >
                  <span>{item.subterm}</span>
                  <button
                    type="button"
                    onClick={() => deleteSubterm(item)}
                    disabled={deletingSubtermId !== null}
                    className="inline-flex min-w-16 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingSubtermId === item.id ? (
                      <>
                        <Spinner className="size-3.5" aria-hidden="true" />
                        削除中...
                      </>
                    ) : (
                      "削除"
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

        </section>
      )}
      </div>
    </main>
  );
}
