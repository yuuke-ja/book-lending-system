-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "loanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_bookId_returnedAt_idx" ON "Loan"("bookId", "returnedAt");

-- CreateIndex
CREATE INDEX "Loan_userEmail_returnedAt_idx" ON "Loan"("userEmail", "returnedAt");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
