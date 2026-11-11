import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Entry } from "@repo/shared";

// Store behaviour ported from mobile (useFinanceActions / financeStore).

function ok<T>(data: T) {
  return { json: async () => ({ success: true, data }) } as Response;
}

const baseEntry: Entry = {
  id: "e1",
  name: "元大台灣50",
  topCategory: "投資",
  subCategory: "台股",
  value: 1000,
  stockCode: "0050",
  units: 10,
  includeInChart: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Entry;

describe("finance store (web parity)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function store() {
    const { useFinanceStore } = await import("../../store/useFinanceStore");
    useFinanceStore.setState({ entries: [baseEntry], isGuest: false, lastFetchedAt: Date.now() });
    return useFinanceStore;
  }

  it("updateEntry merges the PUT response so units survive", async () => {
    const s = await store();
    // The PUT response is the bare row — no `units`.
    const bare: Partial<Entry> = { ...baseEntry, name: "0050" };
    delete bare.units;
    fetchMock.mockResolvedValueOnce(ok(bare));
    await s.getState().updateEntry("e1", { name: "0050" });
    expect(s.getState().entries[0]).toMatchObject({ name: "0050", units: 10 });
  });

  it("setEntryIncludeInChart merges only that field and bumps the epoch", async () => {
    const s = await store();
    const epoch = s.getState().netWorthHistoryEpoch;
    fetchMock.mockResolvedValueOnce(ok({ ...baseEntry, includeInChart: false, units: undefined }));
    await s.getState().setEntryIncludeInChart("e1", false);
    expect(s.getState().entries[0]).toMatchObject({ includeInChart: false, units: 10 });
    expect(s.getState().netWorthHistoryEpoch).toBe(epoch + 1);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ includeInChart: false });
  });

  it("addEntry always creates — no client-side merge by name", async () => {
    const s = await store();
    fetchMock.mockResolvedValueOnce(ok({ ...baseEntry, id: "e2" }));
    await s.getState().addEntry({
      name: baseEntry.name,
      topCategory: "投資",
      subCategory: "台股",
      value: 500,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/entries",
      expect.objectContaining({ method: "POST" })
    );
    expect(s.getState().entries.map((e) => e.id)).toEqual(["e2", "e1"]);
  });

  it("drops net-worth points that arrive after a mutation (stale epoch)", async () => {
    const s = await store();
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
    const pending = s.getState().fetchNetWorthHistory("6m");
    // A mutation lands mid-flight.
    s.setState((st) => ({ netWorthHistoryEpoch: st.netWorthHistoryEpoch + 1 }));
    resolve(ok({ range: "6m", points: [{ period: "2026-01", netWorth: 1 }] }));
    await pending;
    expect(s.getState().netWorthHistory["6m"]).toBeUndefined();
  });

  it("shares one in-flight net-worth request per range", async () => {
    const s = await store();
    fetchMock.mockResolvedValue(ok({ range: "6m", points: [] }));
    await Promise.all([
      s.getState().fetchNetWorthHistory("6m"),
      s.getState().fetchNetWorthHistory("6m"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("guests get an empty history without a request", async () => {
    const s = await store();
    s.setState({ isGuest: true });
    await s.getState().fetchNetWorthHistory("1y");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s.getState().netWorthHistory["1y"]).toEqual([]);
  });

  it("reset clears the previous account's data", async () => {
    const s = await store();
    s.setState({ netWorthHistory: { "6m": [] } });
    s.getState().reset();
    const st = s.getState();
    expect(st.entries).toEqual([]);
    expect(st.netWorthHistory).toEqual({});
    expect(st.lastFetchedAt).toBeNull();
  });

  it("keeps the API error code on thrown errors", async () => {
    const s = await store();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: false,
        error: { code: "ENTRY_LIMIT_REACHED", message: "已達免費方案的資產筆數上限" },
      }),
    } as Response);
    await expect(
      s.getState().addEntry({ name: "x", topCategory: "流動資金", subCategory: "現金", value: 1 })
    ).rejects.toMatchObject({ code: "ENTRY_LIMIT_REACHED" });
  });
});
