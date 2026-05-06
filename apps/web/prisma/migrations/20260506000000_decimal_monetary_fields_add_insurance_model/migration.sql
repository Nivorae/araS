-- Change all monetary columns from DOUBLE PRECISION to DECIMAL(65,30)
-- This prevents floating-point rounding errors in financial calculations.

-- Entry
ALTER TABLE "Entry" ALTER COLUMN "value" TYPE DECIMAL(65,30);

-- EntryHistory
ALTER TABLE "EntryHistory" ALTER COLUMN "delta"    TYPE DECIMAL(65,30);
ALTER TABLE "EntryHistory" ALTER COLUMN "balance"  TYPE DECIMAL(65,30);
ALTER TABLE "EntryHistory" ALTER COLUMN "units"    TYPE DECIMAL(65,30);

-- Loan
ALTER TABLE "Loan" ALTER COLUMN "totalAmount"        TYPE DECIMAL(65,30);
ALTER TABLE "Loan" ALTER COLUMN "annualInterestRate" TYPE DECIMAL(65,30);

-- Transaction
ALTER TABLE "Transaction" ALTER COLUMN "amount" TYPE DECIMAL(65,30);

-- PortfolioItem
ALTER TABLE "PortfolioItem" ALTER COLUMN "avgCost" TYPE DECIMAL(65,30);
ALTER TABLE "PortfolioItem" ALTER COLUMN "shares"  TYPE DECIMAL(65,30);

-- Insurance (table already exists from earlier migrations; only convert monetary columns)
ALTER TABLE "Insurance" ALTER COLUMN "declaredRate"           TYPE DECIMAL(65,30);
ALTER TABLE "Insurance" ALTER COLUMN "premiumTotal"           TYPE DECIMAL(65,30);
ALTER TABLE "Insurance" ALTER COLUMN "sumInsured"             TYPE DECIMAL(65,30);
ALTER TABLE "Insurance" ALTER COLUMN "surrenderValue"         TYPE DECIMAL(65,30);
ALTER TABLE "Insurance" ALTER COLUMN "accumulatedBonus"       TYPE DECIMAL(65,30);
ALTER TABLE "Insurance" ALTER COLUMN "accumulatedSumIncrease" TYPE DECIMAL(65,30);
