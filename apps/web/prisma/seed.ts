import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // No seed data
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
