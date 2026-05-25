import { beforeEach, describe, expect, it, vi } from "vitest";
import { summary } from "@/lib/ai/aiSummary";
import { groq } from "@/lib/ai/groq";
import { db } from "@/lib/db";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/groq", () => ({
  groq: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));

const mockedCreate = groq.chat.completions.create as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("threadの要約をThreadに保存する", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ summary: "短い要約" }) } }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const result = await summary({
      sourceType: "thread",
      sourceId: "thread-1",
      content: "長い投稿本文",
      updatedAt: "2026-05-22T10:00:00.000Z",
    });

    expect(result).toBe("短い要約");
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-oss-20b",
        response_format: { type: "json_object" },
      })
    );
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "Thread"'),
      ["短い要約", "2026-05-22T10:00:00.000Z", "thread-1"]
    );
  });

  it("commentの要約をThreadCommentに保存する", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ summary: "コメント要約" }) } }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const result = await summary({
      sourceType: "comment",
      sourceId: "comment-1",
      content: "長いコメント本文",
      updatedAt: "2026-05-22T11:00:00.000Z",
    });

    expect(result).toBe("コメント要約");
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "ThreadComment"'),
      ["コメント要約", "2026-05-22T11:00:00.000Z", "comment-1"]
    );
  });

  it("summaryが空ならDB更新しない", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ summary: "" }) } }],
    });

    const result = await summary({
      sourceType: "thread",
      sourceId: "thread-1",
      content: "長い投稿本文",
      updatedAt: "2026-05-22T10:00:00.000Z",
    });

    expect(result).toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
