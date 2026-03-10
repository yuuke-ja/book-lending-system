import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/statistics/summary/route";
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

describe("GET /api/statistics/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
  });

  it("件数が0でも数値で返す", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            thisWeekLoanCount: "0",
            thisWeekUserCount: "0",
            thisMonthLoanCount: "0",
            thisMonthUserCount: "0",
            activeLoanCount: "0",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ totalBookCount: "0" }],
      });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      thisWeekLoanCount: 0,
      thisWeekUserCount: 0,
      thisMonthLoanCount: 0,
      thisMonthUserCount: 0,
      activeLoanCount: 0,
      bookCount: 0,
    });
  });

  it("今週と今月の件数を分けて数値で返す", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            thisWeekLoanCount: "2",
            thisWeekUserCount: "1",
            thisMonthLoanCount: "9",
            thisMonthUserCount: "4",
            activeLoanCount: "3",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ totalBookCount: "120" }],
      });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      thisWeekLoanCount: 2,
      thisWeekUserCount: 1,
      thisMonthLoanCount: 9,
      thisMonthUserCount: 4,
      activeLoanCount: 3,
      bookCount: 120,
    });
  });

  it("貸出中冊数と蔵書数を別々に返す", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            thisWeekLoanCount: "5",
            thisWeekUserCount: "2",
            thisMonthLoanCount: "12",
            thisMonthUserCount: "6",
            activeLoanCount: "4",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ totalBookCount: "250" }],
      });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeLoanCount).toBe(4);
    expect(data.bookCount).toBe(250);
    expect(data.thisMonthLoanCount).toBe(12);
  });
});
