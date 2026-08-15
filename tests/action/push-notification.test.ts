import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  subscribePushNotification,
  unsubscribePushNotification,
} from "@/lib/action/push-notification";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("Push通知Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインでは購読登録できない", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await subscribePushNotification({});

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("不正な購読情報を拒否する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await subscribePushNotification({ endpoint: "test" });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("購読情報を保存する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({});

    const result = await subscribePushNotification({
      endpoint: "https://example.com/endpoint",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("未ログインでは購読解除できない", async () => {
    mockedAuth.mockResolvedValue(null);

    const result = await unsubscribePushNotification("endpoint");

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("endpointなしを拒否する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await unsubscribePushNotification("");

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("購読情報を削除する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({});

    const result = await unsubscribePushNotification(
      "https://example.com/endpoint"
    );

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});
