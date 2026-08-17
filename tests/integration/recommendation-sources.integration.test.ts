import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { db } from "@/lib/db";
import { createEmbedding } from "@/app/api/admin/book-embeddings/embedding";
import { findCandidatesFromHistory } from "@/lib/Recommended/vector-candidates-from-history";
import { findCandidatesFromSearchHistory } from "@/lib/Recommended/vector-candidates-from-search-history";
import { findTagCandidatesFromSearchHistory } from "@/lib/Recommended/tag-candidates-from-search-history";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));
vi.mock("@/app/api/admin/book-embeddings/embedding", () => ({
  createEmbedding: vi.fn(),
}));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedQuery = vi.mocked(db.query);
const mockedCreateEmbedding = vi.mocked(createEmbedding);

async function createTables(client: Client) {
  await dropTempTables(client, [
    "TagSubterm",
    "BookTag",
    "TagList",
    "BookEmbedding",
    "SearchEvent",
    "ResearchEvent",
  ]);
  await client.query(`
    CREATE TEMP TABLE "ResearchEvent" (
      id TEXT PRIMARY KEY,
      "eventType" TEXT NOT NULL,
      "userEmail" TEXT NOT NULL,
      "bookId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "sourceId" TEXT,
      "occurredAt" TIMESTAMPTZ NOT NULL,
      CHECK ("eventType" IN ('post_view', 'book_detail_view', 'loan', 'book_link_click')),
      CHECK ("sourceType" IN ('thread', 'comment', 'direct', 'ai_chat'))
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "SearchEvent" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      "searchType" TEXT NOT NULL,
      query TEXT NOT NULL,
      "occurredAt" TIMESTAMPTZ NOT NULL,
      CHECK ("searchType" IN ('book_list', 'ai_query'))
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "BookEmbedding" (
      "bookId" TEXT PRIMARY KEY,
      embedding vector(3) NOT NULL
    )
  `);
  await client.query(`CREATE TEMP TABLE "TagList" (id TEXT PRIMARY KEY, tag TEXT NOT NULL)`);
  await client.query(`
    CREATE TEMP TABLE "TagSubterm" (
      id TEXT PRIMARY KEY,
      "tagId" TEXT NOT NULL,
      subterm TEXT NOT NULL
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "BookTag" (
      "bookId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      UNIQUE ("bookId", "tagId")
    )
  `);
}

describeWithDatabase("推薦候補ソースとpgvector・PGroongaの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedQuery.mockImplementation((text, params = []) => client.query(text, params));
    mockedCreateEmbedding.mockResolvedValue([1, 0, 0]);
    await withTempTableSetup(client, () => createTables(client));
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("行動した本を除外し、pgvector距離が近い別の本を候補にする", async () => {
    await client.query(`
      INSERT INTO "BookEmbedding" ("bookId", embedding) VALUES
        ('source', '[1,0,0]'),
        ('near', '[0.99,0.01,0]'),
        ('far', '[0,1,0]')
    `);
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "occurredAt")
      VALUES ('history', 'loan', 'user@example.com', 'source', 'direct',
              '2026-08-16T00:00:00Z')
    `);

    const candidates = await findCandidatesFromHistory("user@example.com");

    expect(candidates.map((candidate) => candidate.bookId)).toEqual(["near", "far"]);
    expect(candidates.every((candidate) => typeof candidate.distance === "number")).toBe(true);
    expect(candidates.some((candidate) => candidate.bookId === "source")).toBe(false);
  });

  it("最新5件の検索語だけEmbedding化し、各検索語につき近い本を最大5件返す", async () => {
    const histories = Array.from({ length: 6 }, (_, index) =>
      `('search-${index}', 'user@example.com', 'book_list', 'query-${index}',
        '2026-08-16T0${index}:00:00Z')`
    );
    await client.query(`
      INSERT INTO "SearchEvent"
        (id, "userEmail", "searchType", query, "occurredAt")
      VALUES ${histories.join(",")}
    `);
    const embeddings = Array.from({ length: 6 }, (_, index) =>
      `('book-${index}', '[${1 - index * 0.1},${index * 0.1},0]')`
    );
    await client.query(`
      INSERT INTO "BookEmbedding" ("bookId", embedding)
      VALUES ${embeddings.join(",")}
    `);

    const candidates = await findCandidatesFromSearchHistory("user@example.com");

    expect(mockedCreateEmbedding).toHaveBeenCalledTimes(5);
    expect(mockedCreateEmbedding).not.toHaveBeenCalledWith("query-0", "query");
    expect(new Set(candidates.map((candidate) => candidate.sourceQuery))).toEqual(
      new Set(["query-1", "query-2", "query-3", "query-4", "query-5"])
    );
    expect(candidates).toHaveLength(25);
    expect(candidates.every((candidate) => typeof candidate.distance === "number")).toBe(true);
  });

  it("タグ名と小要素の両方に一致しても同じ本を1候補にまとめる", async () => {
    await client.query(`INSERT INTO "TagList" (id, tag) VALUES ('tag-web', 'Web')`);
    await client.query(`
      INSERT INTO "TagSubterm" (id, "tagId", subterm)
      VALUES ('subterm-web', 'tag-web', 'フロントエンド')
    `);
    await client.query(`INSERT INTO "BookTag" ("bookId", "tagId") VALUES ('book-web', 'tag-web')`);
    await client.query(`
      INSERT INTO "SearchEvent"
        (id, "userEmail", "searchType", query, "occurredAt")
      VALUES ('search-web', 'user@example.com', 'book_list', 'Web フロントエンド',
              '2026-08-16T00:00:00Z')
    `);

    const candidates = await findTagCandidatesFromSearchHistory("user@example.com");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ tagId: "tag-web", bookId: "book-web" });
  });

  it("タグ検索候補は最新5件・対象ユーザー・対象検索種別だけを使う", async () => {
    await client.query(`INSERT INTO "TagList" (id, tag) VALUES ('tag-web', 'Web')`);
    await client.query(`INSERT INTO "BookTag" ("bookId", "tagId") VALUES ('book-web', 'tag-web')`);
    const recent = Array.from({ length: 5 }, (_, index) =>
      `('recent-${index}', 'user@example.com', 'book_list', 'Web ${index}',
        '2026-08-16T0${index + 1}:00:00Z')`
    );
    await client.query(`
      INSERT INTO "SearchEvent"
        (id, "userEmail", "searchType", query, "occurredAt") VALUES
        ('old', 'user@example.com', 'book_list', 'Web old', '2026-08-16T00:00:00Z'),
        ('other-user', 'other@example.com', 'book_list', 'Web other', '2026-08-16T07:00:00Z'),
        ('blank', 'user@example.com', 'book_list', '   ', '2026-08-16T09:00:00Z'),
        ${recent.join(",")}
    `);

    const candidates = await findTagCandidatesFromSearchHistory("user@example.com");

    expect(candidates).toHaveLength(5);
    expect(candidates.some((candidate) => candidate.sourceQuery.includes("old"))).toBe(false);
    expect(candidates.every((candidate) => candidate.bookId === "book-web")).toBe(true);
  });
});
