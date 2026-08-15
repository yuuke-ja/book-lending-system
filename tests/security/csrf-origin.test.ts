import { afterEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const PROTECTED_API_PATHS = [
  "/api/ai/chat",
  "/api/user/avatars",
  "/api/ai/book-link-click",
  "/api/thread/book-link-click",
  "/api/comment/book-link-click",
  "/api/comment/research-event",
  "/api/book/search/log",
];

function createRequest(
  path: string,
  options: { method?: string; origin?: string } = {}
) {
  const headers = new Headers();
  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }

  return new NextRequest(`https://library.example.com${path}`, {
    method: options.method ?? "POST",
    headers,
  });
}

function expectRequestContinues(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("x-middleware-next")).toBe("1");
}

describe("APIのCSRF Origin検証", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("すべてのAPIにproxyを適用する", () => {
    expect(config).toEqual({ matcher: "/api/:path*" });
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "https://library.example.com/api/ai/chat",
      })
    ).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "https://library.example.com/admin/notices",
      })
    ).toBe(false);
  });

  it.each(PROTECTED_API_PATHS)("%sをOrigin検証の対象にする", (path) => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://library.example.com");

    const response = proxy(
      createRequest(path, { origin: "https://library.example.com" })
    );

    expectRequestContinues(response);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%sは許可されたOriginなら通す",
    (method) => {
      vi.stubEnv("ALLOWED_ORIGINS", "https://library.example.com");

      const response = proxy(
        createRequest("/api/book/search/log", {
          method,
          origin: "https://library.example.com",
        })
      );

      expectRequestContinues(response);
    }
  );

  it.each(["GET", "HEAD", "OPTIONS"])(
    "%sはOriginがなくても通す",
    (method) => {
      const response = proxy(
        createRequest("/api/book/search/log", { method })
      );

      expectRequestContinues(response);
    }
  );

  it.each([
    ["異なるドメイン", "https://attacker.example"],
    ["似たドメイン", "https://library.example.com.attacker.example"],
    ["異なるサブドメイン", "https://evil.example.com"],
    ["異なるプロトコル", "http://library.example.com"],
    ["異なるポート", "https://library.example.com:444"],
  ])("%sのOriginを403にする", async (_caseName, origin) => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://library.example.com");

    const response = proxy(
      createRequest("/api/book/search/log", { origin })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "許可されていない送信元です",
    });
  });

  it.each([
    ["Originなし", undefined],
    ["Origin: null", "null"],
    ["不正なOrigin", "not-a-url"],
    ["パス付きOrigin", "https://library.example.com/path"],
    ["クエリ付きOrigin", "https://library.example.com?source=attacker"],
    ["認証情報付きOrigin", "https://user:pass@library.example.com"],
  ])("%sを403にする", async (_caseName, origin) => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://library.example.com");

    const response = proxy(
      createRequest("/api/book/search/log", { origin })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "許可されていない送信元です",
    });
  });

  it("カンマ区切りの複数Originと末尾スラッシュを正規化する", () => {
    vi.stubEnv(
      "ALLOWED_ORIGINS",
      "https://library.example.com/, https://preview.example.com"
    );

    const response = proxy(
      createRequest("/api/ai/chat", { origin: "https://preview.example.com" })
    );

    expectRequestContinues(response);
  });

  it("ローカル開発では実際のlocalhost Originを通す", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOWED_ORIGINS", "");

    const request = new NextRequest("http://localhost:3001/api/ai/chat", {
      method: "POST",
      headers: { origin: "http://localhost:3001" },
    });

    expectRequestContinues(proxy(request));
  });

  it("本番で許可Originが設定されていなければ安全側に停止する", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    const response = proxy(
      createRequest("/api/ai/chat", {
        origin: "https://library.example.com",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "CSRF保護の設定が不足しています",
    });
  });

  it("設定がなくてもOrigin自体が欠けていれば403にする", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    const response = proxy(createRequest("/api/ai/chat"));

    expect(response.status).toBe(403);
  });

  it("許可Originの設定値が不正なら設定エラーにする", async () => {
    vi.stubEnv(
      "ALLOWED_ORIGINS",
      "https://library.example.com/invalid-path"
    );

    const response = proxy(
      createRequest("/api/ai/chat", {
        origin: "https://library.example.com",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "CSRF保護の設定が不足しています",
    });
  });

  it.each([
    "/api/auth/signin",
    "/api/admin/sync-admins",
    "/api/sync-admins",
  ])("%sはOrigin検証から除外する", (path) => {
    const response = proxy(createRequest(path));

    expectRequestContinues(response);
  });

  it("除外URLと名前が似ているだけのAPIは除外しない", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://library.example.com");

    const response = proxy(createRequest("/api/authentication/update"));

    expect(response.status).toBe(403);
  });

  it("Vercel PreviewのOriginをシステム環境変数から許可する", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "");
    vi.stubEnv("VERCEL_URL", "preview-library.vercel.app");

    const response = proxy(
      createRequest("/api/ai/chat", {
        origin: "https://preview-library.vercel.app",
      })
    );

    expectRequestContinues(response);
  });
});
