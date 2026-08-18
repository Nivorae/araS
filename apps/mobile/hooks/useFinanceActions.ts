import { useCallback } from "react";
import { ApiError, useApi } from "@/lib/api";
import { useFinanceStore } from "@/store/financeStore";
import type {
  Entry,
  EntryHistory,
  Transaction,
  PortfolioItem,
  Recurrence,
  Insurance,
  CreateEntry,
  UpdateEntry,
  CreateTransaction,
  CreatePortfolioItem,
  UpdatePortfolioItem,
  CreateRecurrence,
  UpdateRecurrence,
  CreateInsurance,
  UpdateInsurance,
  NetWorthRange,
  NetWorthPoint,
  NetWorthHistory,
  Dividend,
  CreateDividend,
  UpdateDividend,
  ReinvestDividend,
  DividendSummary,
} from "@repo/shared";

// In-flight net-worth-history requests, keyed by range. Module-level rather
// than a ref so two screens (or two mounts of the same one) share it: the
// chart effect can fire again before the first response lands, and a plain
// cache check only dedupes *after* the write. Entries are removed on settle,
// so a failed fetch is retried rather than being remembered as pending. The
// epoch each request started under is kept alongside it, so a request issued
// before an entry mutation is never handed to a caller asking after it.
const netWorthHistoryInFlight = new Map<
  NetWorthRange,
  { epoch: number; promise: Promise<NetWorthPoint[] | null> }
>();

export function useFinanceActions() {
  const api = useApi();

  // The two slices /api/recurrences/process can write to. Read together so the
  // initial wave and the post-process refresh below can't drift apart.
  const readRecurrenceSlices = useCallback(
    () =>
      Promise.all([
        api.get<Recurrence[]>("/api/recurrences"),
        api.get<Transaction[]>("/api/transactions"),
      ]),
    [api]
  );

  // Runs the cron step after the first paint, then refreshes only if it actually
  // generated rows. This races the initial reads by design — but unlike a bare
  // fire-and-forget, a run that created something re-reads the slices it touched,
  // so new transactions appear in this session rather than on the next launch.
  // It usually creates nothing, so the refresh is rare.
  const processRecurrencesInBackground = useCallback(async () => {
    try {
      const result = await api.post<{ created: number }>("/api/recurrences/process", {});
      if (!result?.created) return;
      const [recurrences, transactions] = await readRecurrenceSlices();
      useFinanceStore.getState().setData({ recurrences, transactions });
    } catch {
      // Best-effort: a failed cron step must never surface on the loaded screen.
    }
  }, [api, readRecurrenceSlices]);

  const fetchAll = useCallback(async () => {
    const { setLoading, setError, setData } = useFinanceStore.getState();
    setLoading(true);
    setError(null);
    try {
      // One wave, not two: these reads don't depend on each other, and the screen
      // is latency-bound, so serializing them just doubled time-to-paint.
      const [entries, portfolio, [recurrences, transactions]] = await Promise.all([
        api.get<Entry[]>("/api/entries"),
        api.get<PortfolioItem[]>("/api/portfolio"),
        readRecurrenceSlices(),
      ]);
      setData({ entries, portfolio, recurrences, transactions });
      void processRecurrencesInBackground();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      useFinanceStore.getState().setLoading(false);
    }
  }, [api, readRecurrenceSlices, processRecurrencesInBackground]);

  // Per-entry history. Lives here rather than in the entry screen so the store's
  // historyByEntry slice has an owner in the actions layer, like every other
  // resource — a second consumer can call this instead of re-rolling the fetch.
  const fetchEntryHistory = useCallback(
    async (id: string): Promise<EntryHistory[] | null> => {
      try {
        const rows = await api.get<EntryHistory[]>(`/api/entries/${id}/history`);
        useFinanceStore.getState().setEntryHistory(id, rows);
        return rows;
      } catch {
        // Cached rows stay on screen; the caller decides whether to surface this.
        return null;
      }
    },
    [api]
  );

  // Net-worth history for one range. Skips the request when that range is
  // already cached, so flicking between 6M/1Y/全部 only ever costs one fetch
  // each; entry mutations clear the cache and make the next view refetch.
  const fetchNetWorthHistory = useCallback(
    (range: NetWorthRange): Promise<NetWorthPoint[] | null> => {
      const cached = useFinanceStore.getState().netWorthHistory[range];
      if (cached) return Promise.resolve(cached);

      const epoch = useFinanceStore.getState().netWorthHistoryEpoch;
      const pending = netWorthHistoryInFlight.get(range);
      if (pending && pending.epoch === epoch) return pending.promise;

      const promise = api
        .get<NetWorthHistory>(`/api/entries/net-worth-history?range=${range}`)
        .then((result) => {
          // An entry changed while this was in flight, so these points describe
          // a net worth that no longer holds. Caching them would pin the chart
          // to stale numbers; the mutation already triggered a fresh fetch.
          if (useFinanceStore.getState().netWorthHistoryEpoch !== epoch) return null;
          useFinanceStore.getState().setNetWorthHistory(range, result.points);
          return result.points;
        })
        .catch(() => {
          // The chart falls back to its empty state; a failed chart read must
          // not take over the screen the way a failed initial load does.
          return null;
        })
        .finally(() => {
          // Only clear the slot if it is still this request's — a newer epoch
          // may have replaced it while this one was resolving.
          if (netWorthHistoryInFlight.get(range)?.promise === promise) {
            netWorthHistoryInFlight.delete(range);
          }
        });

      netWorthHistoryInFlight.set(range, { epoch, promise });
      return promise;
    },
    [api]
  );

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
      try {
        await api.delete(`/api/entries/${id}`);
      } catch (e) {
        // Already gone (e.g. a duplicate delete request) — treat as success.
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
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

  const addInsurance = useCallback(
    async (data: CreateInsurance) => {
      // The create response carries the linked Entry (value:0,
      // includeInChart:false) alongside the Insurance fields — pushed straight
      // into the store so the new policy shows up instantly, with no extra
      // fetch and no loading flicker (its value never affects net worth).
      const result = await api.post<Insurance & { entry: Entry }>("/api/insurances", data);
      const { entry, ...insurance } = result;
      useFinanceStore.getState().addEntryLocal(entry);
      return insurance;
    },
    [api]
  );

  const updateInsurance = useCallback(
    async (id: string, data: UpdateInsurance) =>
      api.patch<Insurance>(`/api/insurances/${id}`, data),
    [api]
  );

  const deleteInsurance = useCallback(
    async (id: string) => {
      await api.delete(`/api/insurances/${id}`);
    },
    [api]
  );

  const fetchInsurance = useCallback(
    async (id: string): Promise<Insurance | null> => {
      try {
        return await api.get<Insurance>(`/api/insurances/${id}`);
      } catch {
        return null;
      }
    },
    [api]
  );

  const fetchInsurances = useCallback(
    async (): Promise<Insurance[]> => api.get<Insurance[]>("/api/insurances"),
    [api]
  );

  // 股利紀錄刻意不進 financeStore：跟保險模組一樣 on-demand 抓取。它會改動
  // Entry.value（入帳與再投資都寫 EntryHistory），所以呼叫端在變更後要自己跑一次
  // fetchAll() 讓 entry 值同步 —— 再多一份 store slice 只會多一處會走味的狀態。
  const fetchDividends = useCallback(
    async (entryId?: string): Promise<Dividend[]> =>
      api.get<Dividend[]>(
        `/api/dividends${entryId ? `?entryId=${encodeURIComponent(entryId)}` : ""}`
      ),
    [api]
  );

  const addDividend = useCallback(
    async (data: CreateDividend): Promise<Dividend> => api.post<Dividend>("/api/dividends", data),
    [api]
  );

  const updateDividend = useCallback(
    async (id: string, data: UpdateDividend): Promise<Dividend> =>
      api.patch<Dividend>(`/api/dividends/${id}`, data),
    [api]
  );

  const deleteDividend = useCallback(
    async (id: string): Promise<void> => {
      await api.delete(`/api/dividends/${id}`);
    },
    [api]
  );

  const reinvestDividend = useCallback(
    async (id: string, data: ReinvestDividend): Promise<Dividend> =>
      api.post<Dividend>(`/api/dividends/${id}/reinvest`, data),
    [api]
  );

  const fetchDividendSummary = useCallback(
    async (): Promise<DividendSummary> => api.get<DividendSummary>("/api/dividends/summary"),
    [api]
  );

  return {
    fetchAll,
    fetchEntryHistory,
    fetchNetWorthHistory,
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
    addInsurance,
    updateInsurance,
    deleteInsurance,
    fetchInsurance,
    fetchInsurances,
    fetchDividends,
    addDividend,
    updateDividend,
    deleteDividend,
    reinvestDividend,
    fetchDividendSummary,
  };
}
