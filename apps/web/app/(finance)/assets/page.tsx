"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import type { Entry } from "@repo/shared";
import { useNavContext } from "../nav-context";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { useInvestmentMarketValues } from "../../../hooks/useInvestmentMarketValues";
import { formatCurrency } from "../../../lib/format";
import { chartedEntries } from "../../../lib/chartedEntries";
import { Spinner } from "../../../components/ui/Spinner";
import { AddAccountPage } from "../../../components/finance/AddAccountPage";
import {
  CATEGORIES,
  getNodeIcon,
  INSURANCE_ACCENT,
} from "../../../components/finance/categoryConfig";
import { InsuranceFormPage } from "../../../components/finance/InsuranceFormPage";
import {
  EntrySheetsHost,
  type EntrySheetsHandle,
} from "../../../components/finance/EntrySheetsHost";
import { EmptyAssetsVortex } from "../../../components/finance/EmptyAssetsVortex";
import {
  CategoryCardStack,
  type CategoryCardStackHandle,
  type StackCategory,
} from "../../../components/finance/CategoryCardStack";

// Deck order, bottom card → top card. The LAST name renders at the very top of
// the stack, so 保險 is forced to the end (same as mobile).
const CARD_ORDER = [...CATEGORIES.map((c) => c.name).filter((n) => n !== "保險"), "保險"];

export default function AssetsPage() {
  const { entries, loading, refreshEntries } = useFinanceStore();
  const { setAddAction } = useNavContext();
  const [showMenu, setShowMenu] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState<string | null>(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const cardStackRef = useRef<CategoryCardStackHandle>(null);
  const sheetsRef = useRef<EntrySheetsHandle>(null);

  const openMenu = (expanded: string | null = null) => {
    setMenuExpanded(expanded);
    setShowMenu(true);
  };

  useEffect(() => {
    setAddAction(() => () => openMenu(null));
    return () => setAddAction(null);
  }, [setAddAction]);

  // Arriving from the global "+" on another tab (/assets?add=1) opens the picker.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") {
      openMenu(null);
      window.history.replaceState(null, "", "/assets");
    }
  }, []);

  // Investments shown at live market value, not cost. `marketLoading` holds the
  // net-worth total behind a spinner so it doesn't flash the cost figure first.
  const { values: marketValues, loading: marketLoading } = useInvestmentMarketValues();
  const displayEntries = useMemo(
    () =>
      entries.map((e) => (marketValues[e.id] != null ? { ...e, value: marketValues[e.id]! } : e)),
    [entries, marketValues]
  );

  // 「納入圖表」關閉的項目不計入 Net Worth 與分類卡總額（卡片裡照樣列出）。
  const netWorth = useMemo(() => {
    const charted = chartedEntries(displayEntries);
    const assets = charted.filter((e) => e.topCategory !== "負債").reduce((s, e) => s + e.value, 0);
    const liabilities = charted
      .filter((e) => e.topCategory === "負債")
      .reduce((s, e) => s + e.value, 0);
    return assets - liabilities;
  }, [displayEntries]);

  const stackCategories: StackCategory[] = useMemo(() => {
    const grouped = displayEntries.reduce<Record<string, Entry[]>>((acc, e) => {
      (acc[e.topCategory] ??= []).push(e);
      return acc;
    }, {});
    return CARD_ORDER.flatMap((name) => {
      const cfg = CATEGORIES.find((c) => c.name === name)!;
      const catEntries = grouped[name] ?? [];
      if (catEntries.length === 0) return [];
      return [
        {
          name,
          color: cfg.color,
          textColor: cfg.textColor,
          isLiability: cfg.isLiability,
          entries: catEntries,
          total: chartedEntries(catEntries).reduce((s, e) => s + e.value, 0),
        },
      ];
    });
  }, [displayEntries]);

  const sheets = (
    <>
      <AddAccountPage
        open={showMenu}
        initialExpanded={menuExpanded}
        onClose={() => setShowMenu(false)}
        onSelectCategory={(topCategory, isLiability, subCategoryName, color) =>
          sheetsRef.current?.openNewEntry({ topCategory, isLiability, subCategoryName, color })
        }
        onSelectInsurance={() => setShowInsuranceForm(true)}
      />
      <EntrySheetsHost ref={sheetsRef} onNewEntrySaved={() => setShowMenu(false)} />
      <InsuranceFormPage
        open={showInsuranceForm}
        onClose={() => setShowInsuranceForm(false)}
        onSaved={() => {
          setShowInsuranceForm(false);
          void refreshEntries();
        }}
        categoryColor={INSURANCE_ACCENT}
      />
    </>
  );

  const firstLoad = loading && entries.length === 0;
  const isEmpty = !firstLoad && stackCategories.length === 0;

  const topHeightPct = isCardExpanded ? 28 : 40;
  const springTransition = {
    type: "spring" as const,
    stiffness: 220,
    damping: isCardExpanded ? 25 : 30,
  };

  // The sheets stay at one position in the tree whatever the body shows, so
  // saving the first entry (empty → deck) doesn't remount an open sheet.
  return (
    <div
      className="relative overflow-hidden"
      style={{ height: "calc(100dvh - 64px)" }}
      onClick={() => {
        if (isCardExpanded) cardStackRef.current?.collapse();
      }}
    >
      {firstLoad ? (
        // Only the very first load (nothing cached) shows the spinner.
        <div className="flex h-full items-center justify-center text-[#374254]">
          <Spinner size={28} />
        </div>
      ) : isEmpty ? (
        // Empty: the whole body goes to the vortex — no $0 net worth, just the
        // one action that matters.
        <EmptyAssetsVortex onAdd={() => openMenu(null)} />
      ) : (
        <>
          {/* Top zone: net worth centred */}
          <motion.div
            animate={{ height: `${topHeightPct}%` }}
            transition={springTransition}
            className="flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[12px] font-semibold text-[#8e8e93]">Net Worth (TWD)</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setHideBalance((v) => !v);
                }}
                aria-label={hideBalance ? "顯示金額" : "隱藏金額"}
                className="cursor-pointer active:opacity-60"
              >
                {hideBalance ? (
                  <EyeOff size={14} className="text-[#8e8e93]" />
                ) : (
                  <Eye size={14} className="text-[#8e8e93]" />
                )}
              </button>
            </div>
            {hideBalance ? (
              <p className="text-[40px] font-bold tracking-[-1px] text-[#1c1c1e] md:text-[54px]">
                araS
              </p>
            ) : marketLoading ? (
              <div className="flex h-12 items-center justify-center text-[#8e8e93]">
                <Spinner size={18} />
              </div>
            ) : (
              <p
                className="text-[40px] font-bold tracking-[-1px] text-[#1c1c1e] md:text-[54px]"
                data-testid="net-worth"
              >
                {formatCurrency(netWorth).replace("NT", "")}
              </p>
            )}
          </motion.div>

          {/* Bottom zone: card stack */}
          <motion.div
            animate={{ height: `${100 - topHeightPct}%` }}
            transition={springTransition}
            className="relative overflow-visible"
          >
            <CategoryCardStack
              ref={cardStackRef}
              categories={stackCategories}
              hideBalance={hideBalance}
              getEntryIcon={(topCategory, subCategory) => getNodeIcon(topCategory, subCategory)}
              onEntryClick={(entry) => sheetsRef.current?.openEntry(entry)}
              onExpandChange={setIsCardExpanded}
              onAddClick={(categoryName) =>
                // 保險走專屬表單，其餘分類開選單並展開那一類。
                categoryName === "保險" ? setShowInsuranceForm(true) : openMenu(categoryName)
              }
            />
          </motion.div>
        </>
      )}

      {sheets}
    </div>
  );
}
