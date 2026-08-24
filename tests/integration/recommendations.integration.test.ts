import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { db } from "@/lib/db";
import { shouldRefreshRecommendations } from "@/lib/Recommended/should-refresh-recommendations";
import { getUserRecommendations } from "@/lib/Recommended/get-user-recommendations";
import { findTagCandidatesFromHistory } from "@/lib/Recommended/tag-candidates-from-history";
import {
  connectIntegrationClient,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedQuery = vi.mocked(db.query);

async function createRecommendationTables(client: Client) {
  await dropTempTables(client, [
    "UserRecommendation",
    "SearchEvent",
    "ResearchEvent",
    "BookTag",
    "Book",
  ]);
  await client.query(`
    CREATE TEMP TABLE "Book" (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT[] NOT NULL,
      isbn13 TEXT NOT NULL,
      thumbnail TEXT
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "BookTag" (
      "bookId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      UNIQUE ("bookId", "tagId")
    )
  `);
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
    CREATE TEMP TABLE "UserRecommendation" (
      id TEXT PRIMARY KEY,
      "userEmail" TEXT NOT NULL,
      "bookId" TEXT NOT NULL,
      rank INTEGER NOT NULL CHECK (rank > 0),
      "candidateCount" INTEGER NOT NULL DEFAULT 1 CHECK ("candidateCount" > 0),
      distance DOUBLE PRECISION NOT NULL CHECK (distance >= 0),
      "latestHistoryAt" TIMESTAMPTZ NOT NULL,
      "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("bookId") REFERENCES "Book"(id) ON DELETE CASCADE
    )
  `);
}

describeWithDatabase("推薦取得・更新判定とPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedQuery.mockImplementation((text, params = []) =>
      client.query(text, params)
    );
    await withTempTableSetup(client, async () => {
      await createRecommendationTables(client);
      await client.query(`
        INSERT INTO "Book" (id, title, authors, isbn13, thumbnail) VALUES
          ('source', '閲覧した本', ARRAY['著者A'], '9780000000001', NULL),
          ('same-tag', '同じジャンルの本', ARRAY['著者B'], '9780000000002', '/same.png'),
          ('other-tag', '別ジャンルの本', ARRAY['著者C'], '9780000000003', NULL)
      `);
      await client.query(`
        INSERT INTO "BookTag" ("bookId", "tagId") VALUES
          ('source', 'tag-1'),
          ('same-tag', 'tag-1'),
          ('other-tag', 'tag-2')
      `);
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("推薦が未生成なら更新が必要と判定する", async () => {
    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(true);
  });

  it("推薦より新しい行動・検索だけを更新対象にする", async () => {
    await client.query(`
      INSERT INTO "UserRecommendation"
        (id, "userEmail", "bookId", rank, distance, "latestHistoryAt", "generatedAt")
      VALUES ('r1', 'user@example.com', 'same-tag', 1, 0.1,
              '2026-08-16T00:00:00Z', '2026-08-16T01:00:00Z')
    `);
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "occurredAt")
      VALUES
        ('old', 'loan', 'user@example.com', 'source', 'direct', '2026-08-16T00:00:00Z'),
        ('other', 'loan', 'other@example.com', 'source', 'direct', '2026-08-17T00:00:00Z')
    `);
    await client.query(`
      INSERT INTO "SearchEvent" (id, "userEmail", "searchType", query, "occurredAt")
      VALUES ('same', 'user@example.com', 'book_list', '同時刻の検索', '2026-08-16T01:00:00Z')
    `);

    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(false);

    await client.query(`
      INSERT INTO "SearchEvent" (id, "userEmail", "searchType", query, "occurredAt")
      VALUES ('new', 'user@example.com', 'book_list', '新しい検索', '2026-08-16T01:00:00.001Z')
    `);
    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(true);
  });

  it("推薦より新しい行動履歴があれば検索履歴なしでも更新対象にする", async () => {
    await client.query(`
      INSERT INTO "UserRecommendation"
        (id, "userEmail", "bookId", rank, distance, "latestHistoryAt", "generatedAt")
      VALUES ('r1', 'user@example.com', 'same-tag', 1, 0.1,
              '2026-08-16T00:00:00Z', '2026-08-16T01:00:00Z')
    `);
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "occurredAt")
      VALUES ('new-action', 'book_detail_view', 'user@example.com', 'source', 'direct',
              '2026-08-16T01:00:00.001Z')
    `);

    await expect(
      shouldRefreshRecommendations("user@example.com")
    ).resolves.toBe(true);
  });

  it("指定ユーザーの推薦だけをrank順で最大8件取得する", async () => {
    const recommendationBooks = Array.from({ length: 9 }, (_, index) => {
      const rank = index + 1;
      return `('recommendation-book-${rank}', '推薦本${rank}', ARRAY['著者'],
               '9790000000${String(rank).padStart(3, "0")}', NULL)`;
    });
    await client.query(`
      INSERT INTO "Book" (id, title, authors, isbn13, thumbnail)
      VALUES ${recommendationBooks.join(",")}
    `);
    const values = Array.from({ length: 9 }, (_, index) => {
      const rank = 9 - index;
      return `('rec-${rank}', 'user@example.com', 'recommendation-book-${rank}', ${rank},
               0.${rank}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    });
    await client.query(`
      INSERT INTO "UserRecommendation"
        (id, "userEmail", "bookId", rank, distance, "latestHistoryAt", "generatedAt")
      VALUES ${values.join(",")},
        ('other-user', 'other@example.com', 'other-tag', 1, 0.1,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const recommendations = await getUserRecommendations("user@example.com");

    expect(recommendations).toHaveLength(8);
    expect(recommendations.map((item) => item.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(recommendations.map((item) => item.id)).toEqual([
      "recommendation-book-1",
      "recommendation-book-2",
      "recommendation-book-3",
      "recommendation-book-4",
      "recommendation-book-5",
      "recommendation-book-6",
      "recommendation-book-7",
      "recommendation-book-8",
    ]);
  });

  it("対象の行動履歴から同じジャンルの別の本だけを候補にする", async () => {
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "occurredAt")
      VALUES
        ('loan', 'loan', 'user@example.com', 'source', 'direct', '2026-08-16T03:00:00Z'),
        ('ignored-type', 'post_view', 'user@example.com', 'source', 'direct', '2026-08-16T04:00:00Z'),
        ('other-user', 'loan', 'other@example.com', 'source', 'direct', '2026-08-16T05:00:00Z')
    `);

    const candidates = await findTagCandidatesFromHistory("user@example.com");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      historyBookId: "source",
      bookId: "same-tag",
    });
  });

  it("貸出・詳細閲覧・書籍リンククリックの3種類をジャンル候補履歴に使う", async () => {
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "occurredAt")
      VALUES
        ('loan', 'loan', 'user@example.com', 'source', 'direct', '2026-08-16T01:00:00Z'),
        ('detail', 'book_detail_view', 'user@example.com', 'source', 'direct', '2026-08-16T02:00:00Z'),
        ('click', 'book_link_click', 'user@example.com', 'source', 'ai_chat', '2026-08-16T03:00:00Z')
    `);

    const candidates = await findTagCandidatesFromHistory("user@example.com");

    expect(candidates).toHaveLength(3);
    expect(candidates.every((candidate) => candidate.bookId === "same-tag")).toBe(true);
  });

  it("ジャンル候補に使う対象履歴を新しい10件までに制限する", async () => {
    await client.query(`
      INSERT INTO "Book" (id, title, authors, isbn13, thumbnail)
      VALUES ('tag-2-candidate', 'ジャンル2候補', ARRAY['著者D'], '9780000000004', NULL)
    `);
    await client.query(`
      INSERT INTO "BookTag" ("bookId", "tagId")
      VALUES ('tag-2-candidate', 'tag-2')
    `);
    const recentValues = Array.from({ length: 10 }, (_, index) =>
      `('recent-${index}', 'loan', 'user@example.com', 'source', 'direct',
        '2026-08-16T${String(index + 1).padStart(2, "0")}:00:00Z')`
    );
    await client.query(`
      INSERT INTO "ResearchEvent"
        (id, "eventType", "userEmail", "bookId", "sourceType", "occurredAt")
      VALUES
        ('old-eleventh', 'loan', 'user@example.com', 'other-tag', 'direct', '2026-08-15T23:00:00Z'),
        ${recentValues.join(",")}
    `);

    const candidates = await findTagCandidatesFromHistory("user@example.com");

    expect(candidates).toHaveLength(10);
    expect(candidates.some((candidate) => candidate.bookId === "tag-2-candidate")).toBe(false);
  });
});
