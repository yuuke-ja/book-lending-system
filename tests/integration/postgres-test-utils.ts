import { readFileSync } from "node:fs";
import { Client, type QueryResult, type QueryResultRow } from "pg";

type QueryClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
};

function readEnvFileValue(file: string, key: string): string | undefined {
  try {
    const prefix = `${key}=`;
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((value) => value.startsWith(prefix))
      .at(-1);
    return line
      ?.slice(prefix.length)
      .trim()
      .replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

export function getIntegrationDatabaseUrl(): string | undefined {
  if (process.env.RUN_DB_TESTS !== "1") return undefined;

  return (
    process.env.TEST_DATABASE_URL ??
    readEnvFileValue(".env.local", "TEST_DATABASE_URL") ??
    readEnvFileValue(".env", "TEST_DATABASE_URL") ??
    process.env.DATABASE_URL ??
    readEnvFileValue(".env.local", "DATABASE_URL") ??
    readEnvFileValue(".env", "DATABASE_URL")
  );
}

export async function connectIntegrationClient(
  databaseUrl: string
): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(`SET TIME ZONE 'Asia/Tokyo'`);
  await client.query(`SET search_path = pg_temp, public`);
  // TEMPテーブルの更新は許可し、永続テーブルへの誤書き込みはDB側で拒否する。
  await client.query(`SET default_transaction_read_only = on`);
  return client;
}

export async function dropTempTables(
  client: Client,
  tableNames: readonly string[]
) {
  for (const tableName of tableNames) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(tableName)) {
      throw new Error(`Unsafe temporary table name: ${tableName}`);
    }
    await client.query(`DROP TABLE IF EXISTS pg_temp."${tableName}" CASCADE`);
  }
}

export async function withTempTableSetup<T>(
  client: Client,
  callback: () => Promise<T>
): Promise<T> {
  await client.query(`SET default_transaction_read_only = off`);
  try {
    return await callback();
  } finally {
    await client.query(`SET default_transaction_read_only = on`);
  }
}

export function createDatabaseAdapter(client: Client) {
  const query: QueryClient["query"] = (text, params = []) =>
    client.query(text, params);

  const transaction = async <T>(
    callback: (transactionClient: QueryClient) => Promise<T>
  ): Promise<T> => {
    await client.query("BEGIN");
    try {
      const result = await callback({ query });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  };

  return { query, transaction };
}
