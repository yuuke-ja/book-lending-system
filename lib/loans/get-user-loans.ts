import { db } from "@/lib/db";

export type UserLoan = {
  id: string;
  bookId: string;
  loanedAt: string;
  dueAt: string | null;
  book: {
    id: string;
    googleBookId: string | null;
    isbn13: string;
    title: string;
    authors: string[];
    description: string | null;
    thumbnail: string | null;
    createdAt: string;
  };
};

type UserLoanRow = {
  id: string;
  bookId: string;
  loanedAt: string | Date;
  dueAt: string | Date | null;
  book_id: string;
  book_googleBookId: string | null;
  book_isbn13: string;
  book_title: string;
  book_authors: string[];
  book_description: string | null;
  book_thumbnail: string | null;
  book_createdAt: string | Date;
};

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapLoan(loan: UserLoanRow): UserLoan {
  return {
    id: loan.id,
    bookId: loan.bookId,
    loanedAt: toDateString(loan.loanedAt),
    dueAt: loan.dueAt ? toDateString(loan.dueAt) : null,
    book: {
      id: loan.book_id,
      googleBookId: loan.book_googleBookId,
      isbn13: loan.book_isbn13,
      title: loan.book_title,
      authors: loan.book_authors,
      description: loan.book_description,
      thumbnail: loan.book_thumbnail,
      createdAt: toDateString(loan.book_createdAt),
    },
  };
}

export async function getCurrentLoans(userEmail: string): Promise<UserLoan[]> {
  const loans = await db.query<UserLoanRow>(
    `SELECT
       l.id,
       l."bookId",
       l."loanedAt",
       l."dueAt",
       b.id AS "book_id",
       b."googleBookId" AS "book_googleBookId",
       b.isbn13 AS "book_isbn13",
       b.title AS "book_title",
       b.authors AS "book_authors",
       b.description AS "book_description",
       b.thumbnail AS "book_thumbnail",
       b."createdAt" AS "book_createdAt"
     FROM "Loan" l
     INNER JOIN "Book" b ON b.id = l."bookId"
     WHERE l."returnedAt" IS NULL
       AND l."userEmail" = $1
     ORDER BY l."loanedAt" DESC`,
    [userEmail]
  );

  return loans.rows.map(mapLoan);
}

export async function getBorrowedList(userEmail: string): Promise<UserLoan[]> {
  const borrowedList = await db.query<UserLoanRow>(
    `SELECT DISTINCT ON(l."bookId")
       l.id,
       l."bookId",
       l."loanedAt",
       l."dueAt",
       b.id AS "book_id",
       b."googleBookId" AS "book_googleBookId",
       b.isbn13 AS "book_isbn13",
       b.title AS "book_title",
       b.authors AS "book_authors",
       b.description AS "book_description",
       b.thumbnail AS "book_thumbnail",
       b."createdAt" AS "book_createdAt"
     FROM "Loan" l
     INNER JOIN "Book" b ON b.id = l."bookId"
     WHERE l."userEmail" = $1
     ORDER BY l."bookId", l."loanedAt" DESC`,
    [userEmail]
  );

  return borrowedList.rows.map(mapLoan);
}
