import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getTags } from "@/app/api/admin/tags/route";
import { GET as getSubterms } from "@/app/api/admin/tags/[tagId]/subterms/route";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";
import { db } from "@/lib/db";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = vi.mocked(Admin);
const mockedQuery = vi.mocked(db.query);

describe("管理者タグGET API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
  });

  it.each([
    ["タグ", () => getTags()],
    [
      "小要素",
      () =>
        getSubterms(new Request("http://localhost/api/admin/tags/tag-1/subterms"), {
          params: Promise.resolve({ tagId: "tag-1" }),
        }),
    ],
  ])("%sGETは未認証なら401", async (_name, invoke) => {
    mockedAuth.mockResolvedValue(null);

    const response = await invoke();

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["タグ", () => getTags()],
    [
      "小要素",
      () =>
        getSubterms(new Request("http://localhost/api/admin/tags/tag-1/subterms"), {
          params: Promise.resolve({ tagId: "tag-1" }),
        }),
    ],
  ])("%sGETは非管理者なら403", async (_name, invoke) => {
    mockedAdmin.mockResolvedValue(false);

    const response = await invoke();

    expect(response.status).toBe(403);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("タグ一覧を名前順で返す", async () => {
    const rows = [{ id: "tag-1", tag: "Web" }];
    mockedQuery.mockResolvedValueOnce({ rows } as never);

    const response = await getTags();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
    expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining("ORDER BY tag ASC"));
  });

  it("指定タグの小要素を名前順で返す", async () => {
    const rows = [{ id: "subterm-1", tagId: "tag-1", subterm: "React" }];
    mockedQuery.mockResolvedValueOnce({ rows } as never);

    const response = await getSubterms(
      new Request("http://localhost/api/admin/tags/tag-1/subterms"),
      { params: Promise.resolve({ tagId: "tag-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
    expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining("ORDER BY subterm ASC"), [
      "tag-1",
    ]);
  });

  it("タグと小要素が0件なら空配列を返す", async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as never);

    const tagsResponse = await getTags();
    const subtermsResponse = await getSubterms(
      new Request("http://localhost/api/admin/tags/tag-1/subterms"),
      { params: Promise.resolve({ tagId: "tag-1" }) }
    );

    await expect(tagsResponse.json()).resolves.toEqual([]);
    await expect(subtermsResponse.json()).resolves.toEqual([]);
  });

  it("空のtagIdなら400でDBを呼ばない", async () => {
    const response = await getSubterms(
      new Request("http://localhost/api/admin/tags/%20/subterms"),
      { params: Promise.resolve({ tagId: "   " }) }
    );

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["タグ", () => getTags()],
    [
      "小要素",
      () =>
        getSubterms(new Request("http://localhost/api/admin/tags/tag-1/subterms"), {
          params: Promise.resolve({ tagId: "tag-1" }),
        }),
    ],
  ])("%sGETはDB障害なら500", async (_name, invoke) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const response = await invoke();

    expect(response.status).toBe(500);
  });
});
