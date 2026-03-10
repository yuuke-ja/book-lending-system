import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/statistics/month/route";
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

function createRequest(anchorDate: string) {
  return new Request(
    `http://localhost/api/statistics/month?anchorDate=${encodeURIComponent(anchorDate)}`
  );
}

describe("GET /api/statistics/month", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  it("6か月分がすべて0件でもそのまま返す", async () => {
    const rows = [
      { monthStart: "2025-09-30T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-10-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-11-30T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-12-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2026-01-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2026-02-28T15:00:00.000Z", loanCount: 0, userCount: 0 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-08"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), ["2026-03-08"]);
  });

  it("複数月にまたがる集計結果を返す", async () => {
    const rows = [
      { monthStart: "2025-09-30T15:00:00.000Z", loanCount: 1, userCount: 1 },
      { monthStart: "2025-10-31T15:00:00.000Z", loanCount: 3, userCount: 2 },
      { monthStart: "2025-11-30T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-12-31T15:00:00.000Z", loanCount: 8, userCount: 5 },
      { monthStart: "2026-01-31T15:00:00.000Z", loanCount: 2, userCount: 2 },
      { monthStart: "2026-02-28T15:00:00.000Z", loanCount: 4, userCount: 3 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-08"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
  });

  it("直近6か月分を取得するSQLで問い合わせる", async () => {
    const rows = [
      { monthStart: "2025-10-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-11-30T15:00:00.000Z", loanCount: 2, userCount: 1 },
      { monthStart: "2025-12-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2026-01-31T15:00:00.000Z", loanCount: 4, userCount: 2 },
      { monthStart: "2026-02-28T15:00:00.000Z", loanCount: 1, userCount: 1 },
      { monthStart: "2026-03-31T15:00:00.000Z", loanCount: 3, userCount: 2 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-04-10"));
    const data = await res.json();
    const sql = mockedQuery.mock.calls[0]?.[0] as string;

    expect(res.status).toBe(200);
    expect(data).toEqual(rows);
    expect(data).toHaveLength(6);
    expect(data[0].monthStart).toBe("2025-10-31T15:00:00.000Z");
    expect(data[5].monthStart).toBe("2026-03-31T15:00:00.000Z");
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), ["2026-04-10"]);
    expect(sql).toContain("date_trunc('month', $1::date) - interval '5 months'");
    expect(sql).toContain("date_trunc('month', $1::date)");
    expect(sql).toContain("interval '1 month'");
  });

  it("同じ利用者の複数貸出を含む月でも userCount をそのまま返す", async () => {
    const rows = [
      { monthStart: "2025-09-30T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-10-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-11-30T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2025-12-31T15:00:00.000Z", loanCount: 6, userCount: 1 },
      { monthStart: "2026-01-31T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { monthStart: "2026-02-28T15:00:00.000Z", loanCount: 0, userCount: 0 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-08"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[3]).toEqual({
      monthStart: "2025-12-31T15:00:00.000Z",
      loanCount: 6,
      userCount: 1,
    });
  });
});
