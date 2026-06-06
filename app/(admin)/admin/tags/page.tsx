"use client";

import LoadingSpinner from "@/app/_components/LoadingSpinner";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [isReclassifyingTags, setIsReclassifyingTags] = useState(false);
  const [tagStatusMessage, setTagStatusMessage] = useState("");
  const [selectedTag, setSelectedTag] = useState<TagItem | null>(null);
  const [tagSubterms, setTagSubterms] = useState<TagSubterm[]>([]);
  const [isLoadingSubterms, setIsLoadingSubterms] = useState(false);
  const [subtermInputs, setSubtermInputs] = useState([""]);
  const [isSavingSubterms, setIsSavingSubterms] = useState(false);

  function showAlertMessage(message: string) {
    setTagStatusMessage("");
    alert(message);
  }

  async function fetchTagList(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) setTagStatusMessage("タグ一覧を取得中...");
    try {
      const res = await fetch("/api/admin/tags", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTaglist(Array.isArray(data) ? data : []);
      if (!silent) setTagStatusMessage("");
    } catch {
      if (!silent) showAlertMessage("タグ一覧の取得に失敗しました");
    } finally {
      setIsLoadingTags(false);
    }
  }

  async function addTag() {
    if (isAddingTags) return;

    const tags = tagInputs.filter((value) => value.trim() !== "");
    if (tags.length === 0) {
      showAlertMessage("タグ名を入力してください");
      return;
    }

    setIsAddingTags(true);
    setTagStatusMessage("タグを保存中...");
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          showAlertMessage(
            typeof err?.error === "string" ? err.error : "タグの保存に失敗しました"
          );
        } catch {
          showAlertMessage("タグの保存に失敗しました");
        }
        return;
      }

      setTagInputs([""]);
      await fetchTagList({ silent: true });
      showAlertMessage("タグを保存しました");
    } catch {
      showAlertMessage("タグの保存に失敗しました");
    } finally {
      setIsAddingTags(false);
    }
  }
  async function handleReclassifyTags(tagId: string) {
    if (isReclassifyingTags) return;

    setIsReclassifyingTags(true);
    try {
      const res = await fetch(`/api/admin/tags/${tagId}/classify-books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          showAlertMessage(
            typeof err?.error === "string" ? err.error : "タグの付け直しに失敗しました"
          );
        } catch {
          showAlertMessage("タグの付け直しに失敗しました");
        }
        return;
      }

      showAlertMessage("タグを付け直しました");
    } catch {
      showAlertMessage("タグの付け直しに失敗しました");
    } finally {
      setIsReclassifyingTags(false);
    }
  }

  async function handleReclassifyAllTags() {
    if (isReclassifyingTags) return;

    setIsReclassifyingTags(true);
    try {
      const res = await fetch("/api/admin/tags/classify-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          showAlertMessage(
            typeof err?.error === "string" ? err.error : "全タグの付け直しに失敗しました"
          );
        } catch {
          showAlertMessage("全タグの付け直しに失敗しました");
        }
        return;
      }

      showAlertMessage("全タグを付け直しました");
    } catch {
      showAlertMessage("全タグの付け直しに失敗しました");
    } finally {
      setIsReclassifyingTags(false);
    }
  }

  async function deleteTag(tag: TagItem) {
    if (!window.confirm(`${tag.tag}を削除しますか？`)) return;

    setTagStatusMessage("タグを削除中...");
    try {
      const res = await fetch(`/api/admin/tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          showAlertMessage(
            typeof err?.error === "string" ? err.error : "タグの削除に失敗しました"
          );
        } catch {
          showAlertMessage("タグの削除に失敗しました");
        }
        return;
      }

      if (selectedTag?.id === tag.id) {
        setSelectedTag(null);
        setTagSubterms([]);
      }
      await fetchTagList({ silent: true });
      showAlertMessage("タグを削除しました");
    } catch {
      showAlertMessage("タグの削除に失敗しました");
    }
  }

  async function fetchSubterms(tagId: string) {
    setIsLoadingSubterms(true);
    try {
      const res = await fetch(`/api/admin/tags/${tagId}/subterms`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTagSubterms(Array.isArray(data) ? data : []);
    } catch {
      showAlertMessage("小要素の取得に失敗しました");
    } finally {
      setIsLoadingSubterms(false);
    }
  }

  async function addSubterms() {
    if (!selectedTag) return;

    const subterms = subtermInputs.filter((value) => value.trim() !== "");

    if (subterms.length === 0) {
      showAlertMessage("小要素を入力してください");
      return;
    }

    setIsSavingSubterms(true);
    setTagStatusMessage("小要素を保存中...");
    try {
      const res = await fetch(`/api/admin/tags/${selectedTag.id}/subterms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subterms }),
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          showAlertMessage(
            typeof err?.error === "string" ? err.error : "小要素の保存に失敗しました"
          );
        } catch {
          showAlertMessage("小要素の保存に失敗しました");
        }
        return;
      }

      setSubtermInputs([""]);
      await fetchSubterms(selectedTag.id);
      showAlertMessage("小要素を保存しました");
    } catch {
      showAlertMessage("小要素の保存に失敗しました");
    } finally {
      setIsSavingSubterms(false);
    }
  }

  async function deleteSubterm(subterm: TagSubterm) {
    if (!selectedTag) return;
    if (!window.confirm(`${subterm.subterm}を削除しますか？`)) return;

    setTagStatusMessage("小要素を削除中...");
    try {
      const res = await fetch(
        `/api/admin/tags/${selectedTag.id}/subterms/${subterm.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        try {
          const err = await res.json();
          showAlertMessage(
            typeof err?.error === "string" ? err.error : "小要素の削除に失敗しました"
          );
        } catch {
          showAlertMessage("小要素の削除に失敗しました");
        }
        return;
      }

      await fetchSubterms(selectedTag.id);
      showAlertMessage("小要素を削除しました");
    } catch {
      showAlertMessage("小要素の削除に失敗しました");
    }
  }

  useEffect(() => {
    const fetchInitialTags = async () => {
      setTagStatusMessage("タグ一覧を取得中...");
      try {
        const res = await fetch("/api/admin/tags", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTaglist(Array.isArray(data) ? data : []);
        setTagStatusMessage("");
      } catch {
        showAlertMessage("タグ一覧の取得に失敗しました");
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchInitialTags();
  }, []);

  useEffect(() => {
    if (!selectedTag) {
      setTagSubterms([]);
      return;
    }

    fetchSubterms(selectedTag.id);
  }, [selectedTag]);

  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">タグ管理</h1>
      <Link
        href="/admin"
        className="mt-4 inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
      >
        管理者ページに戻る
      </Link>

      <div
        className={`mt-8 grid gap-4 lg:items-start ${
          selectedTag
            ? "max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]"
            : "max-w-xl"
        }`}
      >
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">タグ管理</h2>
          <button
            type="button"
            onClick={handleReclassifyAllTags}
            disabled={isReclassifyingTags}
            className="inline-flex min-w-[132px] items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            {isReclassifyingTags ? <LoadingSpinner /> : "全部タグ付け直し"}
          </button>
          <button
            type="button"
            onClick={() => {
              fetchTagList();
            }}
            disabled={isLoadingTags}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            再取得
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
              placeholder="追加するタグ名"
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
              className="inline-flex min-w-[104px] items-center justify-center rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isAddingTags ? <LoadingSpinner /> : "まとめて追加"}
            </button>
          </div>
        </form>



        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
          {isLoadingTags ? (
            <p className="text-sm text-zinc-600">タグを読み込み中...</p>
          ) : taglist.length === 0 ? (
            <p className="text-sm text-zinc-600">タグはまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600">
                  <tr>
                    <th scope="col" className="border-b border-zinc-200 px-4 py-3">
                      タグ名
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
                          className="ml-2 rounded-md border border-red-200 bg-white px-3 py-1 text-sm text-red-600 hover:bg-red-50"
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
            タグ詳細: {selectedTag.tag}
          </h3>
          <button
            type="button"
            onClick={() => handleReclassifyTags(selectedTag.id)}
            disabled={isReclassifyingTags}
            className="inline-flex min-w-[108px] items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            {isReclassifyingTags ? <LoadingSpinner /> : "タグ付け直す"}
          </button>
          <h4 className="mt-3 text-sm font-medium text-zinc-700">小要素</h4>

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
                className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isSavingSubterms ? <LoadingSpinner /> : "まとめて追加"}
              </button>
            </div>
          </form>

          {isLoadingSubterms ? (
            <p className="mt-2 text-sm text-zinc-600">小要素を読み込み中...</p>
          ) : tagSubterms.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">小要素はまだありません。</p>
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
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    削除
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
