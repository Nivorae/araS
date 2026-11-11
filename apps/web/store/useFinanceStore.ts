"use client";

import { create } from "zustand";
import type {
  Entry,
  CreateEntry,
  UpdateEntry,
  Transaction,
  PortfolioItem,
  ValueSnapshot,
  CreateTransaction,
  CreatePortfolioItem,
  Recurrence,
  CreateRecurrence,
  UpdateRecurrence,
  NetWorthPoint,
  NetWorthRange,
  NetWorthHistory,
  TransferEntry,
} from "@repo/shared";

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.success) {
    // Keep the envelope's error code (e.g. ENTRY_LIMIT_REACHED) so callers can
    // branch on it instead of matching message text.
    throw Object.assign(new Error(json.error?.message ?? "API error"), {
      code: json.error?.code as string | undefined,
    });
  }
  return json.data as T;
}

// PUT /api/entries/:id returns the bare Entry row — no `units`, `loan` or
// `insurance`, which only the list endpoint joins in. Replacing the stored
// entry with it made those vanish until the next full fetch, so mutations
// merge the response over what the list gave us instead.
function mergeEntry(existing: Entry | undefined, updated: Entry): Entry {
  return existing ? { ...existing, ...updated } : updated;
}

// Net-worth requests in flight, per range, with the epoch each started under:
// concurrent callers share one request, and a request from an older epoch is
// neither shared nor allowed to write.
const netWorthInFlight = new Map<NetWorthRange, { epoch: number; promise: Promise<void> }>();

function makeSnapshot(entries: Entry[]): ValueSnapshot {
  // Entries with 納入圖表 off (includeInChart === false) are excluded from the
  // net-worth chart. Undefined counts as included (legacy/default true).
  const charted = entries.filter((e) => e.includeInChart !== false);
  const totalAssets = charted
    .filter((e) => e.topCategory !== "負債")
    .reduce((s, e) => s + e.value, 0);
  const totalLiabilities = charted
    .filter((e) => e.topCategory === "負債")
    .reduce((s, e) => s + e.value, 0);
  return { id: uuid(), date: now(), totalAssets, totalLiabilities };
}

interface FinanceState {
  entries: Entry[];
  transactions: Transaction[];
  portfolio: PortfolioItem[];
  recurrences: Recurrence[];
  valueSnapshots: ValueSnapshot[];
  // Net-worth history keyed by range, filled on demand by fetchNetWorthHistory.
  // Cleared whenever an entry mutation lands, since every mutation writes a
  // fresh EntryHistory row server-side and makes the cached points stale.
  netWorthHistory: Partial<Record<NetWorthRange, NetWorthPoint[]>>;
  // Bumped on every entry mutation and on reset. A net-worth request that
  // started under an older epoch is stale (a mutation landed mid-flight) and
  // must not write its points; the allocation view also revalidates on it.
  netWorthHistoryEpoch: number;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  isGuest: boolean;
  fetchAll: (isSignedIn?: boolean, opts?: { force?: boolean }) => Promise<void>;
  refreshEntries: () => Promise<void>;
  /** Drop everything cached for the current account (sign-out / account switch). */
  reset: () => void;
  /** Save only 納入圖表 and merge just that field — the PUT response lacks units/loan/insurance. */
  setEntryIncludeInChart: (id: string, includeInChart: boolean) => Promise<void>;
  fetchNetWorthHistory: (range: NetWorthRange) => Promise<void>;
  addEntry: (data: CreateEntry) => Promise<void>;
  updateEntry: (id: string, data: UpdateEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  transferEntry: (data: TransferEntry) => Promise<void>;
  addTransaction: (data: CreateTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addPortfolioItem: (data: CreatePortfolioItem) => Promise<void>;
  deletePortfolioItem: (id: string) => Promise<void>;
  addRecurrence: (data: CreateRecurrence) => Promise<void>;
  updateRecurrence: (id: string, data: UpdateRecurrence) => Promise<void>;
  deleteRecurrence: (id: string) => Promise<void>;
}

// valueSnapshots used to be persisted to localStorage, outliving sign-out so
// the next account in the same browser inherited them — and no UI reads them.
// Kept in memory only now; drop any copy an earlier version left behind.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("finance-store");
  } catch {
    // storage unavailable (private mode, blocked site data) — nothing to clear
  }
}

export const useFinanceStore = create<FinanceState>()((set, get) => ({
  entries: [],
  transactions: [],
  portfolio: [],
  recurrences: [],
  valueSnapshots: [],
  netWorthHistory: {},
  netWorthHistoryEpoch: 0,
  loading: true,
  error: null,
  lastFetchedAt: null,
  isGuest: false,

  fetchAll: async (isSignedIn?: boolean, opts?: { force?: boolean }) => {
    const { lastFetchedAt, isGuest } = get();

    // Called without auth state (from pages): only a forced refresh of the
    // current mode does anything; otherwise FinanceDataProvider owns loading.
    if (isSignedIn === undefined) {
      if (!opts?.force || lastFetchedAt === null) return;
      isSignedIn = !isGuest;
    }

    // Skip if auth state unchanged and cache is warm (30s)
    if (
      !opts?.force &&
      lastFetchedAt &&
      Date.now() - lastFetchedAt < 30_000 &&
      isGuest === !isSignedIn
    )
      return;

    if (!isSignedIn) {
      // Guest: load static demo data
      const demo = (await import("@/data/demo.json")).default;
      set((s) => {
        const snapshots =
          s.valueSnapshots.length === 0 && (demo.entries as unknown[]).length > 0
            ? [makeSnapshot(demo.entries as Parameters<typeof makeSnapshot>[0])]
            : s.valueSnapshots;
        return {
          entries: demo.entries as typeof s.entries,
          transactions: demo.transactions as typeof s.transactions,
          portfolio: demo.portfolio as typeof s.portfolio,
          valueSnapshots: snapshots,
          isGuest: true,
          loading: false,
          error: null,
          lastFetchedAt: Date.now(),
        };
      });
      return;
    }

    // Signed in: keep showing what's cached while refetching — only the first
    // load (nothing cached yet) shows the spinner.
    set((s) => ({
      isGuest: false,
      loading: s.lastFetchedAt === null || s.isGuest,
      error: null,
    }));
    try {
      const [entries, portfolio] = await Promise.all([
        apiFetch<Entry[]>("/api/entries"),
        apiFetch<PortfolioItem[]>("/api/portfolio"),
      ]);
      await apiFetch<{ created: number }>("/api/recurrences/process", { method: "POST" });
      const [recurrences, updatedTransactions] = await Promise.all([
        apiFetch<Recurrence[]>("/api/recurrences"),
        apiFetch<Transaction[]>("/api/transactions"),
      ]);
      set((s) => {
        const snapshots =
          s.valueSnapshots.length === 0 && entries.length > 0
            ? [makeSnapshot(entries)]
            : s.valueSnapshots;
        return {
          entries,
          transactions: updatedTransactions,
          portfolio,
          recurrences,
          valueSnapshots: snapshots,
          loading: false,
          lastFetchedAt: Date.now(),
        };
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to fetch data" });
    }
  },

  // Unconditional re-fetch of entries, bypassing fetchAll's cache guard.
  // Needed by mutations that happen outside addEntry/updateEntry/deleteEntry
  // (e.g. insurance writes, which go through their own /api/insurances
  // routes and return an Insurance record, not an Entry) so the list
  // reflects the change immediately instead of only on next sign-in.
  refreshEntries: async () => {
    if (get().isGuest) return;
    const entries = await apiFetch<Entry[]>("/api/entries");
    set((s) => ({
      entries,
      netWorthHistory: {},
      netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
    }));
  },

  reset: () => {
    netWorthInFlight.clear();
    set((s) => ({
      entries: [],
      transactions: [],
      portfolio: [],
      recurrences: [],
      valueSnapshots: [],
      netWorthHistory: {},
      netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
      loading: true,
      error: null,
      lastFetchedAt: null,
    }));
  },

  setEntryIncludeInChart: async (id, includeInChart) => {
    if (get().isGuest) {
      set((s) => ({
        entries: s.entries.map((e) => (e.id === id ? { ...e, includeInChart } : e)),
      }));
      return;
    }
    const saved = await apiFetch<Entry>(`/api/entries/${id}`, {
      method: "PUT",
      body: JSON.stringify({ includeInChart }),
    });
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id ? { ...e, includeInChart: saved.includeInChart } : e
      ),
      netWorthHistory: {},
      netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
    }));
  },

  // Cached per range — the server rebuilds these points from EntryHistory,
  // so an already-fetched range doesn't change until an entry mutation
  // clears the whole cache (see addEntry/updateEntry/deleteEntry below).
  fetchNetWorthHistory: async (range) => {
    if (get().netWorthHistory[range]) return;
    // Guests browse static demo data — there is no server history to ask for
    // (the route would answer 401), so the chart shows its empty state.
    if (get().isGuest) {
      set((s) => ({ netWorthHistory: { ...s.netWorthHistory, [range]: [] } }));
      return;
    }
    const epoch = get().netWorthHistoryEpoch;
    const pending = netWorthInFlight.get(range);
    if (pending && pending.epoch === epoch) return pending.promise;
    const promise = apiFetch<NetWorthHistory>(`/api/entries/net-worth-history?range=${range}`)
      .then((history) => {
        // A mutation (or account switch) landed while this was in flight —
        // its points predate it, so drop them rather than pin stale data.
        if (get().netWorthHistoryEpoch !== epoch) return;
        set((s) => ({ netWorthHistory: { ...s.netWorthHistory, [range]: history.points } }));
      })
      .finally(() => {
        if (netWorthInFlight.get(range)?.promise === promise) netWorthInFlight.delete(range);
      });
    netWorthInFlight.set(range, { epoch, promise });
    return promise;
  },

  addEntry: async (data) => {
    if (get().isGuest) {
      const fakeEntry = {
        ...data,
        id: `demo-${Date.now()}`,
        stockCode: (data as { stockCode?: string | null }).stockCode ?? null,
        bankCode: (data as { bankCode?: string | null }).bankCode ?? null,
        loan: null,
        units: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((s) => ({ entries: [...s.entries, fakeEntry as (typeof s.entries)[0]] }));
      return;
    }

    const entry = await apiFetch<Entry>("/api/entries", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => {
      const newEntries = [entry, ...s.entries.filter((e) => e.id !== entry.id)];
      return {
        entries: newEntries,
        valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
        netWorthHistory: {},
        netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
      };
    });
  },

  updateEntry: async (id, data) => {
    if (get().isGuest) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === id ? ({ ...e, ...data } as (typeof s.entries)[0]) : e
        ),
      }));
      return;
    }

    const entry = await apiFetch<Entry>(`/api/entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((s) => {
      const newEntries = s.entries.map((e) => (e.id === id ? mergeEntry(e, entry) : e));
      return {
        entries: newEntries,
        valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
        netWorthHistory: {},
        netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
      };
    });
  },

  deleteEntry: async (id) => {
    if (get().isGuest) {
      set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
      return;
    }

    await apiFetch(`/api/entries/${id}`, { method: "DELETE" });
    set((s) => {
      const newEntries = s.entries.filter((e) => e.id !== id);
      return {
        entries: newEntries,
        valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
        netWorthHistory: {},
        netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
      };
    });
  },

  transferEntry: async (data) => {
    if (get().isGuest) {
      set((s) => {
        const from = s.entries.find((e) => e.id === data.fromEntryId);
        const to = s.entries.find((e) => e.id === data.toEntryId);
        if (!from || !to) return s;
        const fee = data.fee ?? 0;
        const newEntries = s.entries.map((e) => {
          if (e.id === from.id) return { ...e, value: e.value - data.amount - fee };
          if (e.id === to.id) return { ...e, value: e.value + data.amount };
          return e;
        });
        return {
          entries: newEntries,
          valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
        };
      });
      return;
    }

    // Not routed through apiFetch — the caller needs the error `code`
    // (e.g. INSUFFICIENT_BALANCE) to show a specific message, and
    // apiFetch's thrown Error only carries the message text.
    const res = await fetch("/api/entries/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      throw Object.assign(new Error(json.error?.message ?? "轉帳失敗"), {
        code: json.error?.code as string | undefined,
      });
    }

    const entries = await apiFetch<Entry[]>("/api/entries");
    set((s) => ({
      entries,
      valueSnapshots: [...s.valueSnapshots, makeSnapshot(entries)],
      netWorthHistory: {},
      netWorthHistoryEpoch: s.netWorthHistoryEpoch + 1,
    }));
  },

  addTransaction: async (data) => {
    if (get().isGuest) {
      const fakeTx = {
        ...data,
        id: `demo-${Date.now()}`,
        note: (data as { note?: string | null }).note ?? null,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ transactions: [...s.transactions, fakeTx as (typeof s.transactions)[0]] }));
      return;
    }

    const tx = await apiFetch<Transaction>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ transactions: [tx, ...s.transactions] }));
  },

  deleteTransaction: async (id) => {
    if (get().isGuest) {
      set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      return;
    }

    await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  addPortfolioItem: async (data) => {
    if (get().isGuest) {
      const fakeItem = {
        ...data,
        id: `demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((s) => ({ portfolio: [...s.portfolio, fakeItem as (typeof s.portfolio)[0]] }));
      return;
    }

    const item = await apiFetch<PortfolioItem>("/api/portfolio", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ portfolio: [item, ...s.portfolio] }));
  },

  deletePortfolioItem: async (id) => {
    if (get().isGuest) {
      set((s) => ({ portfolio: s.portfolio.filter((p) => p.id !== id) }));
      return;
    }

    await apiFetch(`/api/portfolio/${id}`, { method: "DELETE" });
    set((s) => ({ portfolio: s.portfolio.filter((p) => p.id !== id) }));
  },

  addRecurrence: async (data) => {
    const item = await apiFetch<Recurrence>("/api/recurrences", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ recurrences: [...s.recurrences, item] }));
  },

  updateRecurrence: async (id, data) => {
    const item = await apiFetch<Recurrence>(`/api/recurrences/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((s) => ({
      recurrences: s.recurrences.map((r) => (r.id === id ? item : r)),
    }));
  },

  deleteRecurrence: async (id) => {
    await apiFetch(`/api/recurrences/${id}`, { method: "DELETE" });
    set((s) => ({ recurrences: s.recurrences.filter((r) => r.id !== id) }));
  },
}));
