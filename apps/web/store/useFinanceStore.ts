"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Entry,
  CreateEntry,
  UpdateEntry,
  Transaction,
  PortfolioItem,
  ValueSnapshot,
  CreateTransaction,
  CreatePortfolioItem,
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
  if (!json.success) throw new Error(json.error?.message ?? "API error");
  return json.data as T;
}

function makeSnapshot(entries: Entry[]): ValueSnapshot {
  const totalAssets = entries
    .filter((e) => e.topCategory !== "負債")
    .reduce((s, e) => s + e.value, 0);
  const totalLiabilities = entries
    .filter((e) => e.topCategory === "負債")
    .reduce((s, e) => s + e.value, 0);
  return { id: uuid(), date: now(), totalAssets, totalLiabilities };
}

interface FinanceState {
  entries: Entry[];
  transactions: Transaction[];
  portfolio: PortfolioItem[];
  valueSnapshots: ValueSnapshot[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchAll: () => Promise<void>;
  addEntry: (data: CreateEntry) => Promise<void>;
  updateEntry: (id: string, data: UpdateEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addTransaction: (data: CreateTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addPortfolioItem: (data: CreatePortfolioItem) => Promise<void>;
  deletePortfolioItem: (id: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      entries: [],
      transactions: [],
      portfolio: [],
      valueSnapshots: [],
      loading: true,
      error: null,
      lastFetchedAt: null,

      fetchAll: async () => {
        const { lastFetchedAt } = get();
        if (lastFetchedAt && Date.now() - lastFetchedAt < 30_000) return;
        set({ loading: true, error: null });
        try {
          const [entries, transactions, portfolio] = await Promise.all([
            apiFetch<Entry[]>("/api/entries"),
            apiFetch<Transaction[]>("/api/transactions"),
            apiFetch<PortfolioItem[]>("/api/portfolio"),
          ]);
          set((s) => {
            const snapshots =
              s.valueSnapshots.length === 0 && entries.length > 0
                ? [makeSnapshot(entries)]
                : s.valueSnapshots;
            return {
              entries,
              transactions,
              portfolio,
              valueSnapshots: snapshots,
              loading: false,
              lastFetchedAt: Date.now(),
            };
          });
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : "Failed to fetch data" });
        }
      },

      addEntry: async (data) => {
        // If an entry with the same name + topCategory + subCategory already exists, merge by summing values
        const existing = get().entries.find(
          (e) =>
            e.name === data.name &&
            e.topCategory === data.topCategory &&
            e.subCategory === data.subCategory
        );

        if (existing) {
          const merged = await apiFetch<Entry>(`/api/entries/${existing.id}`, {
            method: "PUT",
            body: JSON.stringify({
              value: existing.value + data.value,
              ...(data.stockCode ? { stockCode: data.stockCode } : {}),
              ...(data.units != null ? { units: data.units } : {}),
            }),
          });
          set((s) => {
            const newEntries = s.entries.map((e) => (e.id === existing.id ? merged : e));
            return {
              entries: newEntries,
              valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
            };
          });
          return;
        }

        const entry = await apiFetch<Entry>("/api/entries", {
          method: "POST",
          body: JSON.stringify(data),
        });
        set((s) => {
          const newEntries = [entry, ...s.entries];
          return {
            entries: newEntries,
            valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
          };
        });
      },

      updateEntry: async (id, data) => {
        const entry = await apiFetch<Entry>(`/api/entries/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        set((s) => {
          const newEntries = s.entries.map((e) => (e.id === id ? entry : e));
          return {
            entries: newEntries,
            valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
          };
        });
      },

      deleteEntry: async (id) => {
        await apiFetch(`/api/entries/${id}`, { method: "DELETE" });
        set((s) => {
          const newEntries = s.entries.filter((e) => e.id !== id);
          return {
            entries: newEntries,
            valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
          };
        });
      },

      addTransaction: async (data) => {
        const tx = await apiFetch<Transaction>("/api/transactions", {
          method: "POST",
          body: JSON.stringify(data),
        });
        set((s) => ({ transactions: [tx, ...s.transactions] }));
      },

      deleteTransaction: async (id) => {
        await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      },

      addPortfolioItem: async (data) => {
        const item = await apiFetch<PortfolioItem>("/api/portfolio", {
          method: "POST",
          body: JSON.stringify(data),
        });
        set((s) => ({ portfolio: [item, ...s.portfolio] }));
      },

      deletePortfolioItem: async (id) => {
        await apiFetch(`/api/portfolio/${id}`, { method: "DELETE" });
        set((s) => ({ portfolio: s.portfolio.filter((p) => p.id !== id) }));
      },
    }),
    {
      name: "finance-store",
      partialize: (s) => ({ valueSnapshots: s.valueSnapshots }),
    }
  )
);
