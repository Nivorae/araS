/*
  Warnings:

  - You are about to drop the column `accumulatedBonus` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `accumulatedSumIncrease` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `cashValueData` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `currentAge` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `declaredRate` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `isPeriodicPayout` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `lastUpdatedAt` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `premiumTotal` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `sumInsured` on the `Insurance` table. All the data in the column will be lost.
  - You are about to drop the column `surrenderValue` on the `Insurance` table. All the data in the column will be lost.
  - Added the required column `insuranceType` to the `Insurance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `insuredName` to the `Insurance` table without a default value. This is not possible if the table is not empty.
  - Made the column `insurer` on table `Insurance` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('LIFE', 'MEDICAL', 'CANCER', 'ACCIDENT', 'SAVINGS_INVESTMENT', 'LONGTERM_CARE', 'OTHER');

-- AlterTable
ALTER TABLE "Insurance" DROP COLUMN "accumulatedBonus",
DROP COLUMN "accumulatedSumIncrease",
DROP COLUMN "cashValueData",
DROP COLUMN "currency",
DROP COLUMN "currentAge",
DROP COLUMN "declaredRate",
DROP COLUMN "isPeriodicPayout",
DROP COLUMN "lastUpdatedAt",
DROP COLUMN "premiumTotal",
DROP COLUMN "sumInsured",
DROP COLUMN "surrenderValue",
ADD COLUMN     "annualPremium" DECIMAL(65,30),
ADD COLUMN     "coverage" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "coveragePeriod" TEXT,
ADD COLUMN     "insuranceType" "InsuranceType" NOT NULL,
ADD COLUMN     "insuredName" TEXT NOT NULL,
ADD COLUMN     "paymentTermYears" INTEGER,
ADD COLUMN     "policyName" TEXT,
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "insurer" SET NOT NULL;
