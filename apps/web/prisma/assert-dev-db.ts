import { PrismaClient } from "@prisma/client";
import { assertDevDatabase } from "./dev-db-guard";

// Standalone preflight so `db:reset` can verify the target BEFORE
// `prisma migrate reset` drops the schema. Exits non-zero to break the chain.
const prisma = new PrismaClient();

assertDevDatabase(prisma)
  .then(() => console.log("Dev database confirmed — safe to reset."))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
