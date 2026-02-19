import { useEffect, useState } from "react";

type StoredSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      void registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const registerPushNotification = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("通知の許可が得られませんでした");
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        throw new Error("VAPID公開鍵が設定されていません");
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const { endpoint, keys } = sub.toJSON() as
        | StoredSubscription
        | PushSubscriptionJSON;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error("subscriptionの形式が不正です");
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint,
            keys: { p256dh: keys.p256dh, auth: keys.auth },
          },
        }),
      });
      if (!response.ok) {
        await sub.unsubscribe().catch(() => undefined);
        throw new Error("通知登録の保存に失敗しました");
      }
      setSubscription(sub);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) {
        throw new Error("通知解除の保存に失敗しました");
      }

      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return {
    isSupported,
    subscription,
    error,
    registerPushNotification,
    unsubscribeFromPush,
  };
}
