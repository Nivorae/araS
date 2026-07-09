import { create } from "zustand";
import type { Entry, Transaction, PortfolioItem, Recurrence, ValueSnapshot } from "@repo/shared";

export interface FinanceState {
  entries: Entry[];
  transactions: Transaction[];
  portfolio: PortfolioItem[];
  recurrences: Recurrence[];
  valueSnapshots: ValueSnapshot[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  setData: (
    data: Partial<
      Pick<
        FinanceState,
        "entries" | "transactions" | "portfolio" | "recurrences" | "valueSnapshots"
      >
    >
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  addEntryLocal: (entry: Entry) => void;
  updateEntryLocal: (id: string, entry: Entry) => void;
  deleteEntryLocal: (id: string) => void;

  addTransactionLocal: (tx: Transaction) => void;
  deleteTransactionLocal: (id: string) => void;

  addPortfolioItemLocal: (item: PortfolioItem) => void;
  updatePortfolioItemLocal: (id: string, item: PortfolioItem) => void;
  deletePortfolioItemLocal: (id: string) => void;

  addRecurrenceLocal: (rec: Recurrence) => void;
  updateRecurrenceLocal: (id: string, rec: Recurrence) => void;
  deleteRecurrenceLocal: (id: string) => void;
}

export function makeSnapshot(entries: Entry[]): ValueSnapshot {
  // Entries with 納入圖表 off (includeInChart === false) are excluded from the
  // net-worth chart. Undefined counts as included (legacy/default true).
  const charted = entries.filter((e) => e.includeInChart !== false);
  const totalAssets = charted
    .filter((e) => e.topCategory !== "負債")
    .reduce((s, e) => s + e.value, 0);
  const totalLiabilities = charted
    .filter((e) => e.topCategory === "負債")
    .reduce((s, e) => s + e.value, 0);
  return {
    id: Math.random().toString(36).slice(2),
    date: new Date().toISOString(),
    totalAssets,
    totalLiabilities,
  };
}

export const useFinanceStore = create<FinanceState>()((set) => ({
  entries: [],
  transactions: [],
  portfolio: [],
  recurrences: [],
  valueSnapshots: [],
  loading: false,
  error: null,
  lastFetchedAt: null,

  setData: (data) => set({ ...data, lastFetchedAt: Date.now() }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  addEntryLocal: (entry) =>
    set((s) => {
      const newEntries = [entry, ...s.entries.filter((e) => e.id !== entry.id)];
      return {
        entries: newEntries,
        valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
      };
    }),

  updateEntryLocal: (id, entry) =>
    set((s) => {
      const newEntries = s.entries.map((e) => (e.id === id ? entry : e));
      return {
        entries: newEntries,
        valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
      };
    }),

  deleteEntryLocal: (id) =>
    set((s) => {
      const newEntries = s.entries.filter((e) => e.id !== id);
      return {
        entries: newEntries,
        valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
      };
    }),

  addTransactionLocal: (tx) => set((s) => ({ transactions: [tx, ...s.transactions] })),

  deleteTransactionLocal: (id) =>
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

  addPortfolioItemLocal: (item) => set((s) => ({ portfolio: [item, ...s.portfolio] })),

  updatePortfolioItemLocal: (id, item) =>
    set((s) => ({ portfolio: s.portfolio.map((p) => (p.id === id ? item : p)) })),

  deletePortfolioItemLocal: (id) =>
    set((s) => ({ portfolio: s.portfolio.filter((p) => p.id !== id) })),

  addRecurrenceLocal: (rec) => set((s) => ({ recurrences: [...s.recurrences, rec] })),

  updateRecurrenceLocal: (id, rec) =>
    set((s) => ({
      recurrences: s.recurrences.map((r) => (r.id === id ? rec : r)),
    })),

  deleteRecurrenceLocal: (id) =>
    set((s) => ({ recurrences: s.recurrences.filter((r) => r.id !== id) })),
}));
