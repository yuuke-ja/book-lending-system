import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/events/dashboard/route";
import { Admin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
  },
}));

type ResearchEventType =
  | "post_view"
  | "book_detail_view"
  | "loan"
  | "book_link_click";
type ResearchSourceType = "thread" | "comment" | "direct";

type ResearchEventInput = {
  id: string;
  eventType: ResearchEventType;
  at: string;
  userEmail?: string;
  bookId?: string;
  sourceType?: ResearchSourceType;
  sourceId?: string | null;
};

type DashboardResponse = {
  summary: {
    postViewCount: number;
    bookDetailViewCount: number;
    loanCount: number;
    uniqueUserCount: number;
  };
  paths: {
    postToBookDetailCount: number;
    postToLoanCount: number;
    threadLinkToBookDetailCount: number;
    bookDetailToLoanCount: number;
    avgPostToBookDetailSeconds: number | null;
    avgBookDetailToLoanSeconds: number | null;
  };
  ranking: {
    bookId: string;
    title: string;
    viewCount: number;
  }[];
  recentLogs: {
    id: string;
    eventType: string;
  }[];
};

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const envFile = readFileSync(".env.local", "utf8");
    const databaseUrlLine = envFile
      .split(/\r?\n/)
      .find((line) => line.startsWith("DATABASE_URL="));

    if (!databaseUrlLine) return undefined;

    return databaseUrlLine
      .slice("DATABASE_URL=".length)
      .trim()
      .replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

function timestamp(time: string) {
  return `2026-04-30 ${time}`;
}

function defaultSourceType(eventType: ResearchEventType): ResearchSourceType {
  if (eventType === "post_view" || eventType === "book_link_click") {
    return "thread";
  }
  return "direct";
}

async function insertBook(client: Client, id: string, title: string) {
  await client.query(
    `INSERT INTO "Book" (id, title)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
    [id, title]
  );
}

async function insertEvent(client: Client, event: ResearchEventInput) {
  await client.query(
    `INSERT INTO "ResearchEvent"
       (id, "eventType", "userEmail", "bookId", "sourceType", "sourceId", "occurredAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp)`,
    [
      event.id,
      event.eventType,
      event.userEmail ?? "user-a@example.com",
      event.bookId ?? "book-a",
      event.sourceType ?? defaultSourceType(event.eventType),
      event.sourceId ?? null,
      timestamp(event.at),
    ]
  );
}

async function seedEvents(client: Client, events: ResearchEventInput[]) {
  await insertBook(client, "book-a", "Book A");
  await insertBook(client, "book-b", "Book B");

  for (const event of events) {
    await insertEvent(client, event);
  }
}

async function fetchDashboard(
  impactTime = {
    postToBookDetail: "60minutes",
    postToLoan: "60minutes",
    threadLinkToBookDetail: "60minutes",
    bookDetailToLoan: "60minutes",
  }
): Promise<DashboardResponse> {
  const response = await GET(
    new Request(
      `http://localhost/api/admin/events/dashboard` +
        `?postToBookDetailImpactTime=${impactTime.postToBookDetail}` +
        `&postToLoanImpactTime=${impactTime.postToLoan}` +
        `&threadLinkToBookDetailImpactTime=${impactTime.threadLinkToBookDetail}` +
        `&bookDetailToLoanImpactTime=${impactTime.bookDetailToLoan}`
    )
  );

  expect(response.status).toBe(200);
  return response.json();
}

const databaseUrl = readDatabaseUrl();
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("GET /api/admin/events/dashboard event path patterns", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`SET TIME ZONE 'Asia/Tokyo'`);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockImplementation((text: string, params: unknown[] = []) =>
      client.query(text, params)
    );

    await client.query(
      `CREATE TEMP TABLE IF NOT EXISTS "Book" (
         id TEXT PRIMARY KEY,
         title TEXT
       )`
    );
    await client.query(
      `CREATE TEMP TABLE IF NOT EXISTS "ResearchEvent" (
         id TEXT PRIMARY KEY,
         "eventType" TEXT NOT NULL,
         "userEmail" TEXT NOT NULL,
         "bookId" TEXT NOT NULL,
         "sourceType" TEXT NOT NULL,
         "sourceId" TEXT,
         "occurredAt" TIMESTAMP(3) NOT NULL
       )`
    );
    await client.query(`TRUNCATE TABLE "ResearchEvent", "Book"`);
  });

  afterAll(async () => {
    await client.end();
  });

  const pathScenarios: {
    name: string;
    events: ResearchEventInput[];
    expected: {
      postToBookDetailCount: number;
      postToLoanCount: number;
      threadLinkToBookDetailCount: number;
      bookDetailToLoanCount: number;
      avgPostToBookDetailSeconds?: number;
      avgBookDetailToLoanSeconds?: number;
    };
  }[] = [
    {
      name: "投稿を見る -> 借りる: 投稿経由貸出だけを数える",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "本詳細を見る -> 借りる: 本詳細経由貸出だけを数える",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "投稿を見る -> 本詳細を見る -> 借りる: 投稿詳細と両方の貸出経路を数える",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "10:01:00" },
        { id: "loan-1", eventType: "loan", at: "10:02:00" },
      ],
      expected: {
        postToBookDetailCount: 1,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgPostToBookDetailSeconds: 60,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "投稿を見る -> 借りる -> 本詳細を見る -> 借りる: 2回目は投稿経由貸出に入れない",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "10:10:00" },
        { id: "loan-2", eventType: "loan", at: "10:11:00" },
      ],
      expected: {
        postToBookDetailCount: 1,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgPostToBookDetailSeconds: 600,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "本詳細を見る -> 借りる -> 投稿を見る -> 借りる: 2回目は本詳細経由貸出に入れない",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
        { id: "post-1", eventType: "post_view", at: "10:10:00" },
        { id: "loan-2", eventType: "loan", at: "10:11:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "本詳細を複数回見る -> 借りる: 借りる直前の本詳細だけを貸出に使う",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "detail-2", eventType: "book_detail_view", at: "10:02:00" },
        { id: "loan-1", eventType: "loan", at: "10:03:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "投稿を複数回見る -> 本詳細を見る -> 借りる: 直近の投稿を本詳細に使う",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "post-2", eventType: "post_view", at: "10:02:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "10:03:00" },
        { id: "loan-1", eventType: "loan", at: "10:04:00" },
      ],
      expected: {
        postToBookDetailCount: 1,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgPostToBookDetailSeconds: 60,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "投稿を見る -> 同じ本詳細を4回見る: 投稿経由本詳細を4件として数える",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "10:01:00" },
        { id: "detail-2", eventType: "book_detail_view", at: "10:02:00" },
        { id: "detail-3", eventType: "book_detail_view", at: "10:03:00" },
        { id: "detail-4", eventType: "book_detail_view", at: "10:04:00" },
      ],
      expected: {
        postToBookDetailCount: 4,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
        avgPostToBookDetailSeconds: 150,
      },
    },
    {
      name: "60分外の投稿 -> 本詳細を見る: 影響時間外なので投稿経由本詳細に入れない",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "11:01:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "60分外と60分内の投稿がある -> 本詳細を見る: 60分内の投稿だけを使う",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "post-2", eventType: "post_view", at: "11:00:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "11:02:00" },
      ],
      expected: {
        postToBookDetailCount: 1,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
        avgPostToBookDetailSeconds: 120,
      },
    },
    {
      name: "投稿内リンクはthread/commentを数える",
      events: [
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "thread",
        },
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:05" },
        {
          id: "link-2",
          eventType: "book_link_click",
          at: "10:01:00",
          sourceType: "comment",
        },
        { id: "detail-2", eventType: "book_detail_view", at: "10:01:05" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 2,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "投稿内リンクで本詳細へ行ったあと本一覧から同じ本詳細を見る: リンククリックは1件だけ数える",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "09:59:55",
        },
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "thread",
        },
        {
          id: "detail-from-link",
          eventType: "book_detail_view",
          at: "10:00:05",
        },
        {
          id: "detail-from-list",
          eventType: "book_detail_view",
          at: "10:10:00",
        },
      ],
      expected: {
        postToBookDetailCount: 2,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 1,
        bookDetailToLoanCount: 0,
        avgPostToBookDetailSeconds: 307.5,
      },
    },
    {
      name: "投稿内リンクで本詳細へ行ってから借りる: リンククリックと本詳細経由貸出を数える",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "09:59:55",
        },
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "thread",
        },
        {
          id: "detail-from-link",
          eventType: "book_detail_view",
          at: "10:00:05",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:01:00",
        },
      ],
      expected: {
        postToBookDetailCount: 1,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 1,
        bookDetailToLoanCount: 1,
        avgPostToBookDetailSeconds: 10,
        avgBookDetailToLoanSeconds: 55,
      },
    },
    {
      name: "投稿を見る -> 60分ちょうどに本詳細を見る: 影響時間の境界を含める",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "detail-1", eventType: "book_detail_view", at: "11:00:00" },
      ],
      expected: {
        postToBookDetailCount: 1,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
        avgPostToBookDetailSeconds: 3600,
      },
    },
    {
      name: "投稿を見る -> 60分ちょうどに借りる: 影響時間の境界を含める",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "11:00:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "本詳細を見る -> 60分ちょうどに借りる: 影響時間の境界を含める",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "11:00:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 3600,
      },
    },
    {
      name: "投稿を見る -> 61分後に借りる: 影響時間外なので投稿経由貸出に入れない",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "11:01:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "本詳細を見る -> 61分後に借りる: 影響時間外なので本詳細経由貸出に入れない",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "11:01:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "投稿を見る -> 借りる -> 借りる: 2回目は同じ投稿経由貸出に入れない",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
        { id: "loan-2", eventType: "loan", at: "10:02:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "投稿を見る -> 借りる -> 投稿を見る -> 借りる: 新しい投稿で2回目も投稿経由貸出に入れる",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
        { id: "post-2", eventType: "post_view", at: "10:10:00" },
        { id: "loan-2", eventType: "loan", at: "10:11:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 2,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "本詳細を見る -> 借りる -> 本詳細を見る -> 借りる: 新しい本詳細で2回とも本詳細経由貸出に入れる",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
        { id: "detail-2", eventType: "book_detail_view", at: "10:10:00" },
        { id: "loan-2", eventType: "loan", at: "10:11:00" },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 2,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "別ユーザーの貸出が間にあっても自分の投稿経由貸出は切れない",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "10:00:00",
          userEmail: "user-a@example.com",
        },
        {
          id: "loan-other-user",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "user-b@example.com",
        },
        {
          id: "loan-user-a",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "user-a@example.com",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "別の本の貸出が間にあっても同じ本の投稿経由貸出は切れない",
      events: [
        {
          id: "post-book-a",
          eventType: "post_view",
          at: "10:00:00",
          bookId: "book-a",
        },
        {
          id: "loan-book-b",
          eventType: "loan",
          at: "10:01:00",
          bookId: "book-b",
        },
        {
          id: "loan-book-a",
          eventType: "loan",
          at: "10:02:00",
          bookId: "book-a",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 1,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "別ユーザーの貸出が間にあっても自分の本詳細経由貸出は切れない",
      events: [
        {
          id: "detail-1",
          eventType: "book_detail_view",
          at: "10:00:00",
          userEmail: "user-a@example.com",
        },
        {
          id: "loan-other-user",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "user-b@example.com",
        },
        {
          id: "loan-user-a",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "user-a@example.com",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 120,
      },
    },
    {
      name: "別の本の貸出が間にあっても同じ本の本詳細経由貸出は切れない",
      events: [
        {
          id: "detail-book-a",
          eventType: "book_detail_view",
          at: "10:00:00",
          bookId: "book-a",
        },
        {
          id: "loan-book-b",
          eventType: "loan",
          at: "10:01:00",
          bookId: "book-b",
        },
        {
          id: "loan-book-a",
          eventType: "loan",
          at: "10:02:00",
          bookId: "book-a",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 120,
      },
    },
    {
      name: "別ユーザーの投稿と本詳細は混ぜない",
      events: [
        {
          id: "post-user-a",
          eventType: "post_view",
          at: "10:00:00",
          userEmail: "user-a@example.com",
        },
        {
          id: "detail-user-b",
          eventType: "book_detail_view",
          at: "10:01:00",
          userEmail: "user-b@example.com",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "別の本の投稿と本詳細は混ぜない",
      events: [
        {
          id: "post-book-a",
          eventType: "post_view",
          at: "10:00:00",
          bookId: "book-a",
        },
        {
          id: "detail-book-b",
          eventType: "book_detail_view",
          at: "10:01:00",
          bookId: "book-b",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "別ユーザーの投稿と貸出は混ぜない",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "10:00:00",
          userEmail: "user-a@example.com",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "user-b@example.com",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
    {
      name: "別の本の投稿と貸出は混ぜない",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "10:00:00",
          bookId: "book-a",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:01:00",
          bookId: "book-b",
        },
      ],
      expected: {
        postToBookDetailCount: 0,
        postToLoanCount: 0,
        threadLinkToBookDetailCount: 0,
        bookDetailToLoanCount: 0,
      },
    },
  ];

  for (const scenario of pathScenarios) {
    it(scenario.name, async () => {
      await seedEvents(client, scenario.events);

      const data = await fetchDashboard();

      expect(data.paths.postToBookDetailCount).toBe(
        scenario.expected.postToBookDetailCount
      );
      expect(data.paths.postToLoanCount).toBe(
        scenario.expected.postToLoanCount
      );
      expect(data.paths.threadLinkToBookDetailCount).toBe(
        scenario.expected.threadLinkToBookDetailCount
      );
      expect(data.paths.bookDetailToLoanCount).toBe(
        scenario.expected.bookDetailToLoanCount
      );

      if (scenario.expected.avgPostToBookDetailSeconds !== undefined) {
        expect(data.paths.avgPostToBookDetailSeconds).toBeCloseTo(
          scenario.expected.avgPostToBookDetailSeconds
        );
      }

      if (scenario.expected.avgBookDetailToLoanSeconds !== undefined) {
        expect(data.paths.avgBookDetailToLoanSeconds).toBeCloseTo(
          scenario.expected.avgBookDetailToLoanSeconds
        );
      }
    });
  }

  it("経路ごとの影響時間を別々に適用する", async () => {
    await seedEvents(client, [
      { id: "post-detail-ok", eventType: "post_view", at: "10:00:00" },
      { id: "detail-ok", eventType: "book_detail_view", at: "10:09:00" },
      { id: "post-loan-ok", eventType: "post_view", at: "11:00:00" },
      { id: "loan-ok", eventType: "loan", at: "11:59:00" },
      {
        id: "link-ok",
        eventType: "book_link_click",
        at: "12:00:00",
        sourceType: "thread",
      },
      { id: "detail-link-ok", eventType: "book_detail_view", at: "12:00:05" },
      { id: "detail-loan-ok", eventType: "book_detail_view", at: "13:00:00" },
      { id: "loan-detail-ok", eventType: "loan", at: "13:29:00" },
      { id: "post-detail-ng", eventType: "post_view", at: "14:00:00" },
      { id: "detail-ng", eventType: "book_detail_view", at: "14:11:00" },
      {
        id: "link-ng",
        eventType: "book_link_click",
        at: "15:00:00",
        sourceType: "thread",
      },
      { id: "detail-link-ng", eventType: "book_detail_view", at: "15:00:06" },
      { id: "detail-loan-ng", eventType: "book_detail_view", at: "16:00:00" },
      { id: "loan-detail-ng", eventType: "loan", at: "16:31:00" },
    ]);

    const data = await fetchDashboard({
      postToBookDetail: "10minutes",
      postToLoan: "1hours",
      threadLinkToBookDetail: "5seconds",
      bookDetailToLoan: "30minutes",
    });

    expect(data.paths.postToBookDetailCount).toBe(1);
    expect(data.paths.postToLoanCount).toBe(1);
    expect(data.paths.threadLinkToBookDetailCount).toBe(1);
    expect(data.paths.bookDetailToLoanCount).toBe(1);
  });

  it("サマリー、ランキング、最近のログも一時テーブルの内容だけで返す", async () => {
    await seedEvents(client, [
      { id: "post-a", eventType: "post_view", at: "10:00:00" },
      { id: "detail-a-1", eventType: "book_detail_view", at: "10:01:00" },
      { id: "detail-a-2", eventType: "book_detail_view", at: "10:02:00" },
      { id: "loan-a", eventType: "loan", at: "10:03:00" },
      {
        id: "detail-b-1",
        eventType: "book_detail_view",
        at: "10:04:00",
        bookId: "book-b",
        userEmail: "user-b@example.com",
      },
    ]);

    const data = await fetchDashboard();

    expect(data.summary).toEqual({
      postViewCount: 1,
      bookDetailViewCount: 3,
      loanCount: 1,
      uniqueUserCount: 2,
    });
    expect(data.ranking).toEqual([
      { bookId: "book-a", title: "Book A", viewCount: 2 },
      { bookId: "book-b", title: "Book B", viewCount: 1 },
    ]);
    expect(data.recentLogs.map((log) => log.id)).toEqual([
      "detail-b-1",
      "loan-a",
      "detail-a-2",
      "detail-a-1",
      "post-a",
    ]);
  });
});
