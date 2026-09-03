// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element -- next/image is intentionally reduced to an img in this component unit test */

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiChatModal from "@/app/(user)/_components/AiChatModal";
import AiBookChat from "@/app/(user)/_components/AiBookChat";

const mocks = vi.hoisted(() => ({
  lastUseChatOptions: null as Record<string, unknown> | null,
  messagesOverride: null as Array<Record<string, unknown>> | null,
  sendMessage: vi.fn(),
  setMessages: vi.fn(),
  status: "ready",
}));

vi.mock("ai", () => ({
  DefaultChatTransport: class DefaultChatTransport {
    constructor() {}
  },
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: Record<string, unknown>) => {
    mocks.lastUseChatOptions = options;
    return {
      messages: mocks.messagesOverride ?? options.messages ?? [],
      sendMessage: mocks.sendMessage,
      setMessages: mocks.setMessages,
      status: mocks.status,
    };
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/app/(user)/_components/LibraryNavIcons", () => ({
  AiChatIcon: () => <span>AI icon</span>,
}));

vi.mock("@/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ConversationScrollButton: () => null,
}));

vi.mock("@/components/ai-elements/message", () => ({
  Message: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  MessageContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ai-elements/prompt-input", () => ({
  PromptInput: ({
    children,
    onSubmit,
  }: {
    children: ReactNode;
    onSubmit: () => void;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  ),
  PromptInputBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PromptInputFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PromptInputTextarea: (props: React.ComponentProps<"textarea">) => (
    <textarea {...props} />
  ),
  PromptInputSubmit: ({ disabled }: { disabled: boolean }) => (
    <button type="submit" disabled={disabled}>
      送信
    </button>
  ),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AI chat components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastUseChatOptions = null;
    mocks.messagesOverride = null;
    mocks.status = "ready";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ messages: [] })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("modalは初回openまでチャットをmountせず、閉じても履歴componentを保持する", async () => {
    const user = userEvent.setup();
    render(<AiChatModal />);
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "AIおすすめを開く" }));
    await screen.findByPlaceholderText("おすすめの本を聞く");
    expect(fetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await user.click(screen.getByRole("button", { name: "AIおすすめを開く" }));
    expect(screen.getByPlaceholderText("おすすめの本を聞く")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("履歴取得中を表示し、取得したtext messageを描画する", async () => {
    let resolveHistory!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveHistory = resolve;
      })
    );
    render(<AiBookChat />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();

    resolveHistory(
      jsonResponse({
        messages: [
          {
            id: "message-1",
            role: "assistant",
            parts: [{ type: "text", text: "過去の回答" }],
          },
        ],
      })
    );

    expect(await screen.findByText("過去の回答")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/ai/chat", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("履歴取得失敗時も空の入力画面へ復帰する", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    render(<AiBookChat />);

    expect(
      await screen.findByPlaceholderText("おすすめの本を聞く")
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("入力を送信してclearし、空入力とstreaming中は送信を無効化する", async () => {
    const user = userEvent.setup();
    const view = render(<AiBookChat />);
    const input = await screen.findByPlaceholderText("おすすめの本を聞く");
    const submit = screen.getByRole("button", { name: "送信" });
    expect(submit).toBeDisabled();

    await user.type(input, "おすすめを教えて");
    await user.click(submit);
    expect(mocks.sendMessage).toHaveBeenCalledWith({ text: "おすすめを教えて" });
    expect(input).toHaveValue("");

    mocks.status = "streaming";
    view.rerender(<AiBookChat />);
    await user.type(screen.getByPlaceholderText("おすすめの本を聞く"), "送れない");
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
  });

  it("推薦metadataを表示し、本clickログは連打しても1回だけ送る", async () => {
    const user = userEvent.setup();
    mocks.messagesOverride = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [],
        metadata: {
          recommendedBooks: [
            {
              recommendationId: "recommendation-1",
              bookId: "book-1",
              title: "おすすめ本",
              reason: "理由です",
              imageUrl: "https://example.test/book.png",
            },
          ],
        },
      },
    ];
    const fetchMock = vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input) === "/api/ai/chat") {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (String(input) === "/api/ai/book-link-click" && init?.method === "POST") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`unexpected fetch: ${String(input)}`);
    });
    render(<AiBookChat />);
    expect(await screen.findByText("おすすめ本")).toBeInTheDocument();
    expect(screen.getByText("理由です")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "おすすめ本" });
    expect(link).toHaveAttribute("href", "/book/book-1");
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    await user.click(link);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/book-link-click",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        body: JSON.stringify({
          eventType: "book_link_click",
          bookId: "book-1",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        }),
      })
    );
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/ai/book-link-click"
      )
    ).toHaveLength(1);
  });

  it("useChat errorをJSON/plain textからassistant messageへ変換する", async () => {
    render(<AiBookChat />);
    await screen.findByPlaceholderText("おすすめの本を聞く");
    const onError = mocks.lastUseChatOptions?.onError as
      | ((error: Error) => void)
      | undefined;
    expect(onError).toBeTypeOf("function");

    onError?.(new Error(JSON.stringify({ error: "構造化エラー" })));
    const jsonUpdater = mocks.setMessages.mock.calls[0][0] as (
      messages: unknown[]
    ) => Array<{ parts: Array<{ text: string }> }>;
    expect(jsonUpdater([])[0].parts[0].text).toBe("構造化エラー");

    onError?.(new Error("通常エラー"));
    const plainUpdater = mocks.setMessages.mock.calls[1][0] as (
      messages: unknown[]
    ) => Array<{ parts: Array<{ text: string }> }>;
    expect(plainUpdater([])[0].parts[0].text).toBe("通常エラー");
  });
});
