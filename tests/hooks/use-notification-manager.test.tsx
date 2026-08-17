// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationManager } from "@/hooks/use-notification-manager";

const actions = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/action/push-notification", () => ({
  subscribePushNotification: actions.subscribe,
  unsubscribePushNotification: actions.unsubscribe,
}));

type TestSubscription = PushSubscription & {
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: ReturnType<typeof vi.fn>;
};

function createSubscription(endpoint = "https://push.example.test/sub"): TestSubscription {
  return {
    endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: vi.fn(() => ({
      endpoint,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    })),
  } as unknown as TestSubscription;
}

describe("useNotificationManager", () => {
  const register = vi.fn();
  const getSubscription = vi.fn();
  const browserSubscribe = vi.fn();
  const requestPermission = vi.fn();

  function installSupportedBrowser(existing: PushSubscription | null = null) {
    getSubscription.mockResolvedValue(existing);
    const registration = {
      pushManager: {
        getSubscription,
        subscribe: browserSubscribe,
      },
    } as unknown as ServiceWorkerRegistration;
    register.mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        ready: Promise.resolve(registration),
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class PushManager {},
    });
    vi.stubGlobal("Notification", { requestPermission });
    return registration;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AQID");
    requestPermission.mockResolvedValue("granted");
    actions.subscribe.mockResolvedValue({ ok: true });
    actions.unsubscribe.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "serviceWorker");
    Reflect.deleteProperty(window, "PushManager");
  });

  it("未対応browserでは登録せずisSupported=falseを保つ", () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    Reflect.deleteProperty(window, "PushManager");

    const { result } = renderHook(() => useNotificationManager());

    expect(result.current.isSupported).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it("Service Workerを指定設定で登録し、既存subscriptionを復元する", async () => {
    const subscription = createSubscription();
    installSupportedBrowser(subscription);

    const { result } = renderHook(() => useNotificationManager());

    await waitFor(() => expect(result.current.isSupported).toBe(true));
    await waitFor(() => expect(result.current.subscription).toBe(subscription));
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("Service Worker登録失敗をerrorへ反映する", async () => {
    installSupportedBrowser();
    register.mockRejectedValueOnce(new Error("registration failed"));

    const { result } = renderHook(() => useNotificationManager());

    await waitFor(() =>
      expect(result.current.error).toBe("registration failed")
    );
  });

  it("通知権限が拒否された場合は購読を作らない", async () => {
    installSupportedBrowser();
    requestPermission.mockResolvedValueOnce("denied");
    const { result } = renderHook(() => useNotificationManager());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await act(async () => {
      await result.current.registerPushNotification();
    });

    expect(result.current.error).toBe("通知の許可が得られませんでした");
    expect(browserSubscribe).not.toHaveBeenCalled();
    expect(actions.subscribe).not.toHaveBeenCalled();
  });

  it("VAPID公開鍵がなければエラーとなり購読を作らない", async () => {
    installSupportedBrowser();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    const { result } = renderHook(() => useNotificationManager());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await act(async () => {
      await result.current.registerPushNotification();
    });

    expect(result.current.error).toBe("VAPID公開鍵が設定されていません");
    expect(browserSubscribe).not.toHaveBeenCalled();
    expect(actions.subscribe).not.toHaveBeenCalled();
  });

  it("VAPID鍵をUint8Arrayへ変換し、browserとserverを購読する", async () => {
    const subscription = createSubscription();
    installSupportedBrowser();
    browserSubscribe.mockResolvedValueOnce(subscription);
    const { result } = renderHook(() => useNotificationManager());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await act(async () => {
      await result.current.registerPushNotification();
    });

    expect(browserSubscribe).toHaveBeenCalledTimes(1);
    const subscribeInput = browserSubscribe.mock.calls[0][0];
    expect(subscribeInput.userVisibleOnly).toBe(true);
    expect(Array.from(subscribeInput.applicationServerKey)).toEqual([1, 2, 3]);
    expect(actions.subscribe).toHaveBeenCalledWith({
      endpoint: subscription.endpoint,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
    expect(result.current.subscription).toBe(subscription);
  });

  it("server購読失敗時はbrowser購読をrollbackする", async () => {
    const subscription = createSubscription();
    installSupportedBrowser();
    browserSubscribe.mockResolvedValueOnce(subscription);
    actions.subscribe.mockResolvedValueOnce({ ok: false, error: "server failed" });
    const { result } = renderHook(() => useNotificationManager());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await act(async () => {
      await result.current.registerPushNotification();
    });

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.subscription).toBeNull();
    expect(result.current.error).toBe("server failed");
  });

  it("購読解除はserver保存を先に削除してからbrowserを解除する", async () => {
    const subscription = createSubscription();
    installSupportedBrowser(subscription);
    const { result } = renderHook(() => useNotificationManager());
    await waitFor(() => expect(result.current.subscription).toBe(subscription));

    await act(async () => {
      await result.current.unsubscribeFromPush();
    });

    expect(actions.unsubscribe).toHaveBeenCalledWith(subscription.endpoint);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.subscription).toBeNull();
  });

  it("server側の解除失敗時はbrowser subscriptionを保持する", async () => {
    const subscription = createSubscription();
    installSupportedBrowser(subscription);
    actions.unsubscribe.mockResolvedValueOnce({ ok: false, error: "delete failed" });
    const { result } = renderHook(() => useNotificationManager());
    await waitFor(() => expect(result.current.subscription).toBe(subscription));

    await act(async () => {
      await result.current.unsubscribeFromPush();
    });

    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(result.current.subscription).toBe(subscription);
    expect(result.current.error).toBe("delete failed");
  });
});
