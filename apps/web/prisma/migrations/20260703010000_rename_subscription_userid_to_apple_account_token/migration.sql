-- DropIndex
DROP INDEX "Subscription_userId_key";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "userId",
ADD COLUMN     "appleAccountToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_appleAccountToken_key" ON "Subscription"("appleAccountToken");
