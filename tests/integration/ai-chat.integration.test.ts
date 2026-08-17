import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { groq } from "@/lib/ai/groq";
import { streamText } from "ai";
import { GET, POST } from "@/app/api/ai/chat/route";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

const { streamState, streamResponse, modelMock, TimeoutError, RateLimitError, ApiError } =
  vi.hoisted(() => {
    class TimeoutError extends Error {}
    class RateLimitError extends Error {}
    class ApiError extends Error {}
    return {
      streamState: { options: null as null | Record<string, unknown> },
      streamResponse: vi.fn(),
      modelMock: vi.fn(() => ({ model: "integration-model" })),
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
vi.mock("@ai-sdk/groq", () => ({ groq: modelMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));
vi.mock("@/lib/ai/search-books", () => ({ searchBooks: vi.fn() }));
vi.mock("@/lib/ai/aisearcheventlog", () => ({ aisearcheventlog: vi.fn() }));
vi.mock("@/lib/ai/groq", () => ({
  groq: { chat: { completions: { create: vi.fn() } } },
}));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedAuth = vi.mocked(auth);
const mockedQuery = vi.mocked(db.query);
const mockedCompletion = vi.mocked(groq.chat.completions.create);
const mockedStreamText = vi.mocked(streamText);

function postRequest(text: string) {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          id: "user-message",
          role: "user",
          parts: [{ type: "text", text }],
        },
      ],
    }),
  });
}

describeWithDatabase("AIチャット履歴保存とPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    streamState.options = null;
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } } as never);
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
    mockedCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ intent: "smalltalk", reply: "こんにちは" }),
          },
        },
      ],
    } as never);
    streamResponse.mockImplementation((options: Record<string, unknown>) => {
      streamState.options = options;
      return new Response("stream", { status: 200 });
    });
    mockedStreamText.mockReturnValue({
      toUIMessageStreamResponse: streamResponse,
    } as never);
    await withTempTableSetup(client, async () => {
      await dropTempTables(client, ["AiChatMessage"]);
      await client.query(`
        CREATE TEMP TABLE "AiChatMessage" (
          id TEXT PRIMARY KEY,
          "userEmail" TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          metadata JSONB,
          intent TEXT,
          "searchQuery" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK (role IN ('user', 'assistant'))
        )
      `);
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("POSTでユーザー発言を保存し、stream完了時にAI回答も保存する", async () => {
    const response = await POST(postRequest("こんにちは"));

    expect(response.status).toBe(200);
    const beforeFinish = await client.query(
      `SELECT role, content, intent, "searchQuery" FROM "AiChatMessage" ORDER BY role DESC`
    );
    expect(beforeFinish.rows).toEqual([
      {
        role: "user",
        content: "こんにちは",
        intent: "smalltalk",
        searchQuery: "こんにちは",
      },
    ]);

    const onFinish = streamState.options?.onFinish as
      | ((input: { responseMessage: unknown }) => Promise<void>)
      | undefined;
    expect(onFinish).toBeTypeOf("function");
    await onFinish?.({
      responseMessage: {
        id: "assistant-message",
        role: "assistant",
        parts: [{ type: "text", text: "こんにちは。何をお探しですか？" }],
      },
    });

    const saved = await client.query(
      `SELECT id, role, content, intent FROM "AiChatMessage" ORDER BY "createdAt", id`
    );
    expect(saved.rows).toEqual([
      {
        id: "user-message",
        role: "user",
        content: "こんにちは",
        intent: "smalltalk",
      },
      {
        id: "assistant-message",
        role: "assistant",
        content: "こんにちは。何をお探しですか？",
        intent: "smalltalk",
      },
    ]);
  });

  it("GETは指定ユーザーの最新20件だけを古い順へ並べ直して返す", async () => {
    const ownMessages = Array.from({ length: 21 }, (_, index) =>
      `('own-${String(index).padStart(2, "0")}', 'user@example.com', 'user',
        'message-${index}', '2026-08-16T00:00:${String(index).padStart(2, "0")}Z')`
    );
    await client.query(`
      INSERT INTO "AiChatMessage"
        (id, "userEmail", role, content, "createdAt") VALUES
        ${ownMessages.join(",")},
        ('other', 'other@example.com', 'user', 'other-message', '2026-08-16T00:01:00Z')
    `);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messages).toHaveLength(20);
    expect(body.messages[0].id).toBe("own-01");
    expect(body.messages.at(-1).id).toBe("own-20");
    expect(body.messages.some((message: { id: string }) => message.id === "other")).toBe(false);
  });
});
