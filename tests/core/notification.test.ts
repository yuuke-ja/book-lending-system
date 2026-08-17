import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { db } from "@/lib/db";
import { notifications } from "@/lib/notification";

vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

const mockedQuery = vi.mocked(db.query);
const mockedSetVapidDetails = vi.mocked(webpush.setVapidDetails);
const mockedSendNotification = vi.mocked(webpush.sendNotification);

function subscription(id: string, userEmail = "user@example.com") {
  return {
    id,
    userEmail,
    endpoint: `https://push.example.com/${id}`,
    p256dh: `p256dh-${id}`,
    auth: `auth-${id}`,
  };
}

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    vi.stubEnv("VAPID_SUBJECT", "mailto:library@example.com");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    ["公開鍵", "", "private-key"],
    ["秘密鍵", "public-key", ""],
  ])("%sがなければ送信処理を開始しない", async (_name, publicKey, privateKey) => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", privateKey);

    await expect(notifications()).rejects.toThrow("VAPID keys are not set");
    expect(mockedSetVapidDetails).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedSendNotification).not.toHaveBeenCalled();
  });

  it("JST当日の範囲で期限を検索し、対象0件なら早期終了する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T00:00:00.000+09:00"));
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

    await expect(notifications()).resolves.toEqual({
      targetedUsers: 0,
      subscriptions: 0,
      sent: 0,
      failed: 0,
      removed: 0,
    });

    expect(mockedSetVapidDetails).toHaveBeenCalledWith(
      "mailto:library@example.com",
      "public-key",
      "private-key"
    );
    expect(mockedQuery).toHaveBeenCalledOnce();
    const params = mockedQuery.mock.calls[0]?.[1] as Date[];
    expect(params.map((date) => date.toISOString())).toEqual([
      "2026-08-14T15:00:00.000Z",
      "2026-08-15T14:59:59.999Z",
    ]);
    expect(mockedSendNotification).not.toHaveBeenCalled();
  });

  it("ユーザーごとの期限冊数を全購読へ通知する", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ userEmail: "user@example.com", dueCount: 2 }],
      } as never)
      .mockResolvedValueOnce({
        rows: [subscription("sub-1"), subscription("sub-2")],
      } as never);
    mockedSendNotification.mockResolvedValue({} as never);

    await expect(notifications()).resolves.toEqual({
      targetedUsers: 1,
      subscriptions: 2,
      sent: 2,
      failed: 0,
      removed: 0,
    });

    expect(mockedQuery.mock.calls[1]?.[1]).toEqual([["user@example.com"]]);
    expect(mockedSendNotification).toHaveBeenCalledTimes(2);
    expect(mockedSendNotification).toHaveBeenNthCalledWith(
      1,
      {
        endpoint: "https://push.example.com/sub-1",
        keys: { p256dh: "p256dh-sub-1", auth: "auth-sub-1" },
      },
      JSON.stringify({
        title: "返却期限のお知らせ",
        body: "今日返す本が2件あります。",
        url: "/return",
      })
    );
  });

  it("期限対象ユーザーに購読がなければ送信せず件数を返す", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ userEmail: "user@example.com", dueCount: 1 }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(notifications()).resolves.toEqual({
      targetedUsers: 1,
      subscriptions: 0,
      sent: 0,
      failed: 0,
      removed: 0,
    });
    expect(mockedSendNotification).not.toHaveBeenCalled();
  });

  it.each([20, 21])("%i件の購読を最大20件ずつ送る", async (count) => {
    const subscriptions = Array.from({ length: count }, (_, index) =>
      subscription(`sub-${index + 1}`)
    );
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ userEmail: "user@example.com", dueCount: 1 }],
      } as never)
      .mockResolvedValueOnce({ rows: subscriptions } as never);

    let active = 0;
    let maxActive = 0;
    mockedSendNotification.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return {} as never;
    });

    const result = await notifications();

    expect(result.sent).toBe(count);
    expect(result.failed).toBe(0);
    expect(mockedSendNotification).toHaveBeenCalledTimes(count);
    expect(maxActive).toBe(Math.min(count, 20));
  });

  it("404と410の購読だけ削除し、その他の失敗は保持する", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ userEmail: "user@example.com", dueCount: 1 }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          subscription("ok"),
          subscription("gone-404"),
          subscription("gone-410"),
          subscription("server-error"),
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never);
    mockedSendNotification
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 500 });

    await expect(notifications()).resolves.toEqual({
      targetedUsers: 1,
      subscriptions: 4,
      sent: 1,
      failed: 3,
      removed: 2,
    });
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    expect(mockedQuery.mock.calls[2]?.[1]).toEqual([
      ["gone-404", "gone-410"],
    ]);
  });
});
