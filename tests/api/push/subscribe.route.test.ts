import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/push/subscribe/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const req = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("購読情報が不正なとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const req = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: {} }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("購読情報の保存に成功したとき200を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({});

    const req = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        subscription: {
          endpoint: "https://example.com/endpoint",
          keys: {
            p256dh: "p256dh-key",
            auth: "auth-key",
          },
        },
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});
