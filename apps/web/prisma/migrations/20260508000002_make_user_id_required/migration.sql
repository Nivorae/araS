-- AlterTable
ALTER TABLE "Entry" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PortfolioItem" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;
