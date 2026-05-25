import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/ai/chat/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));
vi.mock("@/lib/ai/groq", () => ({
  groq: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));
vi.mock("@ai-sdk/groq", () => ({
  groq: vi.fn(),
}));
vi.mock("@/lib/ai/search-books", () => ({
  searchBooks: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

type SeedAiChatMessage = {
  id: string;
  userEmail: string;
  role: "user" | "assistant";
  content: string;
  metadata: unknown;
  createdAt: Date;
};

function createMessage(index: number, userEmail = "user@example.com") {
  const paddedIndex = String(index).padStart(2, "0");

  return {
    id: `${userEmail}-message-${paddedIndex}`,
    userEmail,
    role: index % 2 === 0 ? "assistant" : "user",
    content: `message ${paddedIndex}`,
    metadata:
      index % 2 === 0
        ? {
            recommendedBooks: [
              {
                bookId: `book-${paddedIndex}`,
                title: `Book ${paddedIndex}`,
                bookReason: `book reason ${paddedIndex}`,
                communityReason: `community reason ${paddedIndex}`,
              },
            ],
          }
        : null,
    createdAt: new Date(`2026-05-22T10:${paddedIndex}:00.000Z`),
  } satisfies SeedAiChatMessage;
}

function selectLatest20ForUser(rows: SeedAiChatMessage[], userEmail: string) {
  return rows
    .filter((row) => row.userEmail === userEmail)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

describe("GET /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証なら401を返し、DBを読まない", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "認証が必要です" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("ログインユーザーの最新20件だけを古い順のUIMessageとして返す", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const userMessages = Array.from({ length: 25 }, (_, index) =>
      createMessage(index + 1)
    );
    const otherUserMessages = [
      {
        ...createMessage(1, "other@example.com"),
        createdAt: new Date("2026-05-22T10:26:00.000Z"),
      },
      {
        ...createMessage(2, "other@example.com"),
        createdAt: new Date("2026-05-22T10:27:00.000Z"),
      },
      {
        ...createMessage(3, "other@example.com"),
        createdAt: new Date("2026-05-22T10:28:00.000Z"),
      },
    ];
    const seededRows = [...userMessages, ...otherUserMessages];
    const expectedRows = userMessages.slice(-20);

    mockedQuery.mockImplementationOnce(async (sql: string, params: unknown[]) => {
      expect(String(sql)).toContain('WHERE "userEmail" = $1');
      expect(String(sql)).toContain('"userEmail"');
      expect(String(sql)).toContain("LIMIT 20");
      expect(String(sql)).toContain('ORDER BY "createdAt" DESC, id DESC');
      expect(String(sql)).toContain('ORDER BY "createdAt" ASC, id ASC');
      expect(params).toEqual(["user@example.com"]);

      return {
        rows: selectLatest20ForUser(seededRows, String(params[0])),
      };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(data.messages).toHaveLength(20);
    expect(data.messages.map((message: { id: string }) => message.id)).toEqual(
      expectedRows.map((row) => row.id)
    );
    expect(
      data.messages.some((message: { id: string }) =>
        message.id.startsWith("other@example.com-")
      )
    ).toBe(false);
    expect(data.messages[0]).toEqual({
      id: "user@example.com-message-06",
      role: "assistant",
      metadata: {
        recommendedBooks: [
          {
            bookId: "book-06",
            title: "Book 06",
            bookReason: "book reason 06",
            communityReason: "community reason 06",
          },
        ],
      },
      parts: [{ type: "text", text: "message 06" }],
    });
  });

  it("DBから別ユーザーの行が混ざって返ってもレスポンスには出さない", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    mockedQuery.mockResolvedValueOnce({
      rows: [
        createMessage(1, "user@example.com"),
        createMessage(2, "other@example.com"),
        createMessage(3, "user@example.com"),
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages.map((message: { id: string }) => message.id)).toEqual([
      "user@example.com-message-01",
      "user@example.com-message-03",
    ]);
  });
});
