import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type SignInCallback = (input: {
  user: { email?: string | null };
}) => Promise<true | string>;

type CapturedAuthConfig = {
  callbacks: { signIn: SignInCallback };
  trustHost?: boolean;
};

const { captured, handlerGet, handlerPost } = vi.hoisted(() => ({
  captured: { config: null as CapturedAuthConfig | null },
  handlerGet: vi.fn(),
  handlerPost: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn((config: CapturedAuthConfig) => {
    captured.config = config;
    return {
      handlers: { GET: handlerGet, POST: handlerPost },
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));
vi.mock("next-auth/providers/google", () => ({
  default: vi.fn((options: unknown) => ({ id: "google", options })),
}));
vi.mock("@/lib/db", () => ({ db: { query: vi.fn() } }));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

const mockedQuery = vi.mocked(db.query);

function signInCallback() {
  if (!captured.config) throw new Error("NextAuth config was not captured");
  return captured.config.callbacks.signIn;
}

describe("NextAuth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RouteはNextAuth handlersをそのまま公開する", () => {
    expect(GET).toBe(handlerGet);
    expect(POST).toBe(handlerPost);
    expect(captured.config?.trustHost).toBe(true);
  });

  it.each([
    ["GET", GET, handlerGet],
    ["POST", POST, handlerPost],
  ] as const)("%sはNextAuth handlerのstatus・headers・cookieをそのまま返す", async (
    method,
    routeHandler,
    nextAuthHandler
  ) => {
    const expected = new Response("oauth-response", {
      status: 302,
      headers: {
        location: "https://accounts.example.test/authorize",
        "set-cookie": "session=test; Path=/; HttpOnly",
        "x-auth-handler": method,
      },
    });
    nextAuthHandler.mockResolvedValueOnce(expected);
    const request = new NextRequest("http://localhost/api/auth/callback", {
      method,
    });

    const actual = await routeHandler(request);

    expect(nextAuthHandler).toHaveBeenCalledWith(request);
    expect(actual).toBe(expected);
    expect(actual.status).toBe(302);
    expect(actual.headers.get("location")).toBe(
      "https://accounts.example.test/authorize"
    );
    expect(actual.headers.get("set-cookie")).toContain("session=test");
  });

  it("メールがなければbanpageへ送りDBを更新しない", async () => {
    await expect(signInCallback()({ user: {} })).resolves.toBe("/banpage");
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each([
    "user@example.com",
    "user@nnn.ed.jp.attacker.example",
    "user@sub.nnn.ed.jp",
    "user@NNN.ED.JP",
  ])("許可対象外メール %s を拒否する", async (email) => {
    await expect(signInCallback()({ user: { email } })).resolves.toBe("/banpage");
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it.each(["student@nnn.ed.jp", "staff@nnn.ac.jp"])(
    "許可ドメイン %s はUserをupsertしてログインを許可する",
    async (email) => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(signInCallback()({ user: { email } })).resolves.toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT (email) DO NOTHING"),
        [email]
      );
    }
  );

  it("User upsertが失敗したらsignInも失敗する", async () => {
    mockedQuery.mockRejectedValueOnce(new Error("database error"));

    await expect(
      signInCallback()({ user: { email: "student@nnn.ed.jp" } })
    ).rejects.toThrow("database error");
  });
});
