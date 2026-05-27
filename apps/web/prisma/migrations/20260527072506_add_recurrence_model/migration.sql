-- CreateEnum
CREATE TYPE "RecurrenceFreq" AS ENUM ('MONTHLY', 'WEEKLY', 'BIWEEKLY', 'YEARLY');

-- CreateTable
CREATE TABLE "Recurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'daily',
    "note" TEXT,
    "frequency" "RecurrenceFreq" NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "monthOfYear" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recurrence_userId_nextRunAt_idx" ON "Recurrence"("userId", "nextRunAt");

-- CreateIndex
CREATE INDEX "Recurrence_entryId_idx" ON "Recurrence"("entryId");

-- AddForeignKey
ALTER TABLE "Recurrence" ADD CONSTRAINT "Recurrence_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
