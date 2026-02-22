import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/push/unsubscribe/route";
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

describe("POST /api/push/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const req = new Request("http://localhost/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("endpointが無いとき400を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const req = new Request("http://localhost/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("購読解除に成功したとき200を返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({});

    const req = new Request("http://localhost/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: "https://example.com/endpoint" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});
