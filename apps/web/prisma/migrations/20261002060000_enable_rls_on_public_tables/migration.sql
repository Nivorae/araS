-- Supabase exposes the `public` schema through its Data API (PostgREST) to the
-- `anon` and `authenticated` roles. The app never uses it — all access goes
-- through Prisma as `postgres`, which owns these tables and has BYPASSRLS — so
-- RLS with no policies plus revoked grants closes that path without touching
-- the app. New tables need the same two statements.

ALTER TABLE "Entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntryHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Loan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Insurance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Recurrence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserIdMigration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dividend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- The roles exist only on Supabase; skip them on a plain Postgres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
  END IF;
END $$;
