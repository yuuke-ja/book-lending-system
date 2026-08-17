import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as dailyNotification } from "@/app/api/cron/daily-notification/route";
import { GET as embeddingKeepalive } from "@/app/api/cron/embedding-keepalive/route";
import { notifications } from "@/lib/notification";

vi.mock("@/lib/notification", () => ({ notifications: vi.fn() }));

const mockedNotifications = vi.mocked(notifications);

function request(path: string, headers: HeadersInit = {}) {
  return new Request(`http://localhost${path}`, { headers });
}

describe("cron routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("EMBEDDING_API_URL", "https://embedding.example.com/");
    vi.stubEnv("HF_TOKEN", "hf-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("GET /api/cron/daily-notification", () => {
    it.each([
      ["headerなし", new Headers()],
      ["secret不一致", new Headers({ "x-cron-secret": "wrong" })],
      ["Bearer形式不正", new Headers({ authorization: "cron-secret" })],
      ["Bearer不一致", new Headers({ authorization: "Bearer wrong" })],
    ])("%sなら401", async (_name, headers) => {
      const response = await dailyNotification(
        request("/api/cron/daily-notification", headers)
      );

      expect(response.status).toBe(401);
      expect(mockedNotifications).not.toHaveBeenCalled();
    });

    it.each([
      new Headers({ "x-cron-secret": "cron-secret" }),
      new Headers({ authorization: "Bearer cron-secret" }),
    ])("許可されたsecretで通知結果を返す", async (headers) => {
      mockedNotifications.mockResolvedValueOnce({
        targetedUsers: 2,
        subscriptions: 3,
        sent: 2,
        failed: 1,
        removed: 1,
      });

      const response = await dailyNotification(
        request("/api/cron/daily-notification", headers)
      );

      expect(response.status).toBe(200);
      expect(mockedNotifications).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        targetedUsers: 2,
        sent: 2,
        failed: 1,
      });
    });

    it("通知処理の失敗は安定した500レスポンスへ変換する", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockedNotifications.mockRejectedValueOnce(new Error("push failed"));

      const response = await dailyNotification(
        request("/api/cron/daily-notification", {
          "x-cron-secret": "cron-secret",
        })
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: "日次通知の送信に失敗しました",
      });
    });
  });

  describe("GET /api/cron/embedding-keepalive", () => {
    it("認証に失敗したら401", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const response = await embeddingKeepalive(
        request("/api/cron/embedding-keepalive")
      );

      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ["EMBEDDING_API_URL", ""],
      ["HF_TOKEN", ""],
    ])("%s不足なら500", async (name, value) => {
      vi.stubEnv(name, value);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const response = await embeddingKeepalive(
        request("/api/cron/embedding-keepalive", {
          authorization: "Bearer cron-secret",
        })
      );

      expect(response.status).toBe(500);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("health endpointへBearer付きで接続し成功なら200", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await embeddingKeepalive(
        request("/api/cron/embedding-keepalive", {
          "x-cron-secret": "cron-secret",
        })
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://embedding.example.com/health",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer hf-token" },
          cache: "no-store",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("fetch拒否なら202", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

      const response = await embeddingKeepalive(
        request("/api/cron/embedding-keepalive", {
          "x-cron-secret": "cron-secret",
        })
      );

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({ ok: false });
    });

    it("upstream非2xxなら502で本文を300文字に切る", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("x".repeat(350), { status: 503 }))
      );

      const response = await embeddingKeepalive(
        request("/api/cron/embedding-keepalive", {
          "x-cron-secret": "cron-secret",
        })
      );
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.status).toBe(503);
      expect(body.message).toHaveLength(300);
    });
  });
});
