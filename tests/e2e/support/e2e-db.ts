import { Client } from 'pg';
import { e2eConfig } from './e2e-config';

const DEFAULT_E2E_DATABASE_URL =
  'postgresql://postgres:book_e2e@127.0.0.1:55433/book_lending_e2e';

function safeE2EDatabaseUrl(): string {
  const value = process.env.E2E_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL;
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !isLoopback ||
    url.port !== '55433' ||
    database !== 'book_lending_e2e'
  ) {
    throw new Error(
      'E2E DB mutation refused: expected 127.0.0.1:55433/book_lending_e2e'
    );
  }

  return value;
}

export async function resetAvailableBookLoan(): Promise<void> {
  const client = new Client({ connectionString: safeE2EDatabaseUrl() });
  try {
    await client.connect();
    const database = await client.query<{ name: string }>(
      'SELECT current_database() AS name'
    );
    if (database.rows[0]?.name !== 'book_lending_e2e') {
      throw new Error('E2E DB mutation refused: unexpected database');
    }

    await client.query(
      `DELETE FROM "Loan"
       WHERE "bookId" = (
         SELECT id FROM "Book" WHERE isbn13 = $1
       )`,
      [e2eConfig.books.available.isbn]
    );
    await client.query(
      `DELETE FROM "ResearchEvent"
       WHERE "eventType" = 'loan'
         AND "bookId" = (
           SELECT id FROM "Book" WHERE isbn13 = $1
         )`,
      [e2eConfig.books.available.isbn]
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function restoreUserAActiveLoan(isbn: string): Promise<void> {
  const client = new Client({ connectionString: safeE2EDatabaseUrl() });
  try {
    await client.connect();
    const database = await client.query<{ name: string }>(
      'SELECT current_database() AS name'
    );
    if (database.rows[0]?.name !== 'book_lending_e2e') {
      throw new Error('E2E DB mutation refused: unexpected database');
    }

    const restored = await client.query(
      `UPDATE "Loan"
       SET "returnedAt" = NULL
       WHERE "userEmail" = $1
         AND "bookId" = (
           SELECT id FROM "Book" WHERE isbn13 = $2
         )`,
      [e2eConfig.users.userA.email, isbn]
    );
    if (restored.rowCount !== 1) {
      throw new Error(`E2E active loan restore failed for ISBN ${isbn}`);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function resetAdminNotice(title: string): Promise<void> {
  const client = new Client({ connectionString: safeE2EDatabaseUrl() });
  try {
    await client.connect();
    const database = await client.query<{ name: string }>(
      'SELECT current_database() AS name'
    );
    if (database.rows[0]?.name !== 'book_lending_e2e') {
      throw new Error('E2E DB mutation refused: unexpected database');
    }

    await client.query(`DELETE FROM "Notice" WHERE title = $1`, [title]);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function resetAdminTag(tag: string): Promise<void> {
  const client = new Client({ connectionString: safeE2EDatabaseUrl() });
  try {
    await client.connect();
    const database = await client.query<{ name: string }>(
      'SELECT current_database() AS name'
    );
    if (database.rows[0]?.name !== 'book_lending_e2e') {
      throw new Error('E2E DB mutation refused: unexpected database');
    }

    await client.query(`DELETE FROM "TagList" WHERE tag = $1`, [tag]);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function resetCommunityReviewScenario(
  threadContent: string
): Promise<void> {
  const client = new Client({ connectionString: safeE2EDatabaseUrl() });
  try {
    await client.connect();
    const database = await client.query<{ name: string }>(
      'SELECT current_database() AS name'
    );
    if (database.rows[0]?.name !== 'book_lending_e2e') {
      throw new Error('E2E DB mutation refused: unexpected database');
    }

    await client.query('BEGIN');
    await client.query(
      `DELETE FROM "Thread"
       WHERE "userEmail" = $1
         AND content = $2
         AND "bookId" = (
           SELECT id FROM "Book" WHERE isbn13 = $3
         )`,
      [
        e2eConfig.users.userA.email,
        threadContent,
        e2eConfig.books.available.isbn,
      ]
    );
    await client.query(
      `DELETE FROM "BookReview"
       WHERE "userEmail" = $1
         AND "bookId" = (
           SELECT id FROM "Book" WHERE isbn13 = $2
         )`,
      [e2eConfig.users.userA.email, e2eConfig.books.available.isbn]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}
