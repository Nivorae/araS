import { prisma } from "@/lib/prisma";

export class AccountService {
  /**
   * Permanently deletes every row owned by a user. Deleting entries cascades to
   * their loan / insurance / history / recurrence rows (all declared
   * `onDelete: Cascade` against `Entry` in schema.prisma), so only the
   * top-level, directly user-scoped models need explicit deletes here.
   * Wrapped in a transaction so a partial delete can't leave orphaned data.
   */
  async deleteAllData(userId: string) {
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.portfolioItem.deleteMany({ where: { userId } }),
      prisma.entry.deleteMany({ where: { userId } }),
    ]);
  }
}

export const accountService = new AccountService();
