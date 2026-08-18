import { create } from "zustand";
import type {
  Entry,
  EntryHistory,
  Transaction,
  PortfolioItem,
  Recurrence,
  NetWorthPoint,
  NetWorthRange,
} from "@repo/shared";

export interface FinanceState {
  entries: Entry[];
  transactions: Transaction[];
  portfolio: PortfolioItem[];
  recurrences: Recurrence[];
  // Net-worth history keyed by range, filled on demand by fetchNetWorthHistory.
  // Each range is fetched once per session — the server rebuilds these points
  // from EntryHistory, so they don't change between range switches.
  netWorthHistory: Partial<Record<NetWorthRange, NetWorthPoint[]>>;
  // Bumped every time the cache above is dropped. An in-flight request that
  // started under an older epoch is stale by definition, so the fetcher can
  // tell "nobody has fetched this yet" apart from "this answer is for a
  // version of the data that no longer exists" and discard the latter.
  netWorthHistoryEpoch: number;
  // Per-entry history, keyed by entry id. Cached so re-opening an entry renders
  // its records immediately while a refetch runs in the background, instead of
  // dropping back to a loading state on every focus.
  historyByEntry: Record<string, EntryHistory[]>;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  setData: (
    data: Partial<Pick<FinanceState, "entries" | "transactions" | "portfolio" | "recurrences">>
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setEntryHistory: (entryId: string, rows: EntryHistory[]) => void;
  setNetWorthHistory: (range: NetWorthRange, points: NetWorthPoint[]) => void;

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

export const useFinanceStore = create<FinanceState>()((set) => ({
  entries: [],
  transactions: [],
  portfolio: [],
  recurrences: [],
  netWorthHistory: {},
  netWorthHistoryEpoch: 0,
  historyByEntry: {},
  loading: false,
  error: null,
  lastFetchedAt: null,

  setData: (data) => set({ ...data, lastFetchedAt: Date.now() }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setEntryHistory: (entryId, rows) =>
    set((s) => ({ historyByEntry: { ...s.historyByEntry, [entryId]: rows } })),

  setNetWorthHistory: (range, points) =>
    set((s) => ({ netWorthHistory: { ...s.netWorthHistory, [range]: points } })),

  // Every entry mutation writes an EntryHistory row server-side, so the cached
  // chart points for every range are stale the moment one lands. Dropping the
  // whole cache makes the next chart view refetch rather than show old numbers.
  addEntryLocal: (entry) =>
    set((s) => ({
      entries: [entry, ...s.entries.filter((e) => e.id !== entry.id)],
      netWorthHistory: {},
      netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
    })),

  updateEntryLocal: (id, entry) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? entry : e)),
      netWorthHistory: {},
      netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
    })),

  deleteEntryLocal: (id) =>
    set((s) => {
      const historyByEntry = { ...s.historyByEntry };
      delete historyByEntry[id];
      return {
        entries: s.entries.filter((e) => e.id !== id),
        historyByEntry,
        netWorthHistory: {},
        netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
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
