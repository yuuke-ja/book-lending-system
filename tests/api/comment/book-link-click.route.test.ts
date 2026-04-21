import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/comment/book-link-click/route";
import { auth } from "@/lib/auth";
import { recordResearchEvent } from "@/lib/research-event.server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/research-event.server", () => ({
  recordResearchEvent: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedRecordResearchEvent = recordResearchEvent as unknown as ReturnType<typeof vi.fn>;

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/comment/book-link-click", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/comment/book-link-click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("コメントから本リンクをクリックしたときbook_link_clickを保存する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const res = await POST(
      createRequest({
        eventType: "book_link_click",
        bookId: "book-1",
        sourceType: "comment",
        sourceId: "comment-1",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockedRecordResearchEvent).toHaveBeenCalledWith({
      eventType: "book_link_click",
      userEmail: "user@example.com",
      bookId: "book-1",
      sourceType: "comment",
      sourceId: "comment-1",
    });
  });

  it.each([
    {
      caseName: "eventTypeが不正",
      body: {
        eventType: "loan",
        bookId: "book-1",
        sourceType: "comment",
        sourceId: "comment-1",
      },
      expectedError: "eventTypeが不正です",
    },
    {
      caseName: "bookIdが空文字",
      body: {
        eventType: "book_link_click",
        bookId: "",
        sourceType: "comment",
        sourceId: "comment-1",
      },
      expectedError: "bookIdが不正です",
    },
    {
      caseName: "bookIdが文字列ではない",
      body: {
        eventType: "book_link_click",
        bookId: 123,
        sourceType: "comment",
        sourceId: "comment-1",
      },
      expectedError: "bookIdが不正です",
    },
    {
      caseName: "sourceTypeが不正",
      body: {
        eventType: "book_link_click",
        bookId: "book-1",
        sourceType: "thread",
        sourceId: "comment-1",
      },
      expectedError: "sourceTypeが不正です",
    },
    {
      caseName: "sourceIdが空文字",
      body: {
        eventType: "book_link_click",
        bookId: "book-1",
        sourceType: "comment",
        sourceId: "",
      },
      expectedError: "sourceIdが不正です",
    },
    {
      caseName: "sourceIdが文字列ではない",
      body: {
        eventType: "book_link_click",
        bookId: "book-1",
        sourceType: "comment",
        sourceId: 999,
      },
      expectedError: "sourceIdが不正です",
    },
  ])("$caseName のとき400を返す", async ({ body, expectedError }) => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const res = await POST(createRequest(body));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: expectedError });
    expect(mockedRecordResearchEvent).not.toHaveBeenCalled();
  });
});
