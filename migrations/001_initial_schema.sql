CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Admin" (
  email TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "Book" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "googleBookId" TEXT,
  isbn13 TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  description TEXT,
  thumbnail TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PendingBook" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "googleBookId" TEXT,
  isbn13 TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  description TEXT,
  thumbnail TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Loan" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userEmail" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "loanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returnedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  CONSTRAINT "Loan_bookId_fkey"
    FOREIGN KEY ("bookId")
    REFERENCES "Book"(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LoanSettings" (
  "settingKey" TEXT NOT NULL UNIQUE,
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fridayOnly" BOOLEAN NOT NULL DEFAULT true,
  "loanPeriodDays" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LoanOpenPeriod" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "loanSettingsId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  "loanPeriodDays" INTEGER NOT NULL DEFAULT 2,
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanOpenPeriod_loanSettingsId_fkey"
    FOREIGN KEY ("loanSettingsId")
    REFERENCES "LoanSettings"(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userEmail" TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Loan_bookId_returnedAt_idx"
  ON "Loan" ("bookId", "returnedAt");

CREATE INDEX IF NOT EXISTS "Loan_userEmail_returnedAt_idx"
  ON "Loan" ("userEmail", "returnedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Loan_one_active_per_book"
  ON "Loan" ("bookId")
  WHERE "returnedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "LoanOpenPeriod_startDate_endDate_enabled_idx"
  ON "LoanOpenPeriod" ("startDate", "endDate", enabled);

CREATE INDEX IF NOT EXISTS "PushSubscription_userEmail_idx"
  ON "PushSubscription" ("userEmail");
