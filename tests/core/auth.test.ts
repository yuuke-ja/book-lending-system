import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: null as null | {
    callbacks?: {
      signIn?: (input: { user: { email?: string | null } }) => Promise<boolean | string>;
    };
  },
  dbQuery: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { query: state.dbQuery },
}));
vi.mock("next-auth/providers/google", () => ({
  default: vi.fn((options: unknown) => ({ id: "google", options })),
}));
vi.mock("next-auth", () => ({
  default: vi.fn((config: typeof state.config) => {
    state.config = config;
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));

describe("NextAuth signIn callback", () => {
  let signInCallback: NonNullable<
    NonNullable<NonNullable<typeof state.config>["callbacks"]>["signIn"]
  >;

  beforeAll(async () => {
    await import("@/lib/auth");
    const configuredSignIn = state.config?.callbacks?.signIn;
    if (!configuredSignIn) {
      throw new Error("signIn callback was not configured");
    }
    signInCallback = configuredSignIn;
  });

  beforeEach(() => {
    state.dbQuery.mockReset();
    state.dbQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it("メールアドレスがなければ拒否してDBへアクセスしない", async () => {
    await expect(signInCallback({ user: { email: null } })).resolves.toBe(
      "/banpage"
    );
    expect(state.dbQuery).not.toHaveBeenCalled();
  });

  it.each(["student@nnn.ed.jp", "teacher@nnn.ac.jp"])(
    "%s はUserを作成してログインを許可する",
    async (email) => {
      await expect(signInCallback({ user: { email } })).resolves.toBe(true);
      expect(state.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (email) DO NOTHING'),
        [email]
      );
    }
  );

  it.each([
    "student@example.com",
    "student@nnn.ed.jp.evil.example",
    "student@sub.nnn.ac.jp",
  ])("許可対象外の %s は拒否する", async (email) => {
    await expect(signInCallback({ user: { email } })).resolves.toBe("/banpage");
    expect(state.dbQuery).not.toHaveBeenCalled();
  });

  it("User作成に失敗したら例外を呼び出し元へ返す", async () => {
    const error = new Error("database unavailable");
    state.dbQuery.mockRejectedValueOnce(error);

    await expect(
      signInCallback({ user: { email: "student@nnn.ed.jp" } })
    ).rejects.toBe(error);
  });
});
