"use client";

import AvatarEditor, { type AvatarEditorRef } from "react-avatar-editor";
import { Bell, Camera, UserRound } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
import { useNotificationManager } from "@/hooks/use-notification-manager";
import { updateUserProfile } from "@/lib/action/user-profile";

export default function NotificationsPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [checkedOverride, setCheckedOverride] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isAvatarApplying, setIsAvatarApplying] = useState(false);
  const [isNicknameUpdating, setIsNicknameUpdating] = useState(false);
  const [scale, setScale] = useState(1.2);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<AvatarEditorRef | null>(null);
  const {
    isSupported,
    subscription,
    error,
    registerPushNotification,
    unsubscribeFromPush,
  } = useNotificationManager();
  const isChecked = checkedOverride ?? Boolean(subscription);
  useEffect(() => {
    const fetchUserProfile = async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setNickname(data.nickname ?? "");
      setAvatarUrl(data.avatarUrl ?? "");
    };
    fetchUserProfile();
  }, []);

  const handleAvatarApply = async () => {
    if (!editorRef.current || isAvatarApplying) {
      return;
    }

    setIsAvatarApplying(true);

    try {
      const canvas = editorRef.current.getImage();
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob) {
        window.alert("画像の変換に失敗しました");
        return;
      }

      const formData = new FormData();
      formData.append("file", blob, "avatar.png");

      const res = await fetch("/api/user/avatars", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        window.alert("画像のアップロードに失敗しました");
        return;
      }

      const data = await res.json();
      const profileResult = await updateUserProfile({
        nickname,
        avatarUrl: data.url,
      });
      if (profileResult.status !== 200) {
        window.alert("プロフィールの更新に失敗しました");
        return;
      }

      setAvatarUrl(data.url ?? "");
      setIsAvatarModalOpen(false);
      window.alert("プロフィール画像を変更しました");
    } catch {
      window.alert("プロフィール画像の更新に失敗しました");
    } finally {
      setIsAvatarApplying(false);
    }
  };

  const handleNicknameUpdate = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (isNicknameUpdating) return;

    setIsNicknameUpdating(true);
    try {
      const result = await updateUserProfile({
        nickname,
      });

      if (result.status !== 200) {
        window.alert("ニックネームの更新に失敗しました");
        return;
      }

      window.alert("ニックネームを変更しました");
    } catch {
      window.alert("ニックネームの更新に失敗しました");
    } finally {
      setIsNicknameUpdating(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setIsRegistering(true);
    setCheckedOverride(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        if (next) {
          await registerPushNotification();
        } else {
          await unsubscribeFromPush();
        }
      } finally {
        setCheckedOverride(null);
        setIsRegistering(false);
      }
    }, 500);
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">アカウント</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
          設定
        </h1>
      </div>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-5 sm:px-8">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-zinc-950">ユーザープロフィール</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              表示される画像とニックネームを変更できます
            </p>
          </div>
        </div>

        <div className="grid gap-7 px-6 py-7 sm:grid-cols-[128px_1fr] sm:px-8">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-violet-100 p-1.5 shadow-sm">
              <Image
                src={avatarUrl || "/default-avatar.svg"}
                alt="現在のプロフィール画像"
                width={112}
                height={112}
                sizes="112px"
                priority
                className="h-28 w-28 rounded-full bg-white object-cover ring-4 ring-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              画像を変更
            </button>
          </div>

          <form
            onSubmit={handleNicknameUpdate}
            className="flex min-w-0 flex-col justify-center"
          >
            <label
              htmlFor="nickname"
              className="text-sm font-semibold text-zinc-800"
            >
              ニックネーム
            </label>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              本の貸出やコミュニティで表示される名前です。
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="ニックネームを入力"
                className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              <button
                type="submit"
                disabled={isNicknameUpdating}
                className="inline-flex h-11 min-w-24 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isNicknameUpdating ? (
                  <>
                    <Spinner aria-hidden="true" />
                    更新中...
                  </>
                ) : (
                  "更新する"
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-5 sm:px-8">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-zinc-950">通知設定</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              返却期限のお知らせを管理します
            </p>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          {!isSupported && (
            <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              このブラウザではプッシュ通知を使用できません。
            </p>
          )}
          {isSupported && (
            <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl bg-zinc-50 px-4 py-4 transition hover:bg-zinc-100/80">
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  返却期限前の通知
                </span>
                <span className="mt-1 block text-sm text-zinc-500">
                  期限が近づいた本をプッシュ通知でお知らせします
                </span>
              </span>
              <span className="shrink-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    handleToggle(e.target.checked);
                  }}
                  className="peer sr-only"
                />
                <span className="relative block h-7 w-12 rounded-full bg-zinc-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/20 after:absolute after:left-[3px] after:top-[3px] after:h-[22px] after:w-[22px] after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
              </span>
            </label>
          )}

          {isSupported && !isRegistering && (
            <p className="mt-3 text-right text-xs font-medium text-zinc-500">
              現在：{isChecked ? "通知は有効です" : "通知は無効です"}
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </section>

      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">
                プロフィール画像を変更
              </h2>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="text-sm text-zinc-500"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="avatar-file"
                  className="inline-flex cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  画像を選ぶ
                </label>
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const objectUrl = URL.createObjectURL(file);
                    setSelectedImage(objectUrl);
                  }}
                />
              </div>

              <div className="flex justify-center rounded-2xl bg-zinc-100 p-4">
                {selectedImage ? (
                  <AvatarEditor
                    ref={editorRef}
                    image={selectedImage}
                    width={240}
                    height={240}
                    border={20}
                    borderRadius={999}
                    color={[255, 255, 255, 0.6]}
                    scale={scale}
                    rotate={0}
                  />
                ) : (
                  <Image
                    src={avatarUrl || "/default-avatar.svg"}
                    alt="Avatar preview"
                    width={240}
                    height={240}
                    sizes="240px"
                    className="h-60 w-60 rounded-full object-cover"
                  />
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-700">拡大</label>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAvatarApply}
                  disabled={!selectedImage || isAvatarApplying}
                  aria-busy={isAvatarApplying}
                  className="inline-flex min-w-16 items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {isAvatarApplying ? (
                    <>
                      <Spinner aria-hidden="true" />
                      適用中...
                    </>
                  ) : (
                    "適用"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
