import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Insurance } from "@repo/shared";
import { InsuranceOverviewPage } from "../InsuranceOverviewPage";

// motion's layout animations don't run in jsdom — render plain elements.
vi.mock("motion/react", () => {
  const strip = ({
    initial: _i,
    animate: _a,
    transition: _t,
    onAnimationComplete,
    ...rest
  }: Record<string, unknown> & { onAnimationComplete?: () => void }) => {
    // Complete immediately so a close actually unmounts.
    if (onAnimationComplete) queueMicrotask(onAnimationComplete);
    return rest;
  };
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      div: (p: Record<string, unknown>) => <div {...(strip(p) as object)} />,
      button: (p: Record<string, unknown>) => <button {...(strip(p) as object)} />,
    },
  };
});
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "user_a" }) }));

const policy = (id: string, createdAt: string, extra: Partial<Insurance> = {}): Insurance =>
  ({
    id,
    insurer: "國泰人壽",
    insuredName: "本人",
    insuranceType: "MEDICAL",
    policyName: null,
    policyNumber: null,
    startDate: null,
    paymentTermYears: 20,
    coveragePeriod: "終身",
    annualPremium: 12000,
    coverage: [],
    createdAt,
    ...extra,
  }) as unknown as Insurance;

describe("InsuranceOverviewPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          policy("b", "2026-02-01T00:00:00Z", { insuranceType: "LIFE", insurer: "富邦人壽" }),
          policy("a", "2026-01-01T00:00:00Z"),
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists policies oldest first, each with its insurer", async () => {
    render(<InsuranceOverviewPage open focusId={null} onClose={() => {}} onChanged={() => {}} />);
    const cards = await screen.findAllByRole("button", { name: /人壽/ });
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual([
      "醫療險 國泰人壽",
      "壽險 富邦人壽",
    ]);
  });

  it("grows the centred card into the detail view with its rows", async () => {
    render(<InsuranceOverviewPage open focusId={null} onClose={() => {}} onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "醫療險 國泰人壽" }));
    const dialog = await screen.findByRole("dialog", { name: "醫療險" });
    expect(dialog).toHaveTextContent("被保人");
    expect(dialog).toHaveTextContent("20 年");
    expect(dialog).toHaveTextContent("保單號碼不確定");
  });

  it("deletes after confirmation and reports the change", async () => {
    const onChanged = vi.fn();
    render(<InsuranceOverviewPage open focusId={null} onClose={() => {}} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "醫療險 國泰人壽" }));
    const card = await screen.findByRole("dialog", { name: "醫療險" });
    fireEvent.click(within(card).getByRole("button", { name: /刪除/ }));
    const confirm = await screen.findByRole("dialog", { name: "刪除保單" });
    fireEvent.click(within(confirm).getByRole("button", { name: "刪除" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/insurances/a", { method: "DELETE" })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
