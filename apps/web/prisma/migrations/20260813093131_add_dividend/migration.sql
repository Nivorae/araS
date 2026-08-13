-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "perShare" DECIMAL(65,30),
    "shares" DECIMAL(65,30),
    "note" TEXT,
    "bankEntryId" TEXT,
    "bankHistoryId" TEXT,
    "transactionId" TEXT,
    "reinvestedAt" TIMESTAMP(3),
    "reinvestAmount" DECIMAL(65,30),
    "reinvestPrice" DECIMAL(65,30),
    "reinvestUnits" DECIMAL(65,30),
    "reinvestHistoryId" TEXT,
    "reinvestBankHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dividend_userId_payDate_idx" ON "Dividend"("userId", "payDate");

-- CreateIndex
CREATE INDEX "Dividend_entryId_idx" ON "Dividend"("entryId");

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_bankEntryId_fkey" FOREIGN KEY ("bankEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
