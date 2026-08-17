import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/user/avatars/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const { uploadMock, getPublicUrlMock, fromMock } = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const fromMock = vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }));
  return { uploadMock, getPublicUrlMock, fromMock };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: fromMock } })),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedQuery = vi.mocked(db.query);

function request(file?: File) {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return new Request("http://localhost/api/user/avatars", {
    method: "POST",
    body: formData,
  });
}

function fileOfSize(size: number, type = "image/png") {
  return new File([new Uint8Array(size)], "avatar", { type });
}

describe("POST /api/user/avatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    mockedQuery.mockResolvedValue({ rows: [{ id: "user-1" }] } as never);
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/avatars/uploads/user-1/avatar" },
    });
  });

  it("未認証なら401", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await POST(request(fileOfSize(1)));

    expect(response.status).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("fileがなければ400", async () => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("FormDataを解析できなければ400", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const invalidRequest = {
      formData: vi.fn().mockRejectedValue(new Error("invalid multipart")),
    } as unknown as Request;

    const response = await POST(invalidRequest);

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("許可されていないMIME typeなら400", async () => {
    const response = await POST(request(fileOfSize(1, "image/gif")));

    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("JPEGも許可し、正しいMIMEをStorageへ渡す", async () => {
    const response = await POST(request(fileOfSize(1, "image/jpeg")));

    expect(response.status).toBe(200);
    expect(uploadMock).toHaveBeenCalledWith(
      "uploads/user-1/avatar",
      expect.any(Buffer),
      { contentType: "image/jpeg", upsert: true }
    );
  });

  it("5MiBちょうどは許可し、1byte超過は400", async () => {
    const accepted = await POST(request(fileOfSize(5 * 1024 * 1024)));
    expect(accepted.status).toBe(200);

    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    const rejected = await POST(request(fileOfSize(5 * 1024 * 1024 + 1)));
    expect(rejected.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("DBにユーザーがいなければ404", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

    const response = await POST(request(fileOfSize(1)));

    expect(response.status).toBe(404);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("固定ユーザーパスへupsertしcache-buster付きURLを返す", async () => {
    const response = await POST(request(fileOfSize(3, "image/webp")));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE email = $1'), [
      "user@example.com",
    ]);
    expect(fromMock).toHaveBeenCalledWith("avatars");
    expect(uploadMock).toHaveBeenCalledWith(
      "uploads/user-1/avatar",
      expect.any(Buffer),
      { contentType: "image/webp", upsert: true }
    );
    expect(body.path).toBe("uploads/user-1/avatar");
    expect(new URL(body.url).searchParams.get("v")).toMatch(/^\d+$/);
  });

  it("Storage uploadが失敗したら500", async () => {
    uploadMock.mockResolvedValueOnce({ error: new Error("upload failed") });

    const response = await POST(request(fileOfSize(1)));

    expect(response.status).toBe(500);
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("DB障害は500へ変換する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    const response = await POST(request(fileOfSize(1)));

    expect(response.status).toBe(500);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
