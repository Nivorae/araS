import type { Prisma } from "@prisma/client";
import type { CreateDividend } from "@repo/shared";
import { prisma } from "@/lib/prisma";
import { d, dn } from "@/lib/serialize";
import { entitlementsService } from "@/services/entitlements.service";

// 與 insurance.service.ts 同名同義：route 會把它映成 403 PREMIUM_REQUIRED。
export class PremiumRequiredError extends Error {
  constructor() {
    super("Premium subscription required");
    this.name = "PremiumRequiredError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

const STOCK_CATS = ["台股", "美股", "加密貨幣", "貴金屬"];
const CASH_TOP_CATEGORY = "流動資金";

type Tx = Prisma.TransactionClient;

function serializeDividend(row: {
  id: string;
  entryId: string;
  payDate: Date;
  amount: Prisma.Decimal;
  perShare: Prisma.Decimal | null;
  shares: Prisma.Decimal | null;
  note: string | null;
  bankEntryId: string | null;
  reinvestedAt: Date | null;
  reinvestAmount: Prisma.Decimal | null;
  reinvestPrice: Prisma.Decimal | null;
  reinvestUnits: Prisma.Decimal | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    entryId: row.entryId,
    payDate: row.payDate.toISOString(),
    amount: d(row.amount),
    perShare: dn(row.perShare),
    shares: dn(row.shares),
    note: row.note,
    bankEntryId: row.bankEntryId,
    reinvestedAt: row.reinvestedAt ? row.reinvestedAt.toISOString() : null,
    reinvestAmount: dn(row.reinvestAmount),
    reinvestPrice: dn(row.reinvestPrice),
    reinvestUnits: dn(row.reinvestUnits),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 寫一筆 EntryHistory 並把 Entry.value 移到新的 running balance，回傳 history id。
 * balance 的語意跟 entries.service.ts 一致：這一筆之後的餘額。
 */
async function postHistory(
  tx: Tx,
  entry: { id: string; value: Prisma.Decimal | number },
  delta: number,
  units: number | null,
  note: string | null
): Promise<string> {
  const balance = Number(entry.value) + delta;
  const row = await tx.entryHistory.create({
    data: { entryId: entry.id, delta, balance, units, note },
  });
  await tx.entry.update({ where: { id: entry.id }, data: { value: balance } });
  return row.id;
}

/** 擁有權 + 分類檢查合一。找不到或分類不符就丟，呼叫端不必各自判斷。 */
async function requireStockEntry(tx: Tx, entryId: string, userId: string) {
  const entry = await tx.entry.findFirst({ where: { id: entryId, userId } });
  if (!entry) throw new NotFoundError("股票項目不存在");
  if (!STOCK_CATS.includes(entry.subCategory) || !entry.stockCode) {
    throw new ConflictError("此項目不是股票，無法記錄股利");
  }
  return entry;
}

async function requireCashEntry(tx: Tx, entryId: string, userId: string) {
  const entry = await tx.entry.findFirst({ where: { id: entryId, userId } });
  if (!entry) throw new NotFoundError("入帳帳戶不存在");
  if (entry.topCategory !== CASH_TOP_CATEGORY) {
    throw new ConflictError("入帳帳戶必須是流動資金");
  }
  return entry;
}

export class DividendsService {
  async create(data: CreateDividend, userId: string) {
    if (!(await entitlementsService.isPremium(userId))) throw new PremiumRequiredError();

    return prisma.$transaction(async (tx) => {
      const stock = await requireStockEntry(tx, data.entryId, userId);

      let bankHistoryId: string | null = null;
      if (data.bankEntryId) {
        const bank = await requireCashEntry(tx, data.bankEntryId, userId);
        bankHistoryId = await postHistory(tx, bank, data.amount, null, `${stock.name} 股利`);
      }

      let transactionId: string | null = null;
      if (data.recordIncome) {
        const txRow = await tx.transaction.create({
          data: {
            userId,
            type: "income",
            amount: data.amount,
            category: "股利",
            source: stock.name,
            date: new Date(data.payDate),
            note: data.note ?? null,
          },
        });
        transactionId = txRow.id;
      }

      const row = await tx.dividend.create({
        data: {
          userId,
          entryId: data.entryId,
          payDate: new Date(data.payDate),
          amount: data.amount,
          perShare: data.perShare ?? null,
          shares: data.shares ?? null,
          note: data.note ?? null,
          bankEntryId: data.bankEntryId ?? null,
          bankHistoryId,
          transactionId,
        },
      });
      return serializeDividend(row);
    });
  }

  async list(userId: string, entryId?: string) {
    const rows = await prisma.dividend.findMany({
      where: { userId, ...(entryId ? { entryId } : {}) },
      orderBy: { payDate: "desc" },
    });
    return rows.map(serializeDividend);
  }
}

export const dividendsService = new DividendsService();
