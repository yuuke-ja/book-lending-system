import { beforeEach, describe, expect, it, vi } from "vitest";

import { findCandidatesFromHistory } from "@/lib/Recommended/vector-candidates-from-history";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));

const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("findCandidatesFromHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("最近の履歴10件から近い本を5冊ずつ一括検索する", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          historyBookId: "source-book",
          occurredAt: new Date("2026-06-23T10:00:00+09:00"),
          bookId: "candidate-book",
          distance: "0.123",
        },
      ],
    });

    const result = await findCandidatesFromHistory("user@example.com");

    expect(mockedQuery).toHaveBeenCalledOnce();
    expect(mockedQuery.mock.calls[0]?.[1]).toEqual(["user@example.com"]);

    const sql = String(mockedQuery.mock.calls[0]?.[0]);
    expect(sql).toContain("WITH recent_book_events AS");
    expect(sql).toContain("CROSS JOIN LATERAL");
    expect(sql).toContain("LIMIT 10");
    expect(sql).toContain("LIMIT 5");
    expect(sql).toContain('embedding."bookId" <> book_events."bookId"');

    expect(result).toEqual([
      {
        historyBookId: "source-book",
        occurredAt: new Date("2026-06-23T10:00:00+09:00"),
        bookId: "candidate-book",
        distance: 0.123,
      },
    ]);
  });
});
