import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/book/search/log/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));
vi.mock("@/lib/search-event.server", () => ({
  recordSearchEvent: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedRecordSearchEvent = recordSearchEvent as unknown as ReturnType<
  typeof vi.fn
>;

function createRequest(count: unknown) {
  return new Request("http://localhost/api/book/search/log", {
    method: "POST",
    body: JSON.stringify({
      query: "Go言語",
      selectedTags: [],
      resultTagIds: [],
      count,
    }),
  });
}

describe("本一覧検索の検索結果件数", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rows: [] });
    mockedRecordSearchEvent.mockResolvedValue({ id: "search-event-1" });
  });

  it("検索結果件数を検索履歴の保存処理へ渡す", async () => {
    await POST(createRequest(4));

    expect(mockedRecordSearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ count: 4 })
    );
  });

  it("検索結果が0件なら0を検索履歴の保存処理へ渡す", async () => {
    await POST(createRequest(0));

    expect(mockedRecordSearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ count: 0 })
    );
  });

  it("不正な検索結果件数なら0を検索履歴の保存処理へ渡す", async () => {
    await POST(createRequest(-1));

    expect(mockedRecordSearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ count: 0 })
    );
  });
});
