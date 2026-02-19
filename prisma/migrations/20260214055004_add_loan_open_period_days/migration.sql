-- AlterTable
ALTER TABLE "LoanOpenPeriod" ADD COLUMN     "loanPeriodDays" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "LoanSettings" ALTER COLUMN "loanPeriodDays" SET DEFAULT 2;
