const E2E_DATABASE_NAME = "book_lending_e2e";
const E2E_DATABASE_PORT = "55433";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export const e2eUsers = {
  userA: {
    email: "e2e-user-a@example.test",
    name: "E2EユーザーA",
  },
  userB: {
    email: "e2e-user-b@example.test",
    name: "E2EユーザーB",
  },
  admin: {
    email: "e2e-admin@example.test",
    name: "E2E管理者",
  },
} as const;

const e2eEmails = new Set<string>(
  Object.values(e2eUsers).map((user) => user.email)
);

function hasSafeE2EDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;

  try {
    const url = new URL(databaseUrl);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      LOOPBACK_HOSTS.has(url.hostname) &&
      url.port === E2E_DATABASE_PORT &&
      database === E2E_DATABASE_NAME
    );
  } catch {
    return false;
  }
}

export function isE2ETestMode(): boolean {
  if (process.env.E2E_TEST_MODE !== "1") return false;

  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    !hasSafeE2EDatabaseUrl(process.env.DATABASE_URL)
  ) {
    throw new Error(
      "E2E_TEST_MODE is allowed only outside production with " +
        "127.0.0.1:55433/book_lending_e2e"
    );
  }

  return true;
}

export function isE2EUserEmail(email: string): boolean {
  return e2eEmails.has(email.toLowerCase());
}
