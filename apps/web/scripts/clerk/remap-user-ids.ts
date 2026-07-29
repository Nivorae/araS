/**
 * Rewrite every Clerk `userId` in the PRODUCTION database from the old
 * development-instance id to the new production-instance id.
 *
 * Reads the map produced by `preseed-prod-users.ts`
 * (`.clerk-migration/user-map.json`), which is authoritative because each
 * production user was created with `external_id` = their old dev id.
 *
 * Why this does NOT reuse DATABASE_URL: `.env` points at the dev database, and
 * every other script in the repo is built on that assumption. This script is
 * the one operation that legitimately needs production, so it takes a separate
 * `MIGRATION_DATABASE_URL` and guards itself by refusing to run against a
 * database that looks like dev (three or fewer distinct users) — remapping the
 * wrong database would be as bad as remapping none.
 *
 * Only four models carry a `userId`. `Loan`, `EntryHistory` and `Insurance`
 * hang off `Entry.entryId` and follow automatically — updating them directly
 * would be wrong.
 *
 * `Subscription` is special: it stores `deriveAppleAccountToken(userId)` rather
 * than the id itself, so its rows are re-derived instead of copied.
 *
 *   pnpm --filter @repo/web clerk:remap            # dry run + census
 *   pnpm --filter @repo/web clerk:remap --confirm  # apply, inside a transaction
 */

import { PrismaClient } from "@prisma/client";
import { deriveAppleAccountToken } from "@repo/shared";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const MIGRATION_URL = process.env.MIGRATION_DATABASE_URL;
const DEV_URL = process.env.DATABASE_URL;
const CONFIRM = process.argv.includes("--confirm");

const MAP_FILE = ".clerk-migration/user-map.json";
const OUT_DIR = ".clerk-migration";

// A production database must have MORE distinct users than this; at or below it
// we are almost certainly pointed at the dev database, so refuse to write.
const MAX_USERS_FOR_A_DEV_DB = 3;

type MappingRow = { devUserId: string; prodUserId: string; email: string; action: string };

function die(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!MIGRATION_URL) die("MIGRATION_DATABASE_URL is missing from the root .env");
  if (DEV_URL && MIGRATION_URL === DEV_URL) {
    die("MIGRATION_DATABASE_URL is identical to DATABASE_URL — refusing to run.");
  }

  const raw = JSON.parse(readFileSync(MAP_FILE, "utf8")) as {
    dryRun: boolean;
    mapping: MappingRow[];
  };
  if (raw.dryRun) die(`${MAP_FILE} was produced by a DRY RUN — run clerk:preseed --confirm first.`);

  const mapping = raw.mapping;
  const unresolved = mapping.filter((m) => !m.prodUserId?.startsWith("user_"));
  if (unresolved.length) die(`${unresolved.length} rows in the map have no real production id.`);

  const byOldId = new Map(mapping.map((m) => [m.devUserId, m.prodUserId]));
  if (byOldId.size !== mapping.length) die("The map contains duplicate devUserId values.");

  const prisma = new PrismaClient({ datasourceUrl: MIGRATION_URL });

  try {
    // --- safety: is this really production? ---
    const distinct = await prisma.entry.groupBy({ by: ["userId"] });
    if (distinct.length <= MAX_USERS_FOR_A_DEV_DB) {
      die(
        `Refusing to continue: this database has only ${distinct.length} distinct users in Entry, ` +
          "which looks like the dev database rather than production.\nCheck MIGRATION_DATABASE_URL."
      );
    }

    console.log(`\nTarget database has ${distinct.length} distinct users in Entry.`);
    console.log(`Map holds ${mapping.length} old -> new id pairs.`);
    console.log(
      CONFIRM ? "\nMode: CONFIRM — the database will be rewritten\n" : "\nMode: DRY RUN\n"
    );

    // --- census across EVERY table that carries a userId ---
    // Checking only Entry would miss a user who has, say, Transactions but no
    // Entry: their rows would silently keep the old id and become unreachable.
    // Reporting the table total next to the matched count also distinguishes
    // "this table is empty" from "this table has rows we are not covering".
    const ids = [...byOldId.keys()];
    const [entryUsers, txUsers, portfolioUsers, recurrenceUsers] = await Promise.all([
      prisma.entry.groupBy({ by: ["userId"] }),
      prisma.transaction.groupBy({ by: ["userId"] }),
      prisma.portfolioItem.groupBy({ by: ["userId"] }),
      prisma.recurrence.groupBy({ by: ["userId"] }),
    ]);

    const dbUserIds = new Set(
      [...entryUsers, ...txUsers, ...portfolioUsers, ...recurrenceUsers].map((r) => r.userId)
    );
    const unmapped = [...dbUserIds].filter((id) => !byOldId.has(id));

    const counts = {
      entry: await prisma.entry.count({ where: { userId: { in: ids } } }),
      transaction: await prisma.transaction.count({ where: { userId: { in: ids } } }),
      portfolioItem: await prisma.portfolioItem.count({ where: { userId: { in: ids } } }),
      recurrence: await prisma.recurrence.count({ where: { userId: { in: ids } } }),
    };
    const totals = {
      entry: await prisma.entry.count(),
      transaction: await prisma.transaction.count(),
      portfolioItem: await prisma.portfolioItem.count(),
      recurrence: await prisma.recurrence.count(),
    };

    const oldTokens = mapping.map((m) => deriveAppleAccountToken(m.devUserId));
    const subscriptions = await prisma.subscription.findMany({
      where: { appleAccountToken: { in: oldTokens } },
    });
    const subscriptionTotal = await prisma.subscription.count();

    console.log("rows that will be rewritten (matched / total in table):");
    console.log(`  Entry           ${counts.entry} / ${totals.entry}`);
    console.log(`  Transaction     ${counts.transaction} / ${totals.transaction}`);
    console.log(`  PortfolioItem   ${counts.portfolioItem} / ${totals.portfolioItem}`);
    console.log(`  Recurrence      ${counts.recurrence} / ${totals.recurrence}`);
    console.log(`  Subscription    ${subscriptions.length} / ${subscriptionTotal}`);
    for (const [table, matched, total] of [
      ["Entry", counts.entry, totals.entry],
      ["Transaction", counts.transaction, totals.transaction],
      ["PortfolioItem", counts.portfolioItem, totals.portfolioItem],
      ["Recurrence", counts.recurrence, totals.recurrence],
    ] as [string, number, number][]) {
      if (matched < total)
        console.warn(`  !! ${table}: ${total - matched} row(s) not covered by the map`);
    }
    console.log("\n  Loan / EntryHistory / Insurance have no userId — they follow Entry.");

    if (unmapped.length) {
      console.warn(`\n  !! ${unmapped.length} userId(s) in the database are NOT in the map:`);
      for (const id of unmapped) console.warn(`       ${id}`);
      console.warn("     Their data will keep the old id and be unreachable after cutover.");
      console.warn("     Re-run clerk:preseed --confirm to pick up recent signups.\n");
    }

    if (!CONFIRM) {
      console.log("\nDRY RUN — nothing was written. Re-run with --confirm to apply.\n");
      return;
    }

    // --- backup before touching anything ---
    mkdirSync(OUT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = `${OUT_DIR}/backup-${stamp}.json`;
    const backup = {
      takenAt: new Date().toISOString(),
      entry: await prisma.entry.findMany({ select: { id: true, userId: true } }),
      transaction: await prisma.transaction.findMany({ select: { id: true, userId: true } }),
      portfolioItem: await prisma.portfolioItem.findMany({ select: { id: true, userId: true } }),
      recurrence: await prisma.recurrence.findMany({ select: { id: true, userId: true } }),
      subscription: await prisma.subscription.findMany({
        select: { id: true, appleAccountToken: true },
      }),
    };
    writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`backup written to ${backupFile}\n`);

    // --- apply, all or nothing ---
    const applied = {
      entry: 0,
      transaction: 0,
      portfolioItem: 0,
      recurrence: 0,
      subscription: 0,
      idMap: 0,
    };

    await prisma.$transaction(
      async (tx) => {
        for (const [oldId, newId] of byOldId) {
          applied.entry += (
            await tx.entry.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            })
          ).count;
          applied.transaction += (
            await tx.transaction.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            })
          ).count;
          applied.portfolioItem += (
            await tx.portfolioItem.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            })
          ).count;
          applied.recurrence += (
            await tx.recurrence.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            })
          ).count;

          const oldToken = deriveAppleAccountToken(oldId);
          const newToken = deriveAppleAccountToken(newId);
          applied.subscription += (
            await tx.subscription.updateMany({
              where: { appleAccountToken: oldToken },
              data: { appleAccountToken: newToken },
            })
          ).count;

          // Written in the same transaction as the rewrite above, because
          // lib/clerk-auth.ts relies on this table to translate legacy tokens.
          // If the rewrite committed without the map, every user still on the
          // old iOS build would be locked out.
          const email = mapping.find((m) => m.devUserId === oldId)?.email ?? "";
          await tx.userIdMigration.upsert({
            where: { legacyUserId: oldId },
            create: { legacyUserId: oldId, userId: newId, email },
            update: { userId: newId, email },
          });
          applied.idMap++;
        }
      },
      { timeout: 120_000 }
    );

    console.log("rewritten:");
    console.log(`  Entry           ${applied.entry}`);
    console.log(`  Transaction     ${applied.transaction}`);
    console.log(`  PortfolioItem   ${applied.portfolioItem}`);
    console.log(`  Recurrence      ${applied.recurrence}`);
    console.log(`  Subscription    ${applied.subscription}`);
    console.log(`  UserIdMigration ${applied.idMap}  (legacy-token translation table)`);

    const leftovers = await prisma.entry.groupBy({ by: ["userId"] });
    const stillOld = leftovers.filter((l) => byOldId.has(l.userId));
    console.log(
      stillOld.length
        ? `\n  WARNING: ${stillOld.length} old id(s) still present in Entry.`
        : "\n  Verified: no old ids remain in Entry.\n"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
