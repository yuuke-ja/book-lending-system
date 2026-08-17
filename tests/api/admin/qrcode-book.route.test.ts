import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { GET } from "@/app/api/admin/qrcode/book/route";
import { auth } from "@/lib/auth";
import { Admin } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/admin", () => ({ Admin: vi.fn() }));
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedAdmin = vi.mocked(Admin);
const mockedAxiosGet = vi.mocked(axios.get);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

function request(isbn?: string) {
  const url = new URL("https://library.example.com/api/admin/qrcode/book");
  if (isbn !== undefined) url.searchParams.set("isbn", isbn);
  return new Request(url);
}

describe("GET /api/admin/qrcode/book", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockedAdmin.mockResolvedValue(true);
    vi.stubEnv("RAKUTEN_APP_ID", "rakuten-id");
    vi.stubEnv("RAKUTEN_ACCESS_KEY", "rakuten-key");
    vi.stubEnv("BOOKS_API_KEY", "google-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("未認証なら401", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(401);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("非管理者なら403", async () => {
    mockedAdmin.mockResolvedValue(false);

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(403);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "978123", "978123456789X"])("不正なISBN/JANなら400", async (isbn) => {
    const response = await GET(request(isbn));

    expect(response.status).toBe(400);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("491系JANは楽天APIを呼んで書誌情報を整形する", async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        Items: [
          {
            title: "雑誌",
            publisherName: "出版社",
            itemCaption: "説明",
            mediumImageUrl: "https://example.com/magazine.jpg",
          },
        ],
      },
    });

    const response = await GET(request("4911234567890"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      googleBookId: null,
      isbn13: "4911234567890",
      title: "雑誌",
      authors: ["出版社"],
      description: "説明",
      thumbnail: "https://example.com/magazine.jpg",
    });
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining("BooksMagazine/Search"),
      expect.objectContaining({
        headers: { Origin: "https://library.example.com" },
        params: expect.objectContaining({ jan: "4911234567890" }),
      })
    );
  });

  it("491系で楽天設定がなければ500", async () => {
    vi.stubEnv("RAKUTEN_APP_ID", "");

    const response = await GET(request("4911234567890"));

    expect(response.status).toBe(500);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("491系で商品がなければ404", async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: { Items: [] } });

    const response = await GET(request("4911234567890"));

    expect(response.status).toBe(404);
  });

  it("通常ISBNはGoogle Books APIの結果を整形する", async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "google-1",
            volumeInfo: {
              title: "本",
              authors: ["著者"],
              description: "説明",
              imageLinks: { thumbnail: "https://example.com/book.jpg" },
            },
          },
        ],
      },
    });

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(200);
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      "https://www.googleapis.com/books/v1/volumes?q=isbn:9781234567890&key=google-key"
    );
    await expect(response.json()).resolves.toMatchObject({
      googleBookId: "google-1",
      isbn13: "9781234567890",
      title: "本",
    });
  });

  it("Google Booksの任意項目がなければ安全な既定値で補完する", async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        items: [{ id: "google-empty", volumeInfo: { title: "最小情報の本" } }],
      },
    });

    const response = await GET(request("9791234567890"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      googleBookId: "google-empty",
      isbn13: "9791234567890",
      title: "最小情報の本",
      authors: [],
      description: null,
      thumbnail: null,
    });
  });

  it("Google Books API keyがなければ500で外部通信しない", async () => {
    vi.stubEnv("BOOKS_API_KEY", "");

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(500);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("Google Booksに本がなければ404", async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: { items: [] } });

    const response = await GET(request("9781234567890"));

    expect(response.status).toBe(404);
  });

  it("外部API障害なら500。ただし楽天404は404に変換する", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { response: { status: 404 } };
    mockedAxiosGet.mockRejectedValueOnce(error);
    mockedIsAxiosError.mockReturnValueOnce(true);

    const rakutenResponse = await GET(request("4911234567890"));
    expect(rakutenResponse.status).toBe(404);

    mockedAxiosGet.mockRejectedValueOnce(new Error("network error"));
    const googleResponse = await GET(request("9781234567890"));
    expect(googleResponse.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
  });
});
