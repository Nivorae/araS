import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Entry } from "@repo/shared";
import { AccountFormPage } from "../AccountFormPage";

const addEntry = vi.fn();
const updateEntry = vi.fn();
const setEntryIncludeInChart = vi.fn();
const refreshEntries = vi.fn();
vi.mock("../../../store/useFinanceStore", () => ({
  useFinanceStore: () => ({
    addEntry,
    updateEntry,
    setEntryIncludeInChart,
    refreshEntries,
    entries: [],
  }),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "user_a" }) }));
const prompt = vi.fn();
vi.mock("../../../lib/mobileAppPrompt", () => ({
  MOBILE_APP_PROMPT: "如果要使用該功能，請下載手機版本。",
  promptMobileApp: (...a: unknown[]) => prompt(...a),
}));

const cash: Entry = {
  id: "e1",
  name: "錢包",
  topCategory: "流動資金",
  subCategory: "現金",
  value: 1000,
  includeInChart: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Entry;

function renderForm(props: Partial<Parameters<typeof AccountFormPage>[0]> = {}) {
  const onSaved = vi.fn();
  render(
    <AccountFormPage
      open
      onClose={() => {}}
      onSaved={onSaved}
      topCategory="流動資金"
      categoryColor="#FFFFFF"
      subCategoryName="現金"
      {...props}
    />
  );
  return { onSaved };
}

describe("AccountFormPage — mobile EntryForm modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    updateEntry.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("add-record 支出 subtracts from the balance and back-dates the record", async () => {
    const { onSaved } = renderForm({ entry: cash, addRecord: true });
    expect(screen.getByText("新增記錄")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "支出" }));
    fireEvent.change(screen.getByLabelText("新增金額"), { target: { value: "300" } });
    expect(screen.getByTestId("entry-preview")).toHaveTextContent("$700");
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateEntry).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({
        value: 700,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
    expect(addEntry).not.toHaveBeenCalled();
  });

  it("✏️ edits basic info only — no amount field and no value sent", async () => {
    const { onSaved } = renderForm({ entry: cash });
    expect(screen.getByText("編輯帳戶")).toBeInTheDocument();
    expect(screen.queryByLabelText("帳戶餘額")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("自訂名稱，預設為現金"), {
      target: { value: "零錢" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateEntry).toHaveBeenCalledWith("e1", { name: "零錢", includeInChart: true });
  });

  it("saves 納入圖表 immediately for an existing entry, reverting on failure", async () => {
    setEntryIncludeInChart.mockRejectedValueOnce(new Error("納入圖表設定儲存失敗"));
    renderForm({ entry: cash });
    const toggle = screen.getByRole("switch", { name: "納入圖表" });
    fireEvent.click(toggle);
    expect(setEntryIncludeInChart).toHaveBeenCalledWith("e1", false);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByText("納入圖表設定儲存失敗")).toBeInTheDocument();
  });

  it("負債 → 貸款 shows the loan form and POSTs /api/loans", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onSaved } = renderForm({
      topCategory: "負債",
      isLiability: true,
      categoryColor: "#C7C7D4",
      subCategoryName: "貸款",
    });
    expect(screen.getByText("貸款名稱")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    // Required loan fields empty → validation, no request.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("prompts the mobile app when the free entry limit is reached", async () => {
    addEntry.mockRejectedValueOnce(
      Object.assign(new Error("已達免費方案的資產筆數上限"), { code: "ENTRY_LIMIT_REACHED" })
    );
    const { onSaved } = renderForm();
    fireEvent.change(screen.getByLabelText("帳戶餘額"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(prompt.mock.calls[0]![0]).toContain("下載手機版本");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("amount mode derives units from cost ÷ price and stores pricePerShare", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ price: 100, currency: "TWD" }) })
    );
    const { onSaved } = renderForm({
      topCategory: "投資",
      categoryColor: "#66788E",
      subCategoryName: "台股",
      entry: { ...cash, topCategory: "投資", subCategory: "台股", stockCode: "0050", units: 5 },
      addRecord: true,
    });
    await waitFor(() => expect(screen.getByText("100")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "依金額" }));
    fireEvent.change(screen.getByLabelText("投入金額"), { target: { value: "2500" } });
    expect(screen.getByText("25")).toBeInTheDocument(); // ≈ 25 持有股數
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateEntry).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ value: 3500, units: 25, pricePerShare: 100, stockCode: "0050" })
    );
  });
});
