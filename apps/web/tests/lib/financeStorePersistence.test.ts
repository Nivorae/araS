import { describe, it, expect, vi, beforeEach } from "vitest";

// valueSnapshots used to be persisted to localStorage under "finance-store".
// No UI reads them, and they outlived sign-out — the next account in the same
// browser inherited the previous account's net-worth history.
describe("web finance store persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("removes the legacy finance-store key on load", async () => {
    localStorage.setItem("finance-store", JSON.stringify({ state: { valueSnapshots: [1] } }));

    await import("../../store/useFinanceStore");

    expect(localStorage.getItem("finance-store")).toBeNull();
  });

  it("does not write finance data to localStorage", async () => {
    const { useFinanceStore } = await import("../../store/useFinanceStore");

    useFinanceStore.setState({ valueSnapshots: [{ id: "s1" } as never] });

    expect(localStorage.getItem("finance-store")).toBeNull();
  });
});
