import { db } from "@/lib/db";

export type LoanHistoryRow = {
  loanId: string;
  userEmail: string;
  bookId: string;
  loanedAt: string | Date;
  returnedAt: string | Date | null;
  dueAt: string | Date | null;
  bookTitle: string;
  bookThumbnail: string | null;
  bookIsbn13: string;
  bookAuthors: string[];
  status: "borrowing" | "returned";
};

export type SerializedLoanHistoryRow = Omit<
  LoanHistoryRow,
  "loanedAt" | "returnedAt" | "dueAt"
> & {
  loanedAt: string;
  returnedAt: string | null;
  dueAt: string | null;
};

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeLoanHistoryRow(
  row: LoanHistoryRow
): SerializedLoanHistoryRow {
  return {
    ...row,
    loanedAt: toDateString(row.loanedAt),
    returnedAt: row.returnedAt ? toDateString(row.returnedAt) : null,
    dueAt: row.dueAt ? toDateString(row.dueAt) : null,
  };
}

export async function getLoanHistory(whereClause = "") {
  return db.query<LoanHistoryRow>(
    `SELECT
       l.id AS "loanId",
       l."userEmail",
       l."bookId",
       l."loanedAt",
       l."returnedAt",
       l."dueAt",
       b.title AS "bookTitle",
       b.thumbnail AS "bookThumbnail",
       b.isbn13 AS "bookIsbn13",
       b.authors AS "bookAuthors",
       CASE
         WHEN l."returnedAt" IS NULL THEN 'borrowing'
         ELSE 'returned'
       END AS status
     FROM "Loan" l
     INNER JOIN "Book" b ON b.id = l."bookId"
     ${whereClause}
     ORDER BY l."loanedAt" DESC, l.id DESC`
  );
}
