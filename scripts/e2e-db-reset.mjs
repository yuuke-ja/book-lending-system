import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const DEFAULT_E2E_DATABASE_URL =
  "postgresql://postgres:book_e2e@127.0.0.1:55433/book_lending_e2e";
const EXPECTED_DATABASE = "book_lending_e2e";
const EXPECTED_PORT = "55433";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function assertSafeE2EDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("E2E_DATABASE_URL must be a valid PostgreSQL URL");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.port !== EXPECTED_PORT ||
    database !== EXPECTED_DATABASE
  ) {
    throw new Error(
      "E2E DB reset refused: use only 127.0.0.1:55433/book_lending_e2e"
    );
  }
}

const databaseUrl = process.env.E2E_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL;
assertSafeE2EDatabaseUrl(databaseUrl);

const seedPath = fileURLToPath(
  new URL("../docker/e2e-db/seed.sql", import.meta.url)
);
const seedSql = await readFile(seedPath, "utf8");
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const result = await client.query("SELECT current_database() AS name");
  if (result.rows[0]?.name !== EXPECTED_DATABASE) {
    throw new Error(
      `E2E DB reset refused: connected to ${result.rows[0]?.name ?? "unknown"}`
    );
  }
  await client.query(seedSql);
  console.log("E2E database reset completed.");
} finally {
  await client.end().catch(() => undefined);
}
