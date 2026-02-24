"use client";

import { useRef, useState } from "react";
import { useNotificationManager } from "@/hooks/use-notification-manager";

export default function NotificationsPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [checkedOverride, setCheckedOverride] = useState<boolean | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const {
    isSupported,
    subscription,
    error,
    registerPushNotification,
    unsubscribeFromPush,
  } = useNotificationManager();
  const isChecked = checkedOverride ?? Boolean(subscription);

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
    </section>
  );
}
