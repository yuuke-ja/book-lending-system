import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/comment/research-event/route";
import { auth } from "@/lib/auth";
import { recordResearchEvent } from "@/lib/research-event.server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/research-event.server", () => ({
  recordResearchEvent: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedRecordResearchEvent = recordResearchEvent as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/comment/research-event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("コメント閲覧時にpost_viewを保存する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const res = await POST(
      new Request("http://localhost/api/comment/research-event", {
        method: "POST",
        body: JSON.stringify({
          eventType: "post_view",
          bookId: "book-1",
          sourceType: "comment",
          sourceId: "comment-1",
        }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockedRecordResearchEvent).toHaveBeenCalledWith({
      eventType: "post_view",
      userEmail: "user@example.com",
      bookId: "book-1",
      sourceType: "comment",
      sourceId: "comment-1",
    });
  });
});
