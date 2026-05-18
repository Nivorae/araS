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
  isGuest: boolean;
  fetchAll: (isSignedIn?: boolean) => Promise<void>;
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
      isGuest: false,

      fetchAll: async (isSignedIn?: boolean) => {
        const { lastFetchedAt, isGuest } = get();

        // Called without arg (from pages) — skip if data already loaded
        if (isSignedIn === undefined) {
          if (lastFetchedAt) return;
          return;
        }

        // Skip if auth state unchanged and cache is warm (30s)
        if (lastFetchedAt && Date.now() - lastFetchedAt < 30_000 && isGuest === !isSignedIn) return;

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

        // Signed in: original API fetch logic
        set({ isGuest: false, loading: true, error: null });
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
              ...(data.bankCode ? { bankCode: data.bankCode } : {}),
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
          const newEntries = [entry, ...s.entries.filter((e) => e.id !== entry.id)];
          return {
            entries: newEntries,
            valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
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
          const newEntries = s.entries.map((e) => (e.id === id ? entry : e));
          return {
            entries: newEntries,
            valueSnapshots: [...s.valueSnapshots, makeSnapshot(newEntries)],
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
          };
        });
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
    }),
    {
      name: "finance-store",
      partialize: (s) => ({ valueSnapshots: s.valueSnapshots }),
    }
  )
);
