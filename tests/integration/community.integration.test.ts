import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary } from "@/lib/ai/aiSummary";
import { createThread } from "@/lib/action/thread";
import { createComment } from "@/lib/action/comment";
import { getThreadList } from "@/lib/community/get-thread-list";
import { getThreadDetail } from "@/lib/community/get-thread-detail";
import {
  connectIntegrationClient,
  createDatabaseAdapter,
  dropTempTables,
  getIntegrationDatabaseUrl,
  withTempTableSetup,
} from "./postgres-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/lib/ai/aiSummary", () => ({ summary: vi.fn() }));

const databaseUrl = getIntegrationDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const mockedAuth = vi.mocked(auth);
const mockedQuery = vi.mocked(db.query);
const mockedTransaction = vi.mocked(db.transaction);
const mockedSummary = vi.mocked(summary);

async function createCommunityTables(client: Client) {
  await dropTempTables(client, [
    "CommentBookLink",
    "ThreadComment",
    "Thread",
    "Book",
    "User",
  ]);
  await client.query(`
    CREATE TEMP TABLE "User" (
      email TEXT PRIMARY KEY,
      nickname TEXT,
      avatarurl TEXT
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "Book" (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      thumbnail TEXT
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "Thread" (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      kind TEXT NOT NULL,
      "bookId" TEXT,
      "userEmail" TEXT NOT NULL,
      content TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("bookId") REFERENCES "Book"(id) ON DELETE SET NULL
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "ThreadComment" (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      "threadId" TEXT NOT NULL,
      "parentCommentId" TEXT,
      "userEmail" TEXT NOT NULL,
      content TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("threadId") REFERENCES "Thread"(id) ON DELETE CASCADE,
      FOREIGN KEY ("parentCommentId") REFERENCES "ThreadComment"(id) ON DELETE CASCADE
    )
  `);
  await client.query(`
    CREATE TEMP TABLE "CommentBookLink" (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      "commentId" TEXT NOT NULL,
      "bookId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("commentId") REFERENCES "ThreadComment"(id) ON DELETE CASCADE,
      FOREIGN KEY ("bookId") REFERENCES "Book"(id) ON DELETE CASCADE
    )
  `);
}

describeWithDatabase("コミュニティAction・取得処理とPostgreSQLの結合", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectIntegrationClient(databaseUrl!);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({
      user: { email: "user@example.com" },
    } as never);
    mockedSummary.mockResolvedValue({} as never);
    const adapter = createDatabaseAdapter(client);
    mockedQuery.mockImplementation(adapter.query);
    mockedTransaction.mockImplementation(adapter.transaction);
    await withTempTableSetup(client, async () => {
      await createCommunityTables(client);
      await client.query(
        `INSERT INTO "User" (email, nickname, avatarurl)
         VALUES ('user@example.com', '利用者', '/avatar.png')`
      );
      await client.query(
        `INSERT INTO "Book" (id, title, thumbnail) VALUES
           ('book-1', '結合テスト入門', '/book-1.png'),
           ('book-2', 'PostgreSQL実践', NULL)`
      );
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it("本付き投稿を保存し、一覧で利用者とlinkedBookを取得する", async () => {
    await expect(
      createThread({
        kind: "BOOK_TOPIC",
        bookId: "book-1",
        content: "  この本の感想です  ",
      })
    ).resolves.toMatchObject({ ok: true, status: 200 });

    const threads = await getThreadList();

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      content: "この本の感想です",
      kind: "BOOK_TOPIC",
      nickname: "利用者",
      authorAvatarUrl: "/avatar.png",
      linkedBook: {
        id: "book-1",
        title: "結合テスト入門",
        thumbnail: "/book-1.png",
      },
    });
  });

  it("本なし投稿を保存し、bookId絞り込みから除外する", async () => {
    await createThread({
      kind: "BOOK_REQUEST",
      bookId: null,
      content: "おすすめを探しています",
    });
    await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-1",
      content: "本付き投稿",
    });

    const all = await getThreadList();
    const bookOnly = await getThreadList("book-1");

    expect(all).toHaveLength(2);
    expect(all.find((thread) => thread.bookId === null)?.linkedBook).toBeNull();
    expect(bookOnly).toHaveLength(1);
    expect(bookOnly[0].bookId).toBe("book-1");
  });

  it("返信と複数書籍リンクをtransaction保存し、詳細でまとめて取得する", async () => {
    await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-1",
      content: "親投稿",
    });
    const thread = await client.query<{ id: string }>(
      `SELECT id FROM "Thread" LIMIT 1`
    );
    await createComment({
      threadId: thread.rows[0].id,
      parentCommentId: null,
      content: "親コメント",
      bookIds: ["book-1"],
    });
    const parent = await client.query<{ id: string }>(
      `SELECT id FROM "ThreadComment" WHERE "parentCommentId" IS NULL`
    );
    await createComment({
      threadId: thread.rows[0].id,
      parentCommentId: parent.rows[0].id,
      content: "返信コメント",
      bookIds: ["book-1", "book-2", "book-2"],
    });

    const detail = await getThreadDetail(thread.rows[0].id);

    expect(detail?.thread.linkedBook).toMatchObject({ id: "book-1" });
    expect(detail?.comments).toHaveLength(2);
    const reply = detail?.comments.find(
      (comment) => comment.parentCommentId === parent.rows[0].id
    );
    expect(reply?.linkedBooks.map((book) => book.id).sort()).toEqual([
      "book-1",
      "book-2",
    ]);
  });

  it("書籍リンク保存が失敗したら先に作ったコメントもrollbackする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-1",
      content: "投稿",
    });
    const thread = await client.query<{ id: string }>(
      `SELECT id FROM "Thread" LIMIT 1`
    );
    await withTempTableSetup(client, () =>
      client.query(`
        ALTER TABLE pg_temp."CommentBookLink"
        ADD CONSTRAINT "reject_book_link_fixture"
        CHECK ("bookId" <> 'book-1')
      `)
    );

    await expect(
      createComment({
        threadId: thread.rows[0].id,
        parentCommentId: null,
        content: "rollback対象",
        bookIds: ["book-1"],
      })
    ).resolves.toMatchObject({ ok: false, status: 500 });
    const comments = await client.query(
      `SELECT id FROM "ThreadComment" WHERE content = 'rollback対象'`
    );
    expect(comments.rows).toHaveLength(0);
  });

  it("存在しない本を含むコメントは保存せず404を返す", async () => {
    await createThread({
      kind: "BOOK_REQUEST",
      bookId: null,
      content: "投稿",
    });
    const thread = await client.query<{ id: string }>(
      `SELECT id FROM "Thread" LIMIT 1`
    );

    await expect(
      createComment({
        threadId: thread.rows[0].id,
        parentCommentId: null,
        content: "保存されないコメント",
        bookIds: ["missing-book"],
      })
    ).resolves.toMatchObject({ ok: false, status: 404 });
    const count = await client.query(
      `SELECT COUNT(*)::int AS count FROM "ThreadComment"`
    );
    expect(count.rows[0].count).toBe(0);
  });

  it("存在しないスレッド詳細はnullを返す", async () => {
    await expect(getThreadDetail("missing-thread")).resolves.toBeNull();
  });

  it("別スレッドのコメントを親に指定すると400で保存しない", async () => {
    await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-1",
      content: "1つ目",
    });
    await createThread({
      kind: "BOOK_TOPIC",
      bookId: "book-2",
      content: "2つ目",
    });
    const threads = await client.query<{ id: string; content: string }>(
      `SELECT id, content FROM "Thread" ORDER BY content`
    );
    const firstThreadId = threads.rows.find((row) => row.content === "1つ目")!.id;
    const secondThreadId = threads.rows.find((row) => row.content === "2つ目")!.id;
    await createComment({
      threadId: firstThreadId,
      parentCommentId: null,
      content: "親コメント",
      bookIds: [],
    });
    const parent = await client.query<{ id: string }>(
      `SELECT id FROM "ThreadComment" LIMIT 1`
    );

    await expect(
      createComment({
        threadId: secondThreadId,
        parentCommentId: parent.rows[0].id,
        content: "不正な返信",
        bookIds: [],
      })
    ).resolves.toMatchObject({ ok: false, status: 400 });
    const invalid = await client.query(
      `SELECT id FROM "ThreadComment" WHERE content = '不正な返信'`
    );
    expect(invalid.rows).toEqual([]);
  });

  it("スレッドは新しい順、コメントは古い順で返す", async () => {
    await client.query(`
      INSERT INTO "Thread" (id, kind, "bookId", "userEmail", content, "createdAt") VALUES
        ('old-thread', 'BOOK_TOPIC', 'book-1', 'user@example.com', '古い投稿', '2026-08-16T01:00:00Z'),
        ('new-thread', 'BOOK_TOPIC', 'book-2', 'user@example.com', '新しい投稿', '2026-08-16T02:00:00Z')
    `);
    await client.query(`
      INSERT INTO "ThreadComment"
        (id, "threadId", "parentCommentId", "userEmail", content, "createdAt") VALUES
        ('new-comment', 'old-thread', NULL, 'user@example.com', '新しいコメント', '2026-08-16T03:00:00Z'),
        ('old-comment', 'old-thread', NULL, 'user@example.com', '古いコメント', '2026-08-16T02:00:00Z')
    `);

    const list = await getThreadList();
    const detail = await getThreadDetail("old-thread");

    expect(list.map((thread) => thread.id)).toEqual(["new-thread", "old-thread"]);
    expect(detail?.comments.map((comment) => comment.id)).toEqual([
      "old-comment",
      "new-comment",
    ]);
  });

  it("コメント0件の詳細は空配列を返す", async () => {
    await client.query(`
      INSERT INTO "Thread" (id, kind, "bookId", "userEmail", content)
      VALUES ('no-comments', 'BOOK_REQUEST', NULL, 'user@example.com', 'コメントなし')
    `);

    const detail = await getThreadDetail("no-comments");

    expect(detail?.comments).toEqual([]);
  });
});
