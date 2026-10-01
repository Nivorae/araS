import {
  LIABILITY_TOP_CATEGORIES,
  TRANSFER_TOP_CATEGORIES,
  type AssetAllocation,
  type CreateDividend,
  type CreateEntry,
  type CreateInsurance,
  type CreateLoan,
  type CreatePortfolioItem,
  type CreateRecurrence,
  type CreateTransaction,
  type Dividend,
  type DividendSummary,
  type Entry,
  type EntryHistory,
  type Insurance,
  type Loan,
  type NetWorthHistory,
  type NetWorthRange,
  type PortfolioItem,
  type Recurrence,
  type ReinvestDividend,
  type Transaction,
  type TransferEntry,
  type TransferResult,
  type UpdateDividend,
  type UpdateEntry,
  type UpdateEntryHistory,
  type UpdateInsurance,
  type UpdateLoan,
  type UpdatePortfolioItem,
  type UpdateRecurrence,
} from "@repo/shared";
import { buildSeed } from "./seed";
import { DemoError, type DemoDividend, type DemoState } from "./types";

// 示範模式的假後端：apps/web/services/* 去掉 Prisma、userId 與付費檢查後的版本。
// 後端改了計算方式時這裡不會自動跟上 —— 行為有疑問以 services 為準。

export const notFound = (message = "Not found") => new DemoError("NOT_FOUND", message, 404);
export const conflict = (message: string) => new DemoError("CONFLICT", message, 409);
export const invalid = (message: string) => new DemoError("VALIDATION_ERROR", message, 400);

/** 表單送來的日期可能是 "2026-09-01"；一律存成完整 ISO，字串排序才等於時間排序。 */
export function toIso(value: string): string {
  return new Date(value).toISOString();
}

/** 只留下有給值的欄位，PATCH 的「沒帶 = 不動」語意靠它。 */
function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MAX_MONTHLY_BUCKETS = 24;

function monthlyBuckets(count: number, endYear: number, endMonth: number, nowMs: number) {
  return Array.from({ length: count }, (_, i) => {
    const offset = endMonth - (count - 1 - i);
    return {
      period: MONTH_LABELS[((offset % 12) + 12) % 12]!,
      end: Math.min(Date.UTC(endYear, offset + 1, 1), nowMs),
    };
  });
}

function buildBuckets(range: NetWorthRange, earliestMs: number) {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (range !== "all") return monthlyBuckets(range === "1y" ? 12 : 6, year, month, nowMs);

  const earliest = new Date(earliestMs);
  const spanMonths = (year - earliest.getUTCFullYear()) * 12 + (month - earliest.getUTCMonth());
  if (spanMonths <= MAX_MONTHLY_BUCKETS) return monthlyBuckets(spanMonths + 1, year, month, nowMs);

  const firstYear = earliest.getUTCFullYear();
  return Array.from({ length: year - firstYear + 1 }, (_, i) => ({
    period: `${firstYear + i}`,
    end: Math.min(Date.UTC(firstYear + i + 1, 0, 1), nowMs),
  }));
}

const STOCK_CATS = ["台股", "美股", "加密貨幣", "貴金屬"];
const CASH_TOP_CATEGORY = "流動資金";

// 照抄 recurrences.service.ts 的 computeInitialNextRunAt：起始日當天或之後的第一次。
function initialNextRunAt(
  frequency: Recurrence["frequency"],
  startDate: Date,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
  monthOfYear?: number | null
): Date {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  switch (frequency) {
    case "MONTHLY": {
      const dom = dayOfMonth ?? 1;
      const candidate = new Date(start.getFullYear(), start.getMonth(), dom);
      if (candidate < start) candidate.setMonth(candidate.getMonth() + 1);
      const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
      candidate.setDate(Math.min(dom, lastDay));
      return candidate;
    }
    case "WEEKLY":
    case "BIWEEKLY": {
      const candidate = new Date(start);
      candidate.setDate(candidate.getDate() + (((dayOfWeek ?? 0) - candidate.getDay() + 7) % 7));
      return candidate;
    }
    case "YEARLY": {
      const candidate = new Date(start.getFullYear(), (monthOfYear ?? 1) - 1, dayOfMonth ?? 1);
      if (candidate < start) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    }
  }
}

// 對外的 Dividend 不帶那四個內部關聯欄位。
function toDividend(row: DemoDividend): Dividend {
  return {
    id: row.id,
    entryId: row.entryId,
    payDate: row.payDate,
    amount: row.amount,
    perShare: row.perShare,
    shares: row.shares,
    note: row.note,
    bankEntryId: row.bankEntryId,
    reinvestedAt: row.reinvestedAt,
    reinvestAmount: row.reinvestAmount,
    reinvestPrice: row.reinvestPrice,
    reinvestUnits: row.reinvestUnits,
    createdAt: row.createdAt,
  };
}

export class DemoEngine {
  protected state: DemoState;
  private seq = 0;
  private lastStampMs = 0;

  constructor(now: Date = new Date()) {
    this.state = buildSeed(now);
  }

  protected nextId(kind: string): string {
    return `demo-${kind}-${++this.seq}`;
  }

  // 同一毫秒內連寫兩筆歷史時，「晚於這一筆」的判斷會失準，所以時間戳保證遞增。
  protected stamp(): string {
    this.lastStampMs = Math.max(Date.now(), this.lastStampMs + 1);
    return new Date(this.lastStampMs).toISOString();
  }

  protected requireEntry(id: string, message = "項目不存在"): Entry {
    const entry = this.state.entries.find((e) => e.id === id);
    if (!entry) throw notFound(message);
    return entry;
  }

  private rowsOf(entryId: string): EntryHistory[] {
    return this.state.history.filter((h) => h.entryId === entryId);
  }

  // 列表 API 的形狀：units 是該筆所有歷史的單位數加總，沒有任何一筆帶單位數就是 null。
  protected shape(entry: Entry): Entry {
    const rows = this.rowsOf(entry.id);
    const units = rows.some((h) => h.units != null)
      ? rows.reduce((sum, h) => sum + (h.units ?? 0), 0)
      : null;
    return { ...entry, units };
  }

  /** 寫一筆歷史並把 Entry.value 移到新的餘額，回傳歷史 id。 */
  protected postHistory(
    entry: Entry,
    delta: number,
    units: number | null,
    note: string | null
  ): string {
    const id = this.nextId("history");
    const createdAt = this.stamp();
    entry.value += delta;
    entry.updatedAt = createdAt;
    this.state.history.push({
      id,
      entryId: entry.id,
      delta,
      balance: entry.value,
      units,
      pricePerShare: null,
      note,
      createdAt,
    });
    return id;
  }

  /** 刪掉一筆歷史並把帳修回去：後續各筆餘額位移，Entry.value 由剩下的最後一筆回推。 */
  protected reverseHistory(historyId: string): void {
    const existing = this.state.history.find((h) => h.id === historyId);
    if (!existing) return;
    this.state.history = this.state.history.filter((h) => h.id !== historyId);
    this.shiftLaterBalances(existing, -existing.delta);
    this.syncValueFromHistory(existing.entryId);
  }

  private shiftLaterBalances(anchor: EntryHistory, diff: number): void {
    for (const row of this.state.history) {
      if (row.entryId === anchor.entryId && row.createdAt > anchor.createdAt) row.balance += diff;
    }
  }

  private syncValueFromHistory(entryId: string): void {
    const entry = this.state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const last = this.rowsOf(entryId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    entry.value = last ? last.balance : 0;
  }

  // ── Entries ────────────────────────────────────────────────────────────────

  listEntries(): Entry[] {
    return [...this.state.entries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((e) => this.shape(e));
  }

  createEntry(data: CreateEntry): Entry {
    const createdAt = data.createdAt ? toIso(data.createdAt) : this.stamp();
    const entry: Entry = {
      id: this.nextId("entry"),
      name: data.name,
      topCategory: data.topCategory,
      subCategory: data.subCategory,
      stockCode: data.stockCode ?? null,
      bankCode: data.bankCode ?? null,
      note: data.note ?? null,
      value: data.value,
      includeInChart: data.includeInChart ?? true,
      createdAt,
      updatedAt: createdAt,
      loan: null,
      insurance: null,
    };
    this.state.entries.push(entry);
    this.state.history.push({
      id: this.nextId("history"),
      entryId: entry.id,
      delta: data.value,
      balance: data.value,
      units: data.units ?? null,
      pricePerShare: data.pricePerShare ?? null,
      note: null,
      createdAt,
    });
    return this.shape(entry);
  }

  updateEntry(id: string, data: UpdateEntry): Entry {
    const entry = this.requireEntry(id);
    const previous = entry.value;
    // createdAt 不是改 Entry 的欄位，它是新增那筆歷史的日期（補登用）。
    const { units, pricePerShare, createdAt, ...fields } = data;
    Object.assign(entry, defined(fields));
    entry.updatedAt = this.stamp();
    if (data.value !== undefined) {
      this.state.history.push({
        id: this.nextId("history"),
        entryId: id,
        delta: entry.value - previous,
        balance: entry.value,
        units: units ?? null,
        pricePerShare: pricePerShare ?? null,
        note: data.note ?? null,
        createdAt: createdAt ? toIso(createdAt) : this.stamp(),
      });
    }
    return this.shape(entry);
  }

  deleteEntry(id: string): void {
    this.requireEntry(id);
    this.state.entries = this.state.entries.filter((e) => e.id !== id);
    this.state.history = this.state.history.filter((h) => h.entryId !== id);
    // 後端靠外鍵 cascade；這裡要自己清，否則列表與統計會出現孤兒。
    this.state.insurances = this.state.insurances.filter((i) => i.entryId !== id);
    this.state.dividends = this.state.dividends.filter((d) => d.entryId !== id);
    this.state.recurrences = this.state.recurrences.filter((r) => r.entryId !== id);
  }

  entryHistory(id: string): EntryHistory[] {
    this.requireEntry(id);
    return this.rowsOf(id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => ({ ...row }));
  }

  private requireHistory(entryId: string, historyId: string): EntryHistory {
    const row = this.state.history.find((h) => h.id === historyId && h.entryId === entryId);
    if (!row) throw notFound("紀錄不存在");
    return row;
  }

  updateHistory(entryId: string, historyId: string, data: UpdateEntryHistory): EntryHistory {
    const row = this.requireHistory(entryId, historyId);
    const diff = (data.delta ?? row.delta) - row.delta;
    // 位移要以「修改前」的時間為準，所以先移後面的，再改這一筆。
    if (diff !== 0) this.shiftLaterBalances(row, diff);
    if (data.note !== undefined) row.note = data.note;
    if (data.createdAt !== undefined) row.createdAt = toIso(data.createdAt);
    if (data.units !== undefined) row.units = data.units;
    if (data.pricePerShare !== undefined) row.pricePerShare = data.pricePerShare;
    row.delta += diff;
    row.balance += diff;
    if (diff !== 0) this.syncValueFromHistory(entryId);
    return { ...row };
  }

  deleteHistory(entryId: string, historyId: string): void {
    this.requireHistory(entryId, historyId);
    this.reverseHistory(historyId);
  }

  transfer(data: TransferEntry): TransferResult {
    if (data.fromEntryId === data.toEntryId) throw invalid("來源與目標項目不能相同");
    const from = this.requireEntry(data.fromEntryId, "來源項目不存在");
    const to = this.requireEntry(data.toEntryId, "目標項目不存在");
    if (
      !TRANSFER_TOP_CATEGORIES.includes(from.topCategory) ||
      !TRANSFER_TOP_CATEGORIES.includes(to.topCategory)
    ) {
      throw invalid("轉帳僅限流動資金、負債、應收款之間");
    }
    const fee = data.fee ?? 0;
    const debit = data.amount + fee;
    if (from.value - debit < 0) throw invalid("來源項目餘額不足");

    const fromNote = data.note ?? `轉帳至「${to.name}」${fee > 0 ? `（含手續費 $${fee}）` : ""}`;
    const toNote = data.note ?? `轉帳自「${from.name}」`;
    const fromRowId = this.postHistory(from, -debit, null, fromNote);
    const toRowId = this.postHistory(to, data.amount, null, toNote);
    if (data.createdAt) {
      const createdAt = toIso(data.createdAt);
      for (const row of this.state.history) {
        if (row.id === fromRowId || row.id === toRowId) row.createdAt = createdAt;
      }
    }
    return { from: this.shape(from), to: this.shape(to) };
  }

  allocation(): AssetAllocation {
    let totalAssets = 0;
    let totalLiabilities = 0;
    const byTopCategory = new Map<string, number>();
    const assets: Entry[] = [];
    for (const entry of this.state.entries) {
      if (entry.includeInChart === false) continue;
      if (LIABILITY_TOP_CATEGORIES.includes(entry.topCategory)) {
        totalLiabilities += entry.value;
        continue;
      }
      totalAssets += entry.value;
      byTopCategory.set(
        entry.topCategory,
        (byTopCategory.get(entry.topCategory) ?? 0) + entry.value
      );
      assets.push(entry);
    }
    return {
      breakdown: [...byTopCategory.entries()]
        .map(([topCategory, value]) => ({
          topCategory,
          value,
          percentage: (value / totalAssets) * 100,
        }))
        .sort((a, b) => b.value - a.value),
      concentrationWarnings: assets
        .map((e) => ({ entryId: e.id, name: e.name, percentage: (e.value / totalAssets) * 100 }))
        .filter((w) => w.percentage >= 40),
      debtToAssetRatio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : null,
    };
  }

  netWorthHistory(range: NetWorthRange): NetWorthHistory {
    const charted = this.state.entries.filter((e) => e.includeInChart !== false);
    const ids = new Set(charted.map((e) => e.id));
    const rows = this.state.history
      .filter((h) => ids.has(h.entryId))
      .map((h) => ({ entryId: h.entryId, balance: h.balance, at: new Date(h.createdAt).getTime() }))
      .sort((a, b) => a.at - b.at);
    if (rows.length === 0) return { range, points: [] };

    const byEntry = new Map<string, { at: number; balance: number }[]>();
    for (const row of rows) {
      const list = byEntry.get(row.entryId);
      if (list) list.push(row);
      else byEntry.set(row.entryId, [row]);
    }

    // bucket 是遞增的，所以每筆資產的歷史用一個只往前走的游標讀一次就好。
    const cursors = new Map<string, number>();
    const balances = new Map<string, number>();
    const points = buildBuckets(range, rows[0]!.at).map((bucket) => {
      let totalAssets = 0;
      let totalLiabilities = 0;
      for (const entry of charted) {
        const list = byEntry.get(entry.id);
        if (!list) continue;
        let i = cursors.get(entry.id) ?? 0;
        while (i < list.length && list[i]!.at < bucket.end) {
          balances.set(entry.id, list[i]!.balance);
          i++;
        }
        cursors.set(entry.id, i);
        // 沒有值代表那時候這筆資產還不存在，不等於餘額 0。
        const balance = balances.get(entry.id);
        if (balance === undefined) continue;
        if (LIABILITY_TOP_CATEGORIES.includes(entry.topCategory)) totalLiabilities += balance;
        else totalAssets += balance;
      }
      return {
        period: bucket.period,
        date: new Date(bucket.end).toISOString(),
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
      };
    });
    return { range, points };
  }

  // ── Loans ──────────────────────────────────────────────────────────────────

  createLoan(data: CreateLoan): Entry {
    const created = this.createEntry({
      name: data.loanName,
      topCategory: "負債",
      subCategory: data.category,
      value: data.totalAmount,
      ...(data.includeInChart !== undefined ? { includeInChart: data.includeInChart } : {}),
    });
    const entry = this.requireEntry(created.id);
    entry.loan = {
      id: this.nextId("loan"),
      entryId: entry.id,
      loanName: data.loanName,
      totalAmount: data.totalAmount,
      annualInterestRate: data.annualInterestRate,
      termMonths: data.termMonths,
      startDate: toIso(data.startDate),
      gracePeriodMonths: data.gracePeriodMonths ?? 0,
      repaymentType: data.repaymentType,
      overrideTermMonths: null,
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
    };
    return this.shape(entry);
  }

  updateLoan(id: string, data: UpdateLoan): Loan & { entry: Entry } {
    const entry = this.state.entries.find((e) => e.loan?.id === id);
    const loan = entry?.loan;
    if (!entry || !loan) throw notFound("貸款不存在");

    if (data.loanName !== undefined) loan.loanName = data.loanName;
    if (data.annualInterestRate !== undefined) loan.annualInterestRate = data.annualInterestRate;
    if (data.termMonths !== undefined) loan.termMonths = data.termMonths;
    if (data.startDate !== undefined) loan.startDate = toIso(data.startDate);
    if (data.gracePeriodMonths !== undefined) loan.gracePeriodMonths = data.gracePeriodMonths;
    if (data.repaymentType !== undefined) loan.repaymentType = data.repaymentType;
    loan.updatedAt = this.stamp();

    if (data.loanName !== undefined) entry.name = data.loanName;
    if (data.includeInChart !== undefined) entry.includeInChart = data.includeInChart;
    // totalAmount 在這支 API 是「目前餘額」：只動 Entry 的值，不改貸款原始總額（後端同）。
    if (data.totalAmount !== undefined && data.totalAmount !== entry.value) {
      this.postHistory(entry, data.totalAmount - entry.value, null, "手動調整餘額");
    }
    return { ...loan, entry: this.shape(entry) };
  }

  // ── Insurance ──────────────────────────────────────────────────────────────

  createInsurance(data: CreateInsurance): Insurance & { entry: Entry } {
    const createdAt = this.stamp();
    const id = this.nextId("insurance");
    const entry: Entry = {
      id: this.nextId("entry"),
      name: data.policyName?.trim() || data.insurer,
      topCategory: "保險",
      subCategory: data.insuranceType,
      stockCode: null,
      bankCode: null,
      note: null,
      value: 0,
      includeInChart: false,
      createdAt,
      updatedAt: createdAt,
      loan: null,
      insurance: {
        id,
        insuranceType: data.insuranceType,
        insurer: data.insurer,
        insuredName: data.insuredName,
      },
    };
    this.state.entries.push(entry);
    this.state.history.push({
      id: this.nextId("history"),
      entryId: entry.id,
      delta: 0,
      balance: 0,
      units: null,
      pricePerShare: null,
      note: null,
      createdAt,
    });
    const insurance: Insurance = {
      id,
      entryId: entry.id,
      insurer: data.insurer,
      insuredName: data.insuredName,
      insuranceType: data.insuranceType,
      policyName: data.policyName ?? null,
      policyNumber: data.policyNumber ?? null,
      startDate: data.startDate ? toIso(data.startDate) : null,
      paymentTermYears: data.paymentTermYears ?? null,
      coveragePeriod: data.coveragePeriod ?? null,
      annualPremium: data.annualPremium ?? null,
      coverage: data.coverage ?? [],
      createdAt,
      updatedAt: createdAt,
    };
    this.state.insurances.push(insurance);
    return { ...insurance, entry: this.shape(entry) };
  }

  listInsurances(): Insurance[] {
    return [...this.state.insurances]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({ ...i }));
  }

  private requireInsurance(id: string): Insurance {
    const insurance = this.state.insurances.find((i) => i.id === id);
    if (!insurance) throw notFound("保單不存在");
    return insurance;
  }

  getInsurance(id: string): Insurance {
    return { ...this.requireInsurance(id) };
  }

  updateInsurance(id: string, data: UpdateInsurance): Insurance {
    const insurance = this.requireInsurance(id);
    const { startDate, coverage, ...fields } = data;
    Object.assign(insurance, defined(fields));
    if (startDate !== undefined) insurance.startDate = startDate ? toIso(startDate) : null;
    if (coverage !== undefined) insurance.coverage = coverage;
    insurance.updatedAt = this.stamp();

    // Entry 的名稱與列表上的摘要是建立時從保單抄來的，改保單要一起改。
    const entry = this.requireEntry(insurance.entryId);
    entry.name = insurance.policyName?.trim() || insurance.insurer;
    entry.subCategory = insurance.insuranceType;
    entry.insurance = {
      id,
      insuranceType: insurance.insuranceType,
      insurer: insurance.insurer,
      insuredName: insurance.insuredName,
    };
    return { ...insurance };
  }

  deleteInsurance(id: string): void {
    this.deleteEntry(this.requireInsurance(id).entryId);
  }

  // ── Dividends ──────────────────────────────────────────────────────────────

  private requireStockEntry(entryId: string): Entry {
    const entry = this.requireEntry(entryId, "股票項目不存在");
    if (!STOCK_CATS.includes(entry.subCategory) || !entry.stockCode) {
      throw conflict("此項目不是股票，無法記錄股利");
    }
    return entry;
  }

  private requireCashEntry(entryId: string): Entry {
    const entry = this.requireEntry(entryId, "入帳帳戶不存在");
    if (entry.topCategory !== CASH_TOP_CATEGORY) throw conflict("入帳帳戶必須是流動資金");
    return entry;
  }

  private requireDividend(id: string): DemoDividend {
    const dividend = this.state.dividends.find((d) => d.id === id);
    if (!dividend) throw notFound("股利紀錄不存在");
    return dividend;
  }

  private postIncome(stock: Entry, amount: number, payDate: string, note: string | null): string {
    const id = this.nextId("tx");
    this.state.transactions.push({
      id,
      type: "income",
      amount,
      category: "股利",
      // 後端把股票名稱寫進 source 欄位，這裡照抄它的行為。
      source: stock.name as Transaction["source"],
      note,
      date: payDate,
      createdAt: this.stamp(),
    });
    return id;
  }

  /** 把一筆股息造成的帳面影響全部沖掉（歷史與收入交易），但不刪股息本身。 */
  private unwind(dividend: DemoDividend): void {
    if (dividend.reinvestHistoryId) this.reverseHistory(dividend.reinvestHistoryId);
    if (dividend.reinvestBankHistoryId) this.reverseHistory(dividend.reinvestBankHistoryId);
    if (dividend.bankHistoryId) this.reverseHistory(dividend.bankHistoryId);
    if (dividend.transactionId) {
      this.state.transactions = this.state.transactions.filter(
        (t) => t.id !== dividend.transactionId
      );
    }
  }

  listDividends(entryId?: string): Dividend[] {
    return this.state.dividends
      .filter((d) => !entryId || d.entryId === entryId)
      .sort((a, b) => b.payDate.localeCompare(a.payDate))
      .map(toDividend);
  }

  createDividend(data: CreateDividend): Dividend {
    const stock = this.requireStockEntry(data.entryId);
    const bank = data.bankEntryId ? this.requireCashEntry(data.bankEntryId) : null;
    const payDate = toIso(data.payDate);
    const row: DemoDividend = {
      id: this.nextId("dividend"),
      entryId: data.entryId,
      payDate,
      amount: data.amount,
      perShare: data.perShare ?? null,
      shares: data.shares ?? null,
      note: data.note ?? null,
      bankEntryId: data.bankEntryId ?? null,
      reinvestedAt: null,
      reinvestAmount: null,
      reinvestPrice: null,
      reinvestUnits: null,
      createdAt: this.stamp(),
      bankHistoryId: bank ? this.postHistory(bank, data.amount, null, `${stock.name} 股利`) : null,
      transactionId:
        data.recordIncome !== false
          ? this.postIncome(stock, data.amount, payDate, data.note ?? null)
          : null,
      reinvestHistoryId: null,
      reinvestBankHistoryId: null,
    };
    this.state.dividends.push(row);
    return toDividend(row);
  }

  reinvestDividend(id: string, data: ReinvestDividend): Dividend {
    const dividend = this.requireDividend(id);
    if (dividend.reinvestedAt) throw conflict("這筆股利已經再投資過了");
    if (data.amount > dividend.amount) throw conflict("再投資金額不可超過股利金額");
    const stock = this.requireStockEntry(dividend.entryId);
    const bank = dividend.bankEntryId ? this.requireCashEntry(dividend.bankEntryId) : null;
    const units = data.amount / data.price;

    // 銀行端先扣：錢要先離開帳戶才進股票，兩筆歷史的時序才讀得懂。
    dividend.reinvestBankHistoryId = bank
      ? this.postHistory(bank, -data.amount, null, `${stock.name} 股利再投資`)
      : null;
    dividend.reinvestHistoryId = this.postHistory(stock, data.amount, units, "股利再投資");
    dividend.reinvestedAt = this.stamp();
    dividend.reinvestAmount = data.amount;
    dividend.reinvestPrice = data.price;
    dividend.reinvestUnits = units;
    return toDividend(dividend);
  }

  // 先完整沖銷再重放，而不是就地調整差額：換了入帳帳戶時，差額會記到錯的帳上。
  updateDividend(id: string, data: UpdateDividend): Dividend {
    const dividend = this.requireDividend(id);
    if (dividend.reinvestedAt) throw conflict("已再投資的股利不可修改，請刪除後重新建立");
    const stock = this.requireStockEntry(dividend.entryId);

    const amount = data.amount ?? dividend.amount;
    const payDate = data.payDate ? toIso(data.payDate) : dividend.payDate;
    const note = data.note === undefined ? dividend.note : data.note;
    const bankEntryId = data.bankEntryId === undefined ? dividend.bankEntryId : data.bankEntryId;
    // 帳戶先驗證再沖銷，驗證失敗時資料才不會停在沖到一半的狀態。
    const bank = bankEntryId ? this.requireCashEntry(bankEntryId) : null;
    const hadIncome = dividend.transactionId !== null;

    this.unwind(dividend);
    dividend.amount = amount;
    dividend.payDate = payDate;
    dividend.note = note;
    dividend.bankEntryId = bankEntryId;
    dividend.bankHistoryId = bank
      ? this.postHistory(bank, amount, null, `${stock.name} 股利`)
      : null;
    dividend.transactionId = hadIncome ? this.postIncome(stock, amount, payDate, note) : null;
    return toDividend(dividend);
  }

  deleteDividend(id: string): void {
    this.unwind(this.requireDividend(id));
    this.state.dividends = this.state.dividends.filter((d) => d.id !== id);
  }

  dividendSummary(): DividendSummary {
    const currentYear = new Date().getFullYear();
    const perEntry = new Map<string, { allTime: number; thisYear: number }>();
    let totalAllTime = 0;
    let totalThisYear = 0;
    for (const row of this.state.dividends) {
      const isThisYear = new Date(row.payDate).getUTCFullYear() === currentYear;
      totalAllTime += row.amount;
      if (isThisYear) totalThisYear += row.amount;
      const acc = perEntry.get(row.entryId) ?? { allTime: 0, thisYear: 0 };
      acc.allTime += row.amount;
      if (isThisYear) acc.thisYear += row.amount;
      perEntry.set(row.entryId, acc);
    }

    const byEntry = this.state.entries
      .filter((e) => perEntry.has(e.id))
      .map((e) => {
        const acc = perEntry.get(e.id)!;
        // 成本基礎是所有歷史 delta 的總和，包含再投資 —— 再投資確實增加了成本。
        const costBasis = this.state.history
          .filter((h) => h.entryId === e.id)
          .reduce((sum, h) => sum + h.delta, 0);
        return {
          entryId: e.id,
          name: e.name,
          stockCode: e.stockCode ?? null,
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

  // ── Transactions ───────────────────────────────────────────────────────────

  listTransactions(): Transaction[] {
    return [...this.state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ ...t }));
  }

  createTransaction(data: CreateTransaction): Transaction {
    const tx: Transaction = {
      id: this.nextId("tx"),
      type: data.type,
      amount: data.amount,
      category: data.category,
      source: data.source,
      note: data.note ?? null,
      date: toIso(data.date),
      createdAt: this.stamp(),
    };
    this.state.transactions.push(tx);
    return { ...tx };
  }

  deleteTransaction(id: string): void {
    if (!this.state.transactions.some((t) => t.id === id)) throw notFound("交易不存在");
    this.state.transactions = this.state.transactions.filter((t) => t.id !== id);
  }

  // ── Portfolio ──────────────────────────────────────────────────────────────

  listPortfolio(): PortfolioItem[] {
    return [...this.state.portfolio]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ ...p }));
  }

  createPortfolioItem(data: CreatePortfolioItem): PortfolioItem {
    const createdAt = this.stamp();
    const item: PortfolioItem = {
      id: this.nextId("portfolio"),
      symbol: data.symbol,
      name: data.name,
      avgCost: data.avgCost,
      shares: data.shares,
      createdAt,
      updatedAt: createdAt,
    };
    this.state.portfolio.push(item);
    return { ...item };
  }

  updatePortfolioItem(id: string, data: UpdatePortfolioItem): PortfolioItem {
    const item = this.state.portfolio.find((p) => p.id === id);
    if (!item) throw notFound("投資組合項目不存在");
    Object.assign(item, defined(data));
    item.updatedAt = this.stamp();
    return { ...item };
  }

  deletePortfolioItem(id: string): void {
    if (!this.state.portfolio.some((p) => p.id === id)) throw notFound("投資組合項目不存在");
    this.state.portfolio = this.state.portfolio.filter((p) => p.id !== id);
  }

  // ── Recurrences ────────────────────────────────────────────────────────────

  listRecurrences(): Recurrence[] {
    return [...this.state.recurrences]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({ ...r }));
  }

  createRecurrence(data: CreateRecurrence): Recurrence {
    this.requireEntry(data.entryId);
    const createdAt = this.stamp();
    const startDate = new Date(data.startDate);
    const rec: Recurrence = {
      id: this.nextId("recurrence"),
      entryId: data.entryId,
      type: data.type,
      amount: data.amount,
      category: data.category,
      source: data.source ?? "daily",
      note: data.note ?? null,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      monthOfYear: data.monthOfYear ?? null,
      startDate: startDate.toISOString(),
      nextRunAt: initialNextRunAt(
        data.frequency,
        startDate,
        data.dayOfMonth,
        data.dayOfWeek,
        data.monthOfYear
      ).toISOString(),
      lastRunAt: null,
      active: true,
      createdAt,
      updatedAt: createdAt,
    };
    this.state.recurrences.push(rec);
    return { ...rec };
  }

  updateRecurrence(id: string, data: UpdateRecurrence): Recurrence {
    const rec = this.state.recurrences.find((r) => r.id === id);
    if (!rec) throw notFound("定期交易不存在");
    const reschedule =
      data.frequency !== undefined ||
      data.dayOfMonth !== undefined ||
      data.dayOfWeek !== undefined ||
      data.monthOfYear !== undefined ||
      data.startDate !== undefined;
    const { startDate, ...fields } = data;
    Object.assign(rec, defined(fields));
    if (startDate !== undefined) rec.startDate = toIso(startDate);
    if (reschedule) {
      rec.nextRunAt = initialNextRunAt(
        rec.frequency,
        new Date(rec.startDate),
        rec.dayOfMonth,
        rec.dayOfWeek,
        rec.monthOfYear
      ).toISOString();
    }
    rec.updatedAt = this.stamp();
    return { ...rec };
  }

  deleteRecurrence(id: string): void {
    if (!this.state.recurrences.some((r) => r.id === id)) throw notFound("定期交易不存在");
    this.state.recurrences = this.state.recurrences.filter((r) => r.id !== id);
  }
}
