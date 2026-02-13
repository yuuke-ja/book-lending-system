-- CreateTable
CREATE TABLE "LoanSettings" (
    "id" TEXT NOT NULL,
    "fridayOnly" BOOLEAN NOT NULL DEFAULT true,
    "loanPeriodDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanOpenPeriod" (
    "id" TEXT NOT NULL,
    "loanSettingsId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanOpenPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanOpenPeriod_startDate_endDate_enabled_idx" ON "LoanOpenPeriod"("startDate", "endDate", "enabled");

-- AddForeignKey
ALTER TABLE "LoanOpenPeriod" ADD CONSTRAINT "LoanOpenPeriod_loanSettingsId_fkey" FOREIGN KEY ("loanSettingsId") REFERENCES "LoanSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
