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
type ResearchSourceType = "thread" | "comment" | "direct" | "ai_chat";

type ResearchEventInput = {
  id: string;
  eventType: ResearchEventType;
  at: string;
  userEmail?: string;
  bookId?: string;
  sourceType?: ResearchSourceType;
  sourceId?: string | null;
};

type AiRecommendationInput = {
  id: string;
  at: string;
  userEmail?: string;
  bookId?: string;
  query?: string;
  reason?: string;
  rank?: number;
};

type ImpactTimes = {
  postToLoan: string;
  bookDetailToLoan: string;
  threadLinkClickToLoan: string;
  aiRecommendationDisplayToLoan: string;
  aiRecommendationToLoan: string;
};

type DashboardResponse = {
  summary: {
    postViewCount: number;
    bookDetailViewCount: number;
    loanCount: number;
    uniqueUserCount: number;
  };
  paths: {
    postToLoanCount: number;
    threadLinkClickCount: number;
    threadLinkClickToLoanCount: number;
    threadLinkClickToLoanRate: number;
    bookDetailToLoanCount: number;
    avgBookDetailToLoanSeconds: number | null;
    aiRecommendationCount: number;
    aiRecommendationToLoanCount: number;
    aiRecommendationToLoanRate: number;
    aiRecommendationDisplayToLoanCount: number;
    aiRecommendationDisplayToLoanRate: number;
    aiClickCount: number;
    aiClickRate: number;
  };
  ranking: {
    bookId: string | null;
    title: string | null;
    viewCount: number;
  }[];
  recentLogs: {
    id: string;
    eventType: string;
    bookTitle: string | null;
  }[];
};

type PathExpected = Partial<DashboardResponse["paths"]>;

type PathScenario = {
  name: string;
  events?: ResearchEventInput[];
  aiRecommendations?: AiRecommendationInput[];
  impactTime?: Partial<ImpactTimes>;
  expected: PathExpected;
};

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;

const defaultImpactTime: ImpactTimes = {
  postToLoan: "60minutes",
  bookDetailToLoan: "60minutes",
  threadLinkClickToLoan: "60minutes",
  aiRecommendationDisplayToLoan: "60minutes",
  aiRecommendationToLoan: "60minutes",
};

const emptyPaths: DashboardResponse["paths"] = {
  postToLoanCount: 0,
  threadLinkClickCount: 0,
  threadLinkClickToLoanCount: 0,
  threadLinkClickToLoanRate: 0,
  bookDetailToLoanCount: 0,
  avgBookDetailToLoanSeconds: null,
  aiRecommendationCount: 0,
  aiRecommendationToLoanCount: 0,
  aiRecommendationToLoanRate: 0,
  aiRecommendationDisplayToLoanCount: 0,
  aiRecommendationDisplayToLoanRate: 0,
  aiClickCount: 0,
  aiClickRate: 0,
};

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

async function insertBook(client: Client, id: string) {
  await client.query(
    `INSERT INTO "Book" (id, title)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
    [id, `Book ${id}`]
  );
}

async function insertEvent(client: Client, event: ResearchEventInput) {
  const bookId = event.bookId ?? "book-a";
  await insertBook(client, bookId);

  await client.query(
    `INSERT INTO "ResearchEvent"
       (id, "eventType", "userEmail", "bookId", "sourceType", "sourceId", "occurredAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp)`,
    [
      event.id,
      event.eventType,
      event.userEmail ?? "user-a@example.com",
      bookId,
      event.sourceType ?? defaultSourceType(event.eventType),
      event.sourceId ?? null,
      timestamp(event.at),
    ]
  );
}

async function seedEvents(client: Client, events: ResearchEventInput[]) {
  for (const event of events) {
    await insertEvent(client, event);
  }
}

async function insertAiRecommendation(
  client: Client,
  recommendation: AiRecommendationInput
) {
  const bookId = recommendation.bookId ?? "book-a";
  await insertBook(client, bookId);

  await client.query(
    `INSERT INTO "AiRecommendation"
       (id, "bookId", "createdAt", "userEmail", "query", "reason", "rank")
     VALUES ($1, $2, $3::timestamp, $4, $5, $6, $7)`,
    [
      recommendation.id,
      bookId,
      timestamp(recommendation.at),
      recommendation.userEmail ?? "user-a@example.com",
      recommendation.query ?? "おすすめの本",
      recommendation.reason ?? "理由",
      recommendation.rank ?? 1,
    ]
  );
}

async function seedAiRecommendations(
  client: Client,
  recommendations: AiRecommendationInput[]
) {
  for (const recommendation of recommendations) {
    await insertAiRecommendation(client, recommendation);
  }
}

async function fetchDashboard(
  impactTime: Partial<ImpactTimes> = {}
): Promise<DashboardResponse> {
  const nextImpactTime = { ...defaultImpactTime, ...impactTime };
  const response = await GET(
    new Request(
      `http://localhost/api/admin/events/dashboard` +
        `?postToLoanImpactTime=${nextImpactTime.postToLoan}` +
        `&bookDetailToLoanImpactTime=${nextImpactTime.bookDetailToLoan}` +
        `&threadLinkClickToLoanImpactTime=${nextImpactTime.threadLinkClickToLoan}` +
        `&aiRecommendationDisplayToLoanImpactTime=${nextImpactTime.aiRecommendationDisplayToLoan}` +
        `&aiRecommendationToLoanImpactTime=${nextImpactTime.aiRecommendationToLoan}`
    )
  );

  expect(response.status).toBe(200);
  return response.json();
}

function expectPaths(data: DashboardResponse, expected: PathExpected) {
  const paths = { ...emptyPaths, ...expected };

  expect(data.paths.postToLoanCount).toBe(paths.postToLoanCount);
  expect(data.paths.threadLinkClickCount).toBe(paths.threadLinkClickCount);
  expect(data.paths.threadLinkClickToLoanCount).toBe(
    paths.threadLinkClickToLoanCount
  );
  expect(data.paths.threadLinkClickToLoanRate).toBeCloseTo(
    paths.threadLinkClickToLoanRate
  );
  expect(data.paths.bookDetailToLoanCount).toBe(paths.bookDetailToLoanCount);

  if (paths.avgBookDetailToLoanSeconds == null) {
    expect(data.paths.avgBookDetailToLoanSeconds).toBeNull();
  } else {
    expect(data.paths.avgBookDetailToLoanSeconds).toBeCloseTo(
      paths.avgBookDetailToLoanSeconds
    );
  }

  expect(data.paths.aiRecommendationCount).toBe(paths.aiRecommendationCount);
  expect(data.paths.aiRecommendationToLoanCount).toBe(
    paths.aiRecommendationToLoanCount
  );
  expect(data.paths.aiRecommendationToLoanRate).toBeCloseTo(
    paths.aiRecommendationToLoanRate
  );
  expect(data.paths.aiRecommendationDisplayToLoanCount).toBe(
    paths.aiRecommendationDisplayToLoanCount
  );
  expect(data.paths.aiRecommendationDisplayToLoanRate).toBeCloseTo(
    paths.aiRecommendationDisplayToLoanRate
  );
  expect(data.paths.aiClickCount).toBe(paths.aiClickCount);
  expect(data.paths.aiClickRate).toBeCloseTo(paths.aiClickRate);
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

    await client.query(`DROP TABLE IF EXISTS pg_temp."ResearchEvent"`);
    await client.query(`DROP TABLE IF EXISTS pg_temp."AiRecommendation"`);
    await client.query(`DROP TABLE IF EXISTS pg_temp."Book"`);
    await client.query(
      `CREATE TEMP TABLE "Book" (
         id TEXT PRIMARY KEY,
         title TEXT
       )`
    );
    await client.query(
      `CREATE TEMP TABLE "ResearchEvent" (
         id TEXT PRIMARY KEY,
         "eventType" TEXT NOT NULL,
         "userEmail" TEXT NOT NULL,
         "bookId" TEXT NOT NULL,
         "sourceType" TEXT NOT NULL,
         "sourceId" TEXT,
         "occurredAt" TIMESTAMP(3) NOT NULL
       )`
    );
    await client.query(
      `CREATE TEMP TABLE "AiRecommendation" (
         id TEXT PRIMARY KEY,
         "bookId" TEXT NOT NULL,
         "createdAt" TIMESTAMP(3) NOT NULL,
         "userEmail" TEXT NOT NULL,
         "query" TEXT NOT NULL,
         "reason" TEXT NOT NULL,
         "rank" INTEGER NOT NULL
       )`
    );
  });

  afterAll(async () => {
    await client.end();
  });

  const pathScenarios: PathScenario[] = [
    {
      name: "投稿を見る -> 借りる: 投稿経由貸出を1件として数える",
      events: [
        { id: "post-1", eventType: "post_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        postToLoanCount: 1,
      },
    },
    {
      name: "本詳細を見る -> 借りる: 本詳細経由貸出を1件として数える",
      events: [
        { id: "detail-1", eventType: "book_detail_view", at: "10:00:00" },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 60,
      },
    },
    {
      name: "投稿内リンクを押す: 投稿内リンククリックを1件として数える",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "09:59:00",
        },
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "thread",
        },
      ],
      expected: {
        threadLinkClickCount: 1,
      },
    },
    {
      name: "投稿内リンクを押す -> 借りる: 投稿内リンククリック後貸出を1件として数える",
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "09:59:00",
        },
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "thread",
        },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        postToLoanCount: 1,
        threadLinkClickCount: 1,
        threadLinkClickToLoanCount: 1,
        threadLinkClickToLoanRate: 1,
      },
    },
    {
      name: "コメント内リンクを押す -> 借りる: コメント内リンクも貸出経路に含める",
      events: [
        {
          id: "comment-view-1",
          eventType: "post_view",
          at: "09:59:00",
          sourceType: "comment",
        },
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "comment",
        },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        postToLoanCount: 1,
        threadLinkClickCount: 1,
        threadLinkClickToLoanCount: 1,
        threadLinkClickToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめが表示される: AIおすすめ表示を1件として数える",
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
        },
      ],
      expected: {
        aiRecommendationCount: 1,
      },
    },
    {
      name: "AIおすすめが表示される -> 借りる: AIおすすめ表示後貸出を1件として数える",
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
        },
      ],
      events: [
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {
        aiRecommendationCount: 1,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめが表示される -> AIリンクを押す -> 借りる: 表示後貸出とクリック後貸出を数える",
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
        },
      ],
      events: [
        {
          id: "ai-link-1",
          eventType: "book_link_click",
          at: "10:01:00",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        { id: "loan-1", eventType: "loan", at: "10:02:00" },
      ],
      expected: {
        aiRecommendationCount: 1,
        aiClickCount: 1,
        aiClickRate: 1,
        aiRecommendationToLoanCount: 1,
        aiRecommendationToLoanRate: 1,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめクリック率: クリック回数ではなくクリックされたおすすめ数で割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
        {
          id: "recommendation-2",
          at: "10:00:10",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          query: "webにおすすめの本",
          reason: "book-b reason",
          rank: 2,
        },
        {
          id: "recommendation-3",
          at: "10:00:20",
          userEmail: "ai-user@example.com",
          bookId: "book-c",
          query: "webにおすすめの本",
          reason: "book-c reason",
          rank: 3,
        },
      ],
      events: [
        {
          id: "ai-click-1",
          eventType: "book_link_click",
          at: "10:01:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "ai-click-2",
          eventType: "book_link_click",
          at: "10:01:10",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "ai-click-3",
          eventType: "book_link_click",
          at: "10:01:20",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "ai-click-4",
          eventType: "book_link_click",
          at: "10:02:00",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          sourceType: "ai_chat",
          sourceId: "recommendation-2",
        },
        {
          id: "ai-click-5",
          eventType: "book_link_click",
          at: "10:02:10",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          sourceType: "ai_chat",
          sourceId: "recommendation-2",
        },
      ],
      expected: {
        aiRecommendationCount: 3,
        aiClickCount: 5,
        aiClickRate: 2 / 3,
      },
    },
    {
      name: "AIおすすめクリック率: 存在しないsourceIdとAI以外のクリックはクリック済みおすすめ数に入れない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
        {
          id: "recommendation-2",
          at: "10:00:10",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          query: "webにおすすめの本",
          reason: "book-b reason",
          rank: 2,
        },
      ],
      events: [
        {
          id: "valid-ai-click",
          eventType: "book_link_click",
          at: "10:01:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "invalid-ai-click",
          eventType: "book_link_click",
          at: "10:01:10",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          sourceType: "ai_chat",
          sourceId: "missing-recommendation",
        },
        {
          id: "thread-click",
          eventType: "book_link_click",
          at: "10:01:20",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          sourceType: "thread",
          sourceId: "thread-1",
        },
      ],
      expected: {
        threadLinkClickCount: 1,
        aiRecommendationCount: 2,
        aiClickCount: 2,
        aiClickRate: 1 / 2,
      },
    },
    {
      name: "AIおすすめクリック後貸出率: 連続クリックは1まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
      ],
      events: [
        {
          id: "ai-click-1",
          eventType: "book_link_click",
          at: "10:01:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "ai-click-2",
          eventType: "book_link_click",
          at: "10:01:10",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "ai-click-3",
          eventType: "book_link_click",
          at: "10:01:20",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:10:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 1,
        aiClickCount: 3,
        aiClickRate: 1,
        aiRecommendationToLoanCount: 1,
        aiRecommendationToLoanRate: 1,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめクリック後貸出率: 貸出が影響時間外なら貸出数にも率にも入れない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "5minutes",
      },
      events: [
        {
          id: "ai-click-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:06:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiClickCount: 1,
        aiRecommendationToLoanCount: 0,
        aiRecommendationToLoanRate: 0,
      },
    },
    {
      name: "AIおすすめクリック後貸出率: 前回クリックから影響時間を超えたら別まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "5minutes",
      },
      events: [
        {
          id: "ai-click-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "ai-click-2",
          eventType: "book_link_click",
          at: "10:06:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:07:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiClickCount: 2,
        aiRecommendationToLoanCount: 1,
        aiRecommendationToLoanRate: 1 / 2,
      },
    },
    {
      name: "AIおすすめクリック後貸出率: 貸出後の同じ本の再クリックは別まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "5minutes",
      },
      events: [
        {
          id: "ai-click-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
        {
          id: "ai-click-2",
          eventType: "book_link_click",
          at: "10:02:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "loan-2",
          eventType: "loan",
          at: "10:03:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiClickCount: 2,
        aiRecommendationToLoanCount: 2,
        aiRecommendationToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめクリック後貸出率: 別ユーザーと別本の貸出は混ぜない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "5minutes",
      },
      events: [
        {
          id: "ai-click-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "recommendation-1",
        },
        {
          id: "wrong-user-loan",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "other-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
        {
          id: "wrong-book-loan",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiClickCount: 1,
        aiRecommendationToLoanCount: 0,
        aiRecommendationToLoanRate: 0,
      },
    },
    {
      name: "投稿内リンククリック後貸出率: 連続クリックは1まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      events: [
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "link-2",
          eventType: "book_link_click",
          at: "10:00:10",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:10:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        threadLinkClickCount: 2,
        threadLinkClickToLoanCount: 1,
        threadLinkClickToLoanRate: 1,
      },
    },
    {
      name: "投稿内リンククリック後貸出率: 貸出が影響時間外なら貸出数にも率にも入れない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "5minutes",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      events: [
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:06:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        threadLinkClickCount: 1,
        threadLinkClickToLoanCount: 0,
        threadLinkClickToLoanRate: 0,
      },
    },
    {
      name: "投稿内リンククリック後貸出率: 前回クリックから影響時間を超えたら別まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "5minutes",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      events: [
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "link-2",
          eventType: "book_link_click",
          at: "10:06:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:07:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        threadLinkClickCount: 2,
        threadLinkClickToLoanCount: 1,
        threadLinkClickToLoanRate: 1 / 2,
      },
    },
    {
      name: "投稿内リンククリック後貸出率: 貸出後の同じ本の再クリックは別まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "5minutes",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      events: [
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
        {
          id: "link-2",
          eventType: "book_link_click",
          at: "10:02:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "loan-2",
          eventType: "loan",
          at: "10:03:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        threadLinkClickCount: 2,
        threadLinkClickToLoanCount: 2,
        threadLinkClickToLoanRate: 1,
      },
    },
    {
      name: "投稿内リンククリック後貸出率: 別ユーザーと別本の貸出は混ぜない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "5minutes",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      events: [
        {
          id: "link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
          sourceId: "thread-1",
        },
        {
          id: "wrong-user-loan",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "other-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
        {
          id: "wrong-book-loan",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "thread-user@example.com",
          bookId: "book-b",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        threadLinkClickCount: 1,
        threadLinkClickToLoanCount: 0,
        threadLinkClickToLoanRate: 0,
      },
    },
    {
      name: "AIおすすめ表示後貸出率: 連続表示は貸出で区切ったまとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "7days",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
        {
          id: "recommendation-2",
          at: "10:01:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 2,
        },
        {
          id: "recommendation-3",
          at: "10:20:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 3,
        },
      ],
      events: [
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:10:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 3,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1 / 2,
      },
    },
    {
      name: "AIおすすめ表示後貸出率: 影響時間内の連続表示は1まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "5minutes",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
        {
          id: "recommendation-2",
          at: "10:01:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 2,
        },
      ],
      events: [
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 2,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめ表示後貸出率: 貸出が影響時間外なら貸出数にも率にも入れない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "5minutes",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
      ],
      events: [
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:06:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 1,
        aiRecommendationDisplayToLoanCount: 0,
        aiRecommendationDisplayToLoanRate: 0,
      },
    },
    {
      name: "AIおすすめ表示後貸出率: 前回表示から影響時間を超えたら別まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "5minutes",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
        {
          id: "recommendation-2",
          at: "10:06:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 2,
        },
      ],
      events: [
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:07:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 2,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1 / 2,
      },
    },
    {
      name: "AIおすすめ表示後貸出率: 貸出後の同じ本の再表示は別まとまりとして割る",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "5minutes",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
        {
          id: "recommendation-2",
          at: "10:03:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 2,
        },
      ],
      events: [
        {
          id: "loan-1",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
        {
          id: "loan-2",
          eventType: "loan",
          at: "10:04:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 2,
        aiRecommendationDisplayToLoanCount: 2,
        aiRecommendationDisplayToLoanRate: 1,
      },
    },
    {
      name: "AIおすすめ表示後貸出率: 別ユーザーと別本の貸出は混ぜない",
      impactTime: {
        postToLoan: "7days",
        bookDetailToLoan: "7days",
        threadLinkClickToLoan: "7days",
        aiRecommendationDisplayToLoan: "5minutes",
        aiRecommendationToLoan: "7days",
      },
      aiRecommendations: [
        {
          id: "recommendation-1",
          at: "10:00:00",
          userEmail: "ai-user@example.com",
          bookId: "book-a",
          query: "webにおすすめの本",
          reason: "book-a reason",
          rank: 1,
        },
      ],
      events: [
        {
          id: "wrong-user-loan",
          eventType: "loan",
          at: "10:01:00",
          userEmail: "other-user@example.com",
          bookId: "book-a",
          sourceType: "direct",
          sourceId: null,
        },
        {
          id: "wrong-book-loan",
          eventType: "loan",
          at: "10:02:00",
          userEmail: "ai-user@example.com",
          bookId: "book-b",
          sourceType: "direct",
          sourceId: null,
        },
      ],
      expected: {
        aiRecommendationCount: 1,
        aiRecommendationDisplayToLoanCount: 0,
        aiRecommendationDisplayToLoanRate: 0,
      },
    },
    {
      name: "directリンクを押す -> 借りる: 投稿内リンクにもAIリンクにも入れない",
      events: [
        {
          id: "direct-link-1",
          eventType: "book_link_click",
          at: "10:00:00",
          sourceType: "direct",
        },
        { id: "loan-1", eventType: "loan", at: "10:01:00" },
      ],
      expected: {},
    },
    {
      name: "同じ起点から2回借りる: 2回目の貸出は同じ経路に重複して入れない",
      aiRecommendations: [
        {
          id: "ai-display-1",
          at: "13:00:00",
          userEmail: "ai-display-user@example.com",
          bookId: "book-b",
        },
      ],
      events: [
        {
          id: "post-1",
          eventType: "post_view",
          at: "10:00:00",
          userEmail: "post-user@example.com",
          bookId: "book-a",
        },
        {
          id: "post-loan-1",
          eventType: "loan",
          at: "10:10:00",
          userEmail: "post-user@example.com",
          bookId: "book-a",
        },
        {
          id: "post-loan-2",
          eventType: "loan",
          at: "10:20:00",
          userEmail: "post-user@example.com",
          bookId: "book-a",
        },
        {
          id: "detail-1",
          eventType: "book_detail_view",
          at: "11:00:00",
          userEmail: "detail-user@example.com",
          bookId: "book-b",
        },
        {
          id: "detail-loan-1",
          eventType: "loan",
          at: "11:10:00",
          userEmail: "detail-user@example.com",
          bookId: "book-b",
        },
        {
          id: "detail-loan-2",
          eventType: "loan",
          at: "11:20:00",
          userEmail: "detail-user@example.com",
          bookId: "book-b",
        },
        {
          id: "thread-link-1",
          eventType: "book_link_click",
          at: "12:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
        },
        {
          id: "thread-post-1",
          eventType: "post_view",
          at: "11:59:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
        },
        {
          id: "thread-loan-1",
          eventType: "loan",
          at: "12:10:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
        },
        {
          id: "thread-loan-2",
          eventType: "loan",
          at: "12:20:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
        },
        {
          id: "ai-display-loan-1",
          eventType: "loan",
          at: "13:10:00",
          userEmail: "ai-display-user@example.com",
          bookId: "book-b",
        },
        {
          id: "ai-display-loan-2",
          eventType: "loan",
          at: "13:20:00",
          userEmail: "ai-display-user@example.com",
          bookId: "book-b",
        },
        {
          id: "ai-link-1",
          eventType: "book_link_click",
          at: "14:00:00",
          userEmail: "ai-click-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "ai-display-1",
        },
        {
          id: "ai-click-loan-1",
          eventType: "loan",
          at: "14:10:00",
          userEmail: "ai-click-user@example.com",
          bookId: "book-a",
        },
        {
          id: "ai-click-loan-2",
          eventType: "loan",
          at: "14:20:00",
          userEmail: "ai-click-user@example.com",
          bookId: "book-a",
        },
      ],
      expected: {
        postToLoanCount: 2,
        bookDetailToLoanCount: 1,
        avgBookDetailToLoanSeconds: 600,
        threadLinkClickCount: 1,
        threadLinkClickToLoanCount: 1,
        threadLinkClickToLoanRate: 1,
        aiRecommendationCount: 1,
        aiRecommendationDisplayToLoanCount: 1,
        aiRecommendationDisplayToLoanRate: 1,
        aiClickCount: 1,
        aiClickRate: 1,
        aiRecommendationToLoanCount: 1,
        aiRecommendationToLoanRate: 1,
      },
    },
    {
      name: "別ユーザー・別本・影響時間外: 貸出経路に入れない",
      aiRecommendations: [
        {
          id: "ai-display-outside-window",
          at: "15:00:00",
          userEmail: "ai-display-user@example.com",
          bookId: "book-a",
        },
      ],
      events: [
        {
          id: "post-wrong-user",
          eventType: "post_view",
          at: "10:00:00",
          userEmail: "post-user@example.com",
          bookId: "book-a",
        },
        {
          id: "post-wrong-user-loan",
          eventType: "loan",
          at: "10:10:00",
          userEmail: "other-user@example.com",
          bookId: "book-a",
        },
        {
          id: "detail-wrong-book",
          eventType: "book_detail_view",
          at: "11:00:00",
          userEmail: "detail-user@example.com",
          bookId: "book-a",
        },
        {
          id: "detail-wrong-book-loan",
          eventType: "loan",
          at: "11:10:00",
          userEmail: "detail-user@example.com",
          bookId: "book-b",
        },
        {
          id: "thread-wrong-book",
          eventType: "book_link_click",
          at: "12:00:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
          sourceType: "thread",
        },
        {
          id: "thread-post-wrong-book",
          eventType: "post_view",
          at: "11:59:00",
          userEmail: "thread-user@example.com",
          bookId: "book-a",
        },
        {
          id: "thread-wrong-book-loan",
          eventType: "loan",
          at: "12:10:00",
          userEmail: "thread-user@example.com",
          bookId: "book-b",
        },
        {
          id: "ai-link-outside-window",
          eventType: "book_link_click",
          at: "13:00:00",
          userEmail: "ai-click-user@example.com",
          bookId: "book-a",
          sourceType: "ai_chat",
          sourceId: "ai-display-outside-window",
        },
        {
          id: "ai-click-loan-outside-window",
          eventType: "loan",
          at: "14:01:00",
          userEmail: "ai-click-user@example.com",
          bookId: "book-a",
        },
        {
          id: "ai-display-loan-outside-window",
          eventType: "loan",
          at: "16:01:00",
          userEmail: "ai-display-user@example.com",
          bookId: "book-a",
        },
      ],
      expected: {
        threadLinkClickCount: 1,
        aiRecommendationCount: 1,
        aiClickCount: 1,
        aiClickRate: 1,
      },
    },
  ];

  for (const scenario of pathScenarios) {
    it(scenario.name, async () => {
      await seedEvents(client, scenario.events ?? []);
      await seedAiRecommendations(client, scenario.aiRecommendations ?? []);

      const data = await fetchDashboard(scenario.impactTime);

      expectPaths(data, scenario.expected);
    });
  }

  it("経路ごとの影響時間を別々に適用する", async () => {
    await seedEvents(client, [
      {
        id: "post-ok",
        eventType: "post_view",
        at: "09:00:00",
        userEmail: "post-ok@example.com",
        bookId: "book-a",
      },
      {
        id: "post-ok-loan",
        eventType: "loan",
        at: "09:59:00",
        userEmail: "post-ok@example.com",
        bookId: "book-a",
      },
      {
        id: "post-ng",
        eventType: "post_view",
        at: "10:00:00",
        userEmail: "post-ng@example.com",
        bookId: "book-a",
      },
      {
        id: "post-ng-loan",
        eventType: "loan",
        at: "11:01:00",
        userEmail: "post-ng@example.com",
        bookId: "book-a",
      },
      {
        id: "detail-ok",
        eventType: "book_detail_view",
        at: "12:00:00",
        userEmail: "detail-ok@example.com",
        bookId: "book-b",
      },
      {
        id: "detail-ok-loan",
        eventType: "loan",
        at: "12:29:00",
        userEmail: "detail-ok@example.com",
        bookId: "book-b",
      },
      {
        id: "detail-ng",
        eventType: "book_detail_view",
        at: "13:00:00",
        userEmail: "detail-ng@example.com",
        bookId: "book-b",
      },
      {
        id: "detail-ng-loan",
        eventType: "loan",
        at: "13:31:00",
        userEmail: "detail-ng@example.com",
        bookId: "book-b",
      },
      {
        id: "thread-ok",
        eventType: "book_link_click",
        at: "14:00:00",
        userEmail: "thread-ok@example.com",
        bookId: "book-a",
        sourceType: "thread",
      },
      {
        id: "thread-ok-post",
        eventType: "post_view",
        at: "13:59:00",
        userEmail: "thread-ok@example.com",
        bookId: "book-a",
      },
      {
        id: "thread-ok-loan",
        eventType: "loan",
        at: "14:00:05",
        userEmail: "thread-ok@example.com",
        bookId: "book-a",
      },
      {
        id: "thread-ng",
        eventType: "book_link_click",
        at: "14:10:00",
        userEmail: "thread-ng@example.com",
        bookId: "book-a",
        sourceType: "thread",
      },
      {
        id: "thread-ng-post",
        eventType: "post_view",
        at: "14:09:00",
        userEmail: "thread-ng@example.com",
        bookId: "book-a",
      },
      {
        id: "thread-ng-loan",
        eventType: "loan",
        at: "14:10:06",
        userEmail: "thread-ng@example.com",
        bookId: "book-a",
      },
      {
        id: "ai-click-ok",
        eventType: "book_link_click",
        at: "15:00:00",
        userEmail: "ai-click-ok@example.com",
        bookId: "book-a",
        sourceType: "ai_chat",
        sourceId: "ai-display-ok",
      },
      {
        id: "ai-click-ok-loan",
        eventType: "loan",
        at: "15:19:00",
        userEmail: "ai-click-ok@example.com",
        bookId: "book-a",
      },
      {
        id: "ai-click-ng",
        eventType: "book_link_click",
        at: "15:30:00",
        userEmail: "ai-click-ng@example.com",
        bookId: "book-a",
        sourceType: "ai_chat",
        sourceId: "ai-display-ng",
      },
      {
        id: "ai-click-ng-loan",
        eventType: "loan",
        at: "15:51:00",
        userEmail: "ai-click-ng@example.com",
        bookId: "book-a",
      },
      {
        id: "ai-display-ok-loan",
        eventType: "loan",
        at: "16:09:00",
        userEmail: "ai-display-ok@example.com",
        bookId: "book-b",
      },
      {
        id: "ai-display-ng-loan",
        eventType: "loan",
        at: "16:31:00",
        userEmail: "ai-display-ng@example.com",
        bookId: "book-b",
      },
    ]);
    await seedAiRecommendations(client, [
      {
        id: "ai-display-ok",
        at: "16:00:00",
        userEmail: "ai-display-ok@example.com",
        bookId: "book-b",
      },
      {
        id: "ai-display-ng",
        at: "16:20:00",
        userEmail: "ai-display-ng@example.com",
        bookId: "book-b",
      },
    ]);

    const data = await fetchDashboard({
      postToLoan: "1hours",
      bookDetailToLoan: "30minutes",
      threadLinkClickToLoan: "5seconds",
      aiRecommendationDisplayToLoan: "10minutes",
      aiRecommendationToLoan: "20minutes",
    });

    expectPaths(data, {
      postToLoanCount: 3,
      bookDetailToLoanCount: 1,
      avgBookDetailToLoanSeconds: 1740,
      threadLinkClickCount: 2,
      threadLinkClickToLoanCount: 1,
      threadLinkClickToLoanRate: 0.5,
      aiRecommendationCount: 2,
      aiRecommendationDisplayToLoanCount: 1,
      aiRecommendationDisplayToLoanRate: 0.5,
      aiClickCount: 2,
      aiClickRate: 1,
      aiRecommendationToLoanCount: 1,
      aiRecommendationToLoanRate: 0.5,
    });
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
      { bookId: "book-a", title: "Book book-a", viewCount: 2 },
      { bookId: "book-b", title: "Book book-b", viewCount: 1 },
    ]);
    expect(data.recentLogs.map((log) => log.id)).toEqual([
      "detail-b-1",
      "loan-a",
      "detail-a-2",
      "detail-a-1",
      "post-a",
    ]);
  });

  it("未ログインなら401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET(
      new Request(
        `http://localhost/api/admin/events/dashboard` +
          `?postToLoanImpactTime=1hours` +
          `&bookDetailToLoanImpactTime=30minutes` +
          `&threadLinkClickToLoanImpactTime=7days` +
          `&aiRecommendationDisplayToLoanImpactTime=7days` +
          `&aiRecommendationToLoanImpactTime=7days`
      )
    );

    expect(response.status).toBe(401);
  });

  it("管理者でなければ403を返す", async () => {
    mockedAdmin.mockResolvedValue(false);

    const response = await GET(
      new Request(
        `http://localhost/api/admin/events/dashboard` +
          `?postToLoanImpactTime=1hours` +
          `&bookDetailToLoanImpactTime=30minutes` +
          `&threadLinkClickToLoanImpactTime=7days` +
          `&aiRecommendationDisplayToLoanImpactTime=7days` +
          `&aiRecommendationToLoanImpactTime=7days`
      )
    );

    expect(response.status).toBe(403);
  });

  it("影響時間が足りない場合は400を返す", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/admin/events/dashboard` +
          `?postToLoanImpactTime=1hours` +
          `&bookDetailToLoanImpactTime=30minutes`
      )
    );

    expect(response.status).toBe(400);
  });
});
