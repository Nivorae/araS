-- Baseline migration: records a column that already exists on the live
-- database but was never captured by a tracked migration (added via an
-- untracked `db push` at some point in the past). This file is registered
-- via `prisma migrate resolve --applied` rather than executed, so it must
-- stay idempotent (IF NOT EXISTS) in case it is ever replayed against a
-- fresh database that does not yet have the column.
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "includeInChart" BOOLEAN NOT NULL DEFAULT true;
