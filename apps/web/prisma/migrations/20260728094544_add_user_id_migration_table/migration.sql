-- CreateTable
CREATE TABLE "UserIdMigration" (
    "legacyUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdMigration_pkey" PRIMARY KEY ("legacyUserId")
);

-- CreateIndex
CREATE INDEX "UserIdMigration_userId_idx" ON "UserIdMigration"("userId");
