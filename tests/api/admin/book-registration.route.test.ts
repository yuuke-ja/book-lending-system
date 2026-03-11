import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/book-registration/route";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = Admin as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = db.query as unknown as ReturnType<typeof vi.fn>;
const mockedTransaction = db.transaction as unknown as ReturnType<typeof vi.fn>;
const makeNextRequest = (url: string) =>
  new Request(url) as unknown as import("next/server").NextRequest;

describe("POST /api/admin/book-registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログインのとき401を返す", async () => {
    mockedAuth.mockResolvedValue(null);

    const res = await POST(makeNextRequest("http://localhost/api/admin/book-registration"));

    expect(res.status).toBe(401);
  });

  it("成功時は200を返しトランザクション内でPendingBookをBookへ登録する", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          googleBookId: "g1",
          isbn13: "9781234567890",
          title: "Test Book",
          authors: ["A Author"],
          description: "desc",
          thumbnail: "thumb",
        },
      ],
    });

    const txQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-1",
            title: "Test Book",
            authors: ["A Author"],
            description: "desc",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ tokens: ["test", "book", "a", "author", "desc"] }],
      })
      .mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) => {
      return callback({ query: txQuery });
    });

    const res = await POST(makeNextRequest("http://localhost/api/admin/book-registration"));

    expect(res.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedTransaction).toHaveBeenCalledTimes(1);
    expect(txQuery).toHaveBeenCalled();
    expect(
      txQuery.mock.calls.some((call) =>
        String(call[0]).includes('DELETE FROM "PendingBook"')
      )
    ).toBe(true);
  });

  it("1文字英字タグのCは自動付与せず、C#とVFXだけを付ける", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          googleBookId: "g1",
          isbn13: "9781234567890",
          title: "Unity VFX Graph マスターガイド",
          authors: ["秋山高廣"],
          description: "C#を利用したVFX Graphの解説書",
          thumbnail: "thumb",
        },
      ],
    });

    const txQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { id: "tag-c", tag: "C", tokens: ["c"] },
          { id: "tag-csharp", tag: "C#", tokens: ["c", "#"] },
          { id: "tag-vfx", tag: "VFX", tokens: ["vfx"] },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-1",
            title: "Unity VFX Graph マスターガイド",
            authors: ["秋山高廣"],
            description: "C#を利用したVFX Graphの解説書",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ tokens: ["unity", "vfx", "graph", "マスター", "ガイド", "c", "#", "を", "利用", "し", "た", "vfx", "graph", "の", "解説", "書"] }],
      })
      .mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) => {
      return callback({ query: txQuery });
    });

    const res = await POST(makeNextRequest("http://localhost/api/admin/book-registration"));
    const insertBookTagCall = txQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO "BookTag"')
    );

    expect(res.status).toBe(200);
    expect(insertBookTagCall?.[1]).toEqual([
      "book-1",
      ["tag-csharp", "tag-vfx"],
    ]);
  });

  it("Unity VFX Graph本ではCを付けず、本文にある主題タグだけを付ける", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          googleBookId: "g2",
          isbn13: "9781234567891",
          title: "Unity VFX Graph マスターガイド",
          authors: ["秋山高廣"],
          description:
            "Unityのパーティクルシステム、VFX Graph(Visual Effect Graph)は自由度の高いパーティクル制御ができる優れたエディターですが、詳しい解説書籍はこれまでありませんでした。本書は、基本的な操作方法から、高品質なゲームエフェクト制作のための高度な機能まで、もれなく解説した書籍です。これ1冊あれば、VFX Graphのすべてが理解できるでしょう。姉妹書「Unity ゲームエフェクトマスターガイド」",
          thumbnail: "thumb",
        },
      ],
    });

    const txQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { id: "tag-c", tag: "C", tokens: ["c"] },
          { id: "tag-unity", tag: "Unity", tokens: ["unity"] },
          { id: "tag-vfx", tag: "VFX", tokens: ["vfx"] },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-2",
            title: "Unity VFX Graph マスターガイド",
            authors: ["秋山高廣"],
            description:
              "Unityのパーティクルシステム、VFX Graph(Visual Effect Graph)は自由度の高いパーティクル制御ができる優れたエディターですが、詳しい解説書籍はこれまでありませんでした。本書は、基本的な操作方法から、高品質なゲームエフェクト制作のための高度な機能まで、もれなく解説した書籍です。これ1冊あれば、VFX Graphのすべてが理解できるでしょう。姉妹書「Unity ゲームエフェクトマスターガイド」",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            tokens: [
              "unity",
              "vfx",
              "graph",
              "visual",
              "effect",
              "graph",
              "自由",
              "度",
              "高い",
              "パーティクル",
              "制御",
              "優れ",
              "エディター",
              "基本",
              "操作",
              "方法",
              "高品質",
              "ゲーム",
              "エフェクト",
              "制作",
              "高度",
              "機能",
              "vfx",
              "graph",
              "すべて",
              "理解",
            ],
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) => {
      return callback({ query: txQuery });
    });

    const res = await POST(makeNextRequest("http://localhost/api/admin/book-registration"));
    const insertBookTagCall = txQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO "BookTag"')
    );

    expect(res.status).toBe(200);
    expect(insertBookTagCall?.[1]).toEqual([
      "book-2",
      ["tag-unity", "tag-vfx"],
    ]);
  });

  it("Web API本では概要にあるWebタグを付け、無関係なCは付けない", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    mockedQuery.mockResolvedValue({
      rows: [
        {
          googleBookId: "g3",
          isbn13: "9781234567892",
          title: "Web APIの設計と運用",
          authors: ["著者A"],
          description:
            "Web APIの設計、開発、運用についての解説書。本書ではAPIをどのように設計し運用すればより効果的なのか、ありがちな罠や落とし穴を避けるにはどういう点に気をつけなければいけないのかを明らかにします。ターゲットは、URIにアクセスするとXMLやJSONなどのデータが返ってくるシンプルなタイプ―XML over HTTP方式やJSON over HTTP方式―のAPIです。",
          thumbnail: "thumb",
        },
      ],
    });

    const txQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { id: "tag-c", tag: "C", tokens: ["c"] },
          { id: "tag-web", tag: "Web", tokens: ["web"] },
          { id: "tag-api-dev", tag: "API開発", tokens: ["api", "開発"] },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "book-3",
            title: "Web APIの設計と運用",
            authors: ["著者A"],
            description:
              "Web APIの設計、開発、運用についての解説書。本書ではAPIをどのように設計し運用すればより効果的なのか、ありがちな罠や落とし穴を避けるにはどういう点に気をつけなければいけないのかを明らかにします。ターゲットは、URIにアクセスするとXMLやJSONなどのデータが返ってくるシンプルなタイプ―XML over HTTP方式やJSON over HTTP方式―のAPIです。",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            tokens: [
              "web",
              "api",
              "設計",
              "開発",
              "運用",
              "解説",
              "書",
              "api",
              "設計",
              "運用",
              "効果",
              "的",
              "罠",
              "落とし穴",
              "uri",
              "アクセス",
              "xml",
              "json",
              "データ",
              "返っ",
              "シンプル",
              "タイプ",
              "xml",
              "over",
              "http",
              "方式",
              "json",
              "over",
              "http",
              "方式",
              "api",
            ],
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    mockedTransaction.mockImplementation(async (callback: (tx: { query: typeof txQuery }) => Promise<unknown>) => {
      return callback({ query: txQuery });
    });

    const res = await POST(makeNextRequest("http://localhost/api/admin/book-registration"));
    const insertBookTagCall = txQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO "BookTag"')
    );

    expect(res.status).toBe(200);
    expect(insertBookTagCall?.[1]).toEqual([
      "book-3",
      ["tag-web"],
    ]);
  });
});
