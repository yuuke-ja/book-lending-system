import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/book/loan/route";
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

function createLoanRequest(): Request {
  return new Request("http://localhost/api/book/loan", {
    method: "POST",
    body: JSON.stringify({ bookId: "book-1" }),
  });
}

function mockSettingsQuery() {
  mockedQuery.mockResolvedValueOnce({
    rows: [{ id: "settings-1", fridayOnly: true, loanPeriodDays: 2 }],
  });
}

function mockOpenPeriodByNowRange(start: Date, end: Date) {
  mockedQuery.mockImplementationOnce(async (_sql: string, params?: unknown[]) => {
    const now = params?.[1];
    if (!(now instanceof Date)) return { rows: [] };
    const inRange = now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
    if (!inRange) return { rows: [] };
    return {
      rows: [{ id: "open-period-1", loanPeriodDays: 7, endDate: end }],
    };
  });
}

function mockBorrowSuccessTail() {
  mockedQuery.mockResolvedValueOnce({ rows: [{ id: "book-1" }] });
  mockedQuery.mockResolvedValueOnce({ rows: [] });
  mockedQuery.mockResolvedValueOnce({});
}

describe("POST /api/book/loan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00.000+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await POST(createLoanRequest());

    expect(res.status).toBe(401);
  });

  it.each([
    {
      caseName: "例外期間の1日前（非金曜）は借りられない",
      now: "2026-03-08T12:00:00.000+09:00",
      expectedStatus: 403,
      expectedQueryCount: 2,
      expectedInPeriod: false,
    },
    {
      caseName: "例外期間の開始日（非金曜）は借りられる",
      now: "2026-03-09T12:00:00.000+09:00",
      expectedStatus: 200,
      expectedQueryCount: 5,
      expectedInPeriod: true,
    },
    {
      caseName: "例外期間の期間中（非金曜）は借りられる",
      now: "2026-03-10T12:00:00.000+09:00",
      expectedStatus: 200,
      expectedQueryCount: 5,
      expectedInPeriod: true,
    },
    {
      caseName: "例外期間の終了日（非金曜）は借りられる",
      now: "2026-03-11T12:00:00.000+09:00",
      expectedStatus: 200,
      expectedQueryCount: 5,
      expectedInPeriod: true,
    },
    {
      caseName: "例外期間の1日後（非金曜）は借りられない",
      now: "2026-03-12T12:00:00.000+09:00",
      expectedStatus: 403,
      expectedQueryCount: 2,
      expectedInPeriod: false,
    },
  ])("$caseName", async (scenario) => {
    const exceptionStart = new Date("2026-03-09T00:00:00.000+09:00");
    const exceptionEnd = new Date("2026-03-11T23:59:59.999+09:00");

    vi.setSystemTime(new Date(scenario.now));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    mockSettingsQuery();
    mockOpenPeriodByNowRange(exceptionStart, exceptionEnd);
    if (scenario.expectedStatus === 200) {
      mockBorrowSuccessTail();
    }

    const res = await POST(createLoanRequest());

    expect(res.status).toBe(scenario.expectedStatus);
    expect(mockedQuery).toHaveBeenCalledTimes(scenario.expectedQueryCount);

    if (scenario.expectedInPeriod) {
      const insertParams = mockedQuery.mock.calls[4]?.[1] as unknown[] | undefined;
      const dueAt = insertParams?.[3];
      expect(dueAt).toBeInstanceOf(Date);
      expect((dueAt as Date).toISOString()).toBe(exceptionEnd.toISOString());
    }
  });

  it("金曜日は例外期間外でも借りられる", async () => {
    vi.setSystemTime(new Date("2026-03-06T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    mockSettingsQuery();
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockBorrowSuccessTail();

    const res = await POST(createLoanRequest());

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(5);
  });

  it("fridayOnlyがfalseなら非金曜・例外期間外でも借りられる", async () => {
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: "settings-1", fridayOnly: false, loanPeriodDays: 2 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockBorrowSuccessTail();

    const res = await POST(createLoanRequest());

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(5);
  });

  it("貸出設定が未作成なら非金曜は借りられない", async () => {
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000+09:00"));
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await POST(createLoanRequest());

    expect(res.status).toBe(403);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});
