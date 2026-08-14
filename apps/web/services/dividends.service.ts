import type { Prisma } from "@prisma/client";
import type { CreateDividend, ReinvestDividend, UpdateDividend } from "@repo/shared";
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

  async reinvest(id: string, data: ReinvestDividend, userId: string) {
    if (!(await entitlementsService.isPremium(userId))) throw new PremiumRequiredError();

    return prisma.$transaction(async (tx) => {
      const dividend = await tx.dividend.findFirst({ where: { id, userId } });
      if (!dividend) throw new NotFoundError("股利紀錄不存在");
      if (dividend.reinvestedAt) throw new ConflictError("這筆股利已經再投資過了");
      if (data.amount > Number(dividend.amount)) {
        throw new ConflictError("再投資金額不可超過股利金額");
      }

      const stock = await requireStockEntry(tx, dividend.entryId, userId);
      const units = data.amount / data.price;

      // 銀行端先扣：錢要先離開帳戶才進股票，兩筆 history 的時序才讀得懂。
      // 沒有入帳帳戶的股利代表這筆錢從未進入帳面，自然無從扣除。
      let reinvestBankHistoryId: string | null = null;
      if (dividend.bankEntryId) {
        const bank = await requireCashEntry(tx, dividend.bankEntryId, userId);
        reinvestBankHistoryId = await postHistory(
          tx,
          bank,
          -data.amount,
          null,
          `${stock.name} 股利再投資`
        );
      }

      const reinvestHistoryId = await postHistory(tx, stock, data.amount, units, "股利再投資");

      const row = await tx.dividend.update({
        where: { id },
        data: {
          reinvestedAt: new Date(),
          reinvestAmount: data.amount,
          reinvestPrice: data.price,
          reinvestUnits: units,
          reinvestHistoryId,
          reinvestBankHistoryId,
        },
      });
      return serializeDividend(row);
    });
  }

  /**
   * 先完整沖銷再重放，而不是就地調整差額。就地調整在「換了入帳帳戶」時會把
   * 差額記到錯的帳上；沖銷重放只有一套規則，也就只有一處會錯。
   *
   * 已再投資的股利不能改金額 —— 再投資是另一筆既成事實，改了會讓兩者對不上。
   * 要改就整筆刪掉重建。
   */
  async update(id: string, data: UpdateDividend, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.dividend.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("股利紀錄不存在");
      if (existing.reinvestedAt && data.amount !== undefined) {
        throw new ConflictError("已再投資的股利不可修改金額，請刪除後重新建立");
      }

      const stock = await requireStockEntry(tx, existing.entryId, userId);

      const amount = data.amount ?? Number(existing.amount);
      const payDate = data.payDate ? new Date(data.payDate) : existing.payDate;
      const note = data.note === undefined ? existing.note : data.note;
      const bankEntryId = data.bankEntryId === undefined ? existing.bankEntryId : data.bankEntryId;
      const hadIncome = existing.transactionId !== null;

      await unwind(tx, existing);

      let bankHistoryId: string | null = null;
      if (bankEntryId) {
        const bank = await requireCashEntry(tx, bankEntryId, userId);
        bankHistoryId = await postHistory(tx, bank, amount, null, `${stock.name} 股利`);
      }

      let transactionId: string | null = null;
      if (hadIncome) {
        const txRow = await tx.transaction.create({
          data: {
            userId,
            type: "income",
            amount,
            category: "股利",
            source: stock.name,
            date: payDate,
            note: note ?? null,
          },
        });
        transactionId = txRow.id;
      }

      // 沖銷把再投資那兩筆也刪掉了，所以 reinvest* 一併歸零 —— 使用者要重新
      // 按一次再投資。這是刻意的：金額或帳戶變了，舊的再投資已不成立。
      const row = await tx.dividend.update({
        where: { id },
        data: {
          payDate,
          amount,
          note: note ?? null,
          bankEntryId,
          bankHistoryId,
          transactionId,
          reinvestedAt: null,
          reinvestAmount: null,
          reinvestPrice: null,
          reinvestUnits: null,
          reinvestHistoryId: null,
          reinvestBankHistoryId: null,
        },
      });
      return serializeDividend(row);
    });
  }

  /**
   * yieldOnCost 用「本年度股利 ÷ 累計成本」。costBasis 是該 entry 所有
   * EntryHistory.delta 之和，因此包含再投資產生的成本 —— 再投資確實增加了成本
   * 基礎，殖利率隨之略降是正確的，不是 bug。
   */
  async summary(userId: string) {
    const currentYear = new Date().getFullYear();

    // Dividend rows can only exist against an entry that passed
    // requireStockEntry at creation time — so build the id set from the
    // dividends themselves rather than re-filtering entries by subCategory.
    // subCategory is a mutable free string; filtering entries by it here
    // would let a later category edit silently drop an entry out of byEntry
    // while its amounts stayed in the totals, breaking sum(byEntry) ===
    // totalAllTime. This also means the entry read now depends on the
    // dividend read, so it can no longer run inside the same Promise.all.
    const dividends = await prisma.dividend.findMany({
      where: { userId },
      select: { entryId: true, amount: true, payDate: true },
    });

    const perEntry = new Map<string, { allTime: number; thisYear: number }>();
    let totalAllTime = 0;
    let totalThisYear = 0;

    for (const row of dividends) {
      const amount = Number(row.amount);
      const isThisYear = row.payDate.getUTCFullYear() === currentYear;
      totalAllTime += amount;
      if (isThisYear) totalThisYear += amount;

      const acc = perEntry.get(row.entryId) ?? { allTime: 0, thisYear: 0 };
      acc.allTime += amount;
      if (isThisYear) acc.thisYear += amount;
      perEntry.set(row.entryId, acc);
    }

    const entries = await prisma.entry.findMany({
      where: { userId, id: { in: [...perEntry.keys()] } },
      select: {
        id: true,
        name: true,
        stockCode: true,
        subCategory: true,
        history: { select: { delta: true } },
      },
    });

    const byEntry = entries
      .map((e) => {
        const acc = perEntry.get(e.id)!;
        const costBasis = e.history.reduce((s, h) => s + Number(h.delta), 0);
        return {
          entryId: e.id,
          name: e.name,
          stockCode: e.stockCode,
          subCategory: e.subCategory,
          totalAllTime: acc.allTime,
          totalThisYear: acc.thisYear,
          costBasis,
          yieldOnCost: costBasis > 0 ? acc.thisYear / costBasis : null,
        };
      })
      .sort((a, b) => b.totalAllTime - a.totalAllTime);

    return { totalAllTime, totalThisYear, byEntry };
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
