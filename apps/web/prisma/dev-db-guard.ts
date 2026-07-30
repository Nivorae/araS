import type { PrismaClient } from "@prisma/client";

// Local development used to run against the production database, so every
// destructive script in this folder checks first. A dev database holds one or two
// accounts (yours); production had 45.
export const MAX_USERS_FOR_A_DEV_DB = 3;

/**
 * Throws if the connected database looks like it holds real users. Call this
 * BEFORE anything destructive — `prisma migrate reset` drops the schema before
 * the seed script gets a chance to run, so the seed's own check is too late to
 * protect a reset.
 */
export async function assertDevDatabase(prisma: PrismaClient): Promise<void> {
  const users = await prisma.entry.groupBy({ by: ["userId"] });
  if (users.length > MAX_USERS_FOR_A_DEV_DB) {
    throw new Error(
      `Refusing to continue: this database has ${users.length} distinct users, which looks like ` +
        "production.\nCheck DATABASE_URL and DIRECT_URL in the root .env — they must point at " +
        "your dev Supabase project."
    );
  }
}
