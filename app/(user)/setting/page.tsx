"use client";

import AvatarEditor, { type AvatarEditorRef } from "react-avatar-editor";
import { useRef, useState, useEffect } from "react";
import { useNotificationManager } from "@/hooks/use-notification-manager";

export default function NotificationsPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [checkedOverride, setCheckedOverride] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
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
    if (!editorRef.current) {
      return;
    }

    const canvas = editorRef.current.getImage();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      alert("画像の変換に失敗しました");
      return;
    }

    const formData = new FormData();
    formData.append("file", blob, "avatar.png");

    const res = await fetch("/api/user/avatars", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      alert("画像のアップロードに失敗しました");
      return;
    }

    const data = await res.json();
    const profileRes = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nickname,
        avatarUrl: data.url
      })
    });
    if (!profileRes.ok) {
      alert("プロフィールの更新に失敗しました");
      return;
    }
    setAvatarUrl(data.url ?? "");
    setIsAvatarModalOpen(false);
  };

  const handleNicknameUpdate = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname,
      }),
    });

    if (!res.ok) {
      alert("ニックネームの更新に失敗しました");
      return;
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
    <section className="mx-auto max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">ユーザープロフィール</h1>
      <div className="flex items-center space-x-4">
        <img
          src={avatarUrl || "/default-avatar.svg"}
          alt="Avatar"
          className="h-16 w-16 rounded-full object-cover"
        />

        <div>
          <form onSubmit={(event) => void handleNicknameUpdate(event)}>
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="mb-3 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
            >
              画像を変更
            </button>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="ニックネームを入力"
              className="rounded border border-zinc-300 px-3 py-2 focus:border-zinc-400"
            />
            <button
              type="submit"
              className="ml-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              更新
            </button>
          </form>
        </div>
      </div>
      <h1 className="text-xl font-semibold text-zinc-900">通知設定</h1>

      {!isSupported && (
        <p className="text-sm text-zinc-600">
          このブラウザではプッシュ通知を使用できません。
        </p>
      )}
      {isSupported && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">
            返却期限前の通知を受け取るには許可が必要です。
          </p>
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => void handleToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
            <span className="ml-3 text-sm text-zinc-700">
              {!isRegistering && isChecked && "通知は有効です"}
              {!isRegistering && !isChecked && "通知は無効です"}
            </span>
          </label>
        </div>
      )}

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

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
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const objectUrl = URL.createObjectURL(file);
                  setSelectedImage(objectUrl);
                }}
              />

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
                  <img
                    src={avatarUrl || "/default-avatar.svg"}
                    alt="Avatar preview"
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
                  disabled={!selectedImage}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                >
                  適用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
