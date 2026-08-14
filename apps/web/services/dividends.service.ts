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

/**
 * 刪掉一筆 EntryHistory 並把帳修回去。規則完全照 entries.service.ts 的
 * deleteHistory：後續 history 的 running balance 一起位移，Entry.value 由
 * 剩下的最後一筆 balance 回推（一筆都不剩時歸 0）。
 */
async function reverseHistory(tx: Tx, historyId: string): Promise<void> {
  const existing = await tx.entryHistory.findFirst({ where: { id: historyId } });
  if (!existing) return;
  const delta = Number(existing.delta);

  await tx.entryHistory.delete({ where: { id: historyId } });

  await tx.entryHistory.updateMany({
    where: { entryId: existing.entryId, createdAt: { gt: existing.createdAt } },
    data: { balance: { increment: -delta } },
  });

  const last = await tx.entryHistory.findFirst({
    where: { entryId: existing.entryId },
    orderBy: { createdAt: "desc" },
  });
  await tx.entry.update({
    where: { id: existing.entryId },
    data: { value: last ? Number(last.balance) : 0 },
  });
}

/**
 * 把一筆 dividend 造成的所有帳面影響沖掉（history 與收入 transaction），但不刪
 * dividend 本身 —— delete 會刪掉它，update 會接著重放。
 *
 * 沖銷順序是「後寫的先沖」：再投資的兩筆晚於入帳那筆，所以照寫入順序反過來刪。
 * 這不是為了讓算式跑得出正確答案 —— updateMany 只動 balance 不動 delta，且
 * Entry.value 是等所有列都刪完後才由 reverseHistory 用剩下最新一筆回推，兩種
 * 順序最終算出來的帳都一樣。反著刪純粹是遵循「後進先出」的慣例，讀起來直覺。
 */
async function unwind(
  tx: Tx,
  dividend: {
    id: string;
    userId: string;
    bankHistoryId: string | null;
    transactionId: string | null;
    reinvestHistoryId: string | null;
    reinvestBankHistoryId: string | null;
  }
): Promise<void> {
  if (dividend.reinvestHistoryId) await reverseHistory(tx, dividend.reinvestHistoryId);
  if (dividend.reinvestBankHistoryId) await reverseHistory(tx, dividend.reinvestBankHistoryId);
  if (dividend.bankHistoryId) await reverseHistory(tx, dividend.bankHistoryId);
  if (dividend.transactionId) {
    await tx.transaction.deleteMany({
      where: { id: dividend.transactionId, userId: dividend.userId },
    });
  }
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

  async delete(id: string, userId: string) {
    await prisma.$transaction(async (tx) => {
      const dividend = await tx.dividend.findFirst({ where: { id, userId } });
      if (!dividend) throw new NotFoundError("股利紀錄不存在");
      await unwind(tx, dividend);
      await tx.dividend.delete({ where: { id } });
    });
  }
}

export const dividendsService = new DividendsService();
