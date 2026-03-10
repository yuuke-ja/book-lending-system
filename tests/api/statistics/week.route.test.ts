import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/statistics/week/route";
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
    `http://localhost/api/statistics/week?anchorDate=${encodeURIComponent(anchorDate)}`
  );
}

describe("GET /api/statistics/week", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  it("6週分がすべて0件でもそのまま返す", async () => {
    const rows = [
      { weekStart: "2026-01-26T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-02T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-09T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-16T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-23T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-03-02T15:00:00.000Z", loanCount: 0, userCount: 0 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-08"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), ["2026-03-08"]);
  });

  it("複数週にまたがる集計結果を返す", async () => {
    const rows = [
      { weekStart: "2026-01-26T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-02T15:00:00.000Z", loanCount: 3, userCount: 2 },
      { weekStart: "2026-02-09T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-16T15:00:00.000Z", loanCount: 5, userCount: 3 },
      { weekStart: "2026-02-23T15:00:00.000Z", loanCount: 1, userCount: 1 },
      { weekStart: "2026-03-02T15:00:00.000Z", loanCount: 4, userCount: 2 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-08"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
  });

  it("元データに期間外の週があってもレスポンスには直近6週分だけ出す", async () => {
    const sourceRows = [
      { weekStart: "2024-12-29T15:00:00.000Z", loanCount: 9, userCount: 4 },
      { weekStart: "2026-02-01T15:00:00.000Z", loanCount: 8, userCount: 3 },
      { weekStart: "2026-02-08T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-15T15:00:00.000Z", loanCount: 2, userCount: 1 },
      { weekStart: "2026-02-22T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-03-01T15:00:00.000Z", loanCount: 4, userCount: 2 },
      { weekStart: "2026-03-08T15:00:00.000Z", loanCount: 1, userCount: 1 },
      { weekStart: "2026-03-15T15:00:00.000Z", loanCount: 3, userCount: 2 },
      { weekStart: "2026-03-22T15:00:00.000Z", loanCount: 7, userCount: 3 },
    ];
    const rows = sourceRows.filter((row) =>
      [
        "2026-02-08T15:00:00.000Z",
        "2026-02-15T15:00:00.000Z",
        "2026-02-22T15:00:00.000Z",
        "2026-03-01T15:00:00.000Z",
        "2026-03-08T15:00:00.000Z",
        "2026-03-15T15:00:00.000Z",
      ].includes(row.weekStart)
    );
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-20"));
    const data = await res.json();
    const sql = mockedQuery.mock.calls[0]?.[0] as string;

    expect(res.status).toBe(200);
    expect(data).toEqual(rows);
    expect(data).toHaveLength(6);
    expect(sourceRows.map((item) => item.weekStart)).toContain("2024-12-29T15:00:00.000Z");
    expect(data.map((item: { weekStart: string }) => item.weekStart)).not.toContain(
      "2024-12-29T15:00:00.000Z"
    );
    expect(data.map((item: { weekStart: string }) => item.weekStart)).not.toContain(
      "2026-02-01T15:00:00.000Z"
    );
    expect(data.map((item: { weekStart: string }) => item.weekStart)).not.toContain(
      "2026-03-22T15:00:00.000Z"
    );
    expect(data[0].weekStart).toBe("2026-02-08T15:00:00.000Z");
    expect(data[5].weekStart).toBe("2026-03-15T15:00:00.000Z");
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), ["2026-03-20"]);
    expect(sql).toContain("date_trunc('week', $1::date) - interval '5 weeks'");
    expect(sql).toContain("date_trunc('week', $1::date)");
    expect(sql).toContain("interval '1 week'");
  });

  it("同じ利用者の複数貸出を含む週でも userCount をそのまま返す", async () => {
    const rows = [
      { weekStart: "2026-01-26T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-02T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-09T15:00:00.000Z", loanCount: 4, userCount: 1 },
      { weekStart: "2026-02-16T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-02-23T15:00:00.000Z", loanCount: 0, userCount: 0 },
      { weekStart: "2026-03-02T15:00:00.000Z", loanCount: 0, userCount: 0 },
    ];
    mockedQuery.mockResolvedValue({ rows });

    const res = await GET(createRequest("2026-03-08"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[2]).toEqual({
      weekStart: "2026-02-09T15:00:00.000Z",
      loanCount: 4,
      userCount: 1,
    });
  });
});
