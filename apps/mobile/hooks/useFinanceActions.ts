import { useCallback } from "react";
import { useApi } from "@/lib/api";
import { useFinanceStore, makeSnapshot } from "@/store/financeStore";
import type {
  Entry,
  Transaction,
  PortfolioItem,
  Recurrence,
  CreateEntry,
  UpdateEntry,
  CreateTransaction,
  CreatePortfolioItem,
  UpdatePortfolioItem,
  CreateRecurrence,
  UpdateRecurrence,
} from "@repo/shared";

export function useFinanceActions() {
  const api = useApi();

  const fetchAll = useCallback(async () => {
    const { setLoading, setError, setData } = useFinanceStore.getState();
    setLoading(true);
    setError(null);
    try {
      const [entries, portfolio] = await Promise.all([
        api.get<Entry[]>("/api/entries"),
        api.get<PortfolioItem[]>("/api/portfolio"),
      ]);
      // fire-and-forget: process due recurrences (cron step)
      api.post("/api/recurrences/process", {}).catch(() => undefined);
      const [recurrences, transactions] = await Promise.all([
        api.get<Recurrence[]>("/api/recurrences"),
        api.get<Transaction[]>("/api/transactions"),
      ]);
      setData({
        entries,
        portfolio,
        recurrences,
        transactions,
        valueSnapshots: entries.length > 0 ? [makeSnapshot(entries)] : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      useFinanceStore.getState().setLoading(false);
    }
  }, [api]);

  const addEntry = useCallback(
    async (data: CreateEntry) => {
      const entry = await api.post<Entry>("/api/entries", data);
      useFinanceStore.getState().addEntryLocal(entry);
      return entry;
    },
    [api]
  );

  const updateEntry = useCallback(
    async (id: string, data: UpdateEntry) => {
      const entry = await api.put<Entry>(`/api/entries/${id}`, data);
      useFinanceStore.getState().updateEntryLocal(id, entry);
      return entry;
    },
    [api]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await api.delete(`/api/entries/${id}`);
      useFinanceStore.getState().deleteEntryLocal(id);
    },
    [api]
  );

  const addTransaction = useCallback(
    async (data: CreateTransaction) => {
      const tx = await api.post<Transaction>("/api/transactions", data);
      useFinanceStore.getState().addTransactionLocal(tx);
      return tx;
    },
    [api]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await api.delete(`/api/transactions/${id}`);
      useFinanceStore.getState().deleteTransactionLocal(id);
    },
    [api]
  );

  const addPortfolioItem = useCallback(
    async (data: CreatePortfolioItem) => {
      const item = await api.post<PortfolioItem>("/api/portfolio", data);
      useFinanceStore.getState().addPortfolioItemLocal(item);
      return item;
    },
    [api]
  );

  const updatePortfolioItem = useCallback(
    async (id: string, data: UpdatePortfolioItem) => {
      const item = await api.put<PortfolioItem>(`/api/portfolio/${id}`, data);
      useFinanceStore.getState().updatePortfolioItemLocal(id, item);
      return item;
    },
    [api]
  );

  const deletePortfolioItem = useCallback(
    async (id: string) => {
      await api.delete(`/api/portfolio/${id}`);
      useFinanceStore.getState().deletePortfolioItemLocal(id);
    },
    [api]
  );

  const addRecurrence = useCallback(
    async (data: CreateRecurrence) => {
      const rec = await api.post<Recurrence>("/api/recurrences", data);
      useFinanceStore.getState().addRecurrenceLocal(rec);
      return rec;
    },
    [api]
  );

  const updateRecurrence = useCallback(
    async (id: string, data: UpdateRecurrence) => {
      const rec = await api.put<Recurrence>(`/api/recurrences/${id}`, data);
      useFinanceStore.getState().updateRecurrenceLocal(id, rec);
      return rec;
    },
    [api]
  );

  const deleteRecurrence = useCallback(
    async (id: string) => {
      await api.delete(`/api/recurrences/${id}`);
      useFinanceStore.getState().deleteRecurrenceLocal(id);
    },
    [api]
  );

  return {
    fetchAll,
    addEntry,
    updateEntry,
    deleteEntry,
    addTransaction,
    deleteTransaction,
    addPortfolioItem,
    updatePortfolioItem,
    deletePortfolioItem,
    addRecurrence,
    updateRecurrence,
    deleteRecurrence,
  };
}
