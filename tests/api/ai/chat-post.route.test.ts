import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/chat/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchBooks } from "@/lib/ai/search-books";
import { aisearcheventlog } from "@/lib/ai/aisearcheventlog";
import { groq } from "@/lib/ai/groq";
import { streamText } from "ai";

const {
  streamState,
  toStreamResponseMock,
  groqModelMock,
  TimeoutError,
  RateLimitError,
  ApiError,
} = vi.hoisted(() => {
  class TimeoutError extends Error {}
  class RateLimitError extends Error {}
  class ApiError extends Error {}
  return {
    streamState: { options: null as null | Record<string, unknown> },
    toStreamResponseMock: vi.fn(),
    groqModelMock: vi.fn(() => ({ model: "mock-model" })),
    TimeoutError,
    RateLimitError,
    ApiError,
  };
});

vi.mock("groq-sdk", () => ({
  default: {
    APIConnectionTimeoutError: TimeoutError,
    RateLimitError,
    APIError: ApiError,
  },
}));
vi.mock("ai", () => ({ streamText: vi.fn() }));
vi.mock("@ai-sdk/groq", () => ({ groq: groqModelMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));
vi.mock("@/lib/ai/search-books", () => ({ searchBooks: vi.fn() }));
vi.mock("@/lib/ai/aisearcheventlog", () => ({ aisearcheventlog: vi.fn() }));
vi.mock("@/lib/ai/groq", () => ({
  groq: { chat: { completions: { create: vi.fn() } } },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = vi.mocked(db.query);
const mockedSearchBooks = vi.mocked(searchBooks);
const mockedSearchEventLog = vi.mocked(aisearcheventlog);
const mockedCompletion = vi.mocked(groq.chat.completions.create);
const mockedStreamText = vi.mocked(streamText);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function userMessage(text: string) {
  return {
    id: "user-message-1",
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  };
}

async function finishStream(text = "回答です") {
  const onFinish = streamState.options?.onFinish as
    | ((input: { responseMessage: ReturnType<typeof userMessage> }) => Promise<void>)
    | undefined;
  expect(onFinish).toBeTypeOf("function");
  await onFinish?.({
    responseMessage: {
      id: "assistant-message-1",
      role: "user",
      parts: [{ type: "text", text }],
    },
  });
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamState.options = null;
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rows: [] } as never);
    mockedSearchEventLog.mockResolvedValue({} as never);
    toStreamResponseMock.mockImplementation((options: Record<string, unknown>) => {
      streamState.options = options;
      return new Response("stream", { status: 200 });
    });
    mockedStreamText.mockReturnValue({
      toUIMessageStreamResponse: toStreamResponseMock,
    } as never);
  });

  it("未認証なら401で依存を呼ばない", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await POST(request({ query: "おすすめ" }));

    expect(response.status).toBe(401);
    expect(mockedCompletion).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(mockedStreamText).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { query: "" },
    { query: "   " },
    { messages: [{ id: "assistant", role: "assistant", parts: [] }] },
  ])("検索文がなければ400", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(mockedCompletion).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("messagesの最後のuser textを検索文として使う", async () => {
    mockedCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ intent: "smalltalk", reply: "はい" }) } }],
    } as never);

    const response = await POST(
      request({
        messages: [userMessage("最初"), { ...userMessage("最後"), id: "user-message-2" }],
      })
    );

    expect(response.status).toBe(200);
    expect(mockedCompletion.mock.calls[0][0].messages.at(-1)).toMatchObject({
      role: "user",
      content: "最後",
    });
    expect(mockedQuery.mock.calls[0][1]).toEqual([
      "user-message-2",
      "user@example.com",
      "最後",
      "null",
      "smalltalk",
      "最後",
    ]);
  });

  it("book_searchでは候補内の推薦だけ保存してstream完了後にassistantも保存する", async () => {
    mockedCompletion
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ intent: "book_search", searchQuery: "React 初心者" }),
            },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "おすすめです",
                recommendedBooks: [
                  { bookId: "book-1", bookReason: "入門向け", communityReason: "読みやすいとの声" },
                  { bookId: "hallucinated-book", bookReason: "存在しない" },
                ],
              }),
            },
          },
        ],
      } as never);
    mockedSearchBooks.mockResolvedValueOnce([
      {
        id: "book-1",
        title: "React入門",
        authors: ["著者"],
        description: "説明",
        thumbnail: null,
        distance: 0.1,
        community: ["読みやすい"],
      },
    ]);
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "recommendation-1" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const response = await POST(
      request({ messages: [userMessage("Reactのおすすめを教えて")] })
    );

    expect(response.status).toBe(200);
    expect(mockedSearchBooks).toHaveBeenCalledWith("React 初心者");
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(String(mockedQuery.mock.calls[1][0])).toContain('INSERT INTO "AiRecommendation"');
    expect(mockedQuery.mock.calls[1][1]).toEqual([
      "book-1",
      "user@example.com",
      "React 初心者",
      "入門向け\n読みやすいとの声",
      1,
      "user-message-1",
    ]);
    expect(mockedSearchEventLog).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      query: "React 初心者",
      recommendedBooks: ["book-1"],
    });
    expect(toStreamResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({ messageMetadata: expect.any(Function) })
    );

    await finishStream();
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    expect(String(mockedQuery.mock.calls[2][0])).toContain("'assistant'");
    expect(mockedQuery.mock.calls[2][1]?.[1]).toBe("user@example.com");
  });

  it("推薦保存の途中で失敗した場合は500となり、完了済みの部分保存を確認できる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedCompletion
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "book_search",
                searchQuery: "設計",
              }),
            },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendedBooks: [
                  { bookId: "book-1", bookReason: "理由1" },
                  { bookId: "book-2", bookReason: "理由2" },
                ],
              }),
            },
          },
        ],
      } as never);
    mockedSearchBooks.mockResolvedValueOnce([
      {
        id: "book-1",
        title: "設計本1",
        authors: [],
        description: "説明1",
        thumbnail: null,
        distance: 0.1,
        community: [],
      },
      {
        id: "book-2",
        title: "設計本2",
        authors: [],
        description: "説明2",
        thumbnail: null,
        distance: 0.2,
        community: [],
      },
    ]);
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "recommendation-1" }] } as never)
      .mockRejectedValueOnce(new Error("second recommendation failed"));

    const response = await POST(
      request({ messages: [userMessage("設計の本を教えて")] })
    );

    expect(response.status).toBe(500);
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    expect(String(mockedQuery.mock.calls[0][0])).toContain('"AiChatMessage"');
    expect(mockedQuery.mock.calls[1][1]?.[0]).toBe("book-1");
    expect(mockedQuery.mock.calls[2][1]?.[0]).toBe("book-2");
    expect(mockedSearchEventLog).not.toHaveBeenCalled();
    expect(mockedStreamText).not.toHaveBeenCalled();
  });

  it.each([
    ["smalltalk", "雑談"],
    ["System-questions", "システム質問"],
    ["other", "その他"],
  ])("%sでは本検索や推薦保存を行わない", async (intent, query) => {
    mockedCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ intent, reply: "返答" }) } }],
    } as never);

    const response = await POST(request({ query }));

    expect(response.status).toBe(200);
    expect(mockedSearchBooks).not.toHaveBeenCalled();
    expect(mockedSearchEventLog).not.toHaveBeenCalled();
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    await finishStream();
    expect(mockedQuery).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new TimeoutError("timeout"), 504],
    [new RateLimitError("rate limit"), 429],
    [new ApiError("maximum context length"), 413],
    [new Error("unknown"), 500],
  ])("Groq/依存例外を適切なstatusへ変換する", async (error, status) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedCompletion.mockRejectedValueOnce(error);

    const response = await POST(request({ query: "おすすめ" }));

    expect(response.status).toBe(status);
    consoleError.mockRestore();
  });

  it("Groqが壊れたJSONを返したら500でDBへ保存しない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: "not-json" } }],
    } as never);

    const response = await POST(request({ query: "おすすめ" }));

    expect(response.status).toBe(500);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
