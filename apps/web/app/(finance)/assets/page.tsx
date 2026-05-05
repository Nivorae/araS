"use client";

import { useEffect, useState } from "react";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { Entry } from "@repo/shared";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { formatCurrency } from "../../../lib/format";
import { AddAccountPage } from "../../../components/finance/AddAccountPage";
import { AccountFormPage } from "../../../components/finance/AccountFormPage";
import { EntryDetailPage } from "../../../components/finance/EntryDetailPage";
import {
  CATEGORIES,
  getNodeIcon,
  getTopCategory,
} from "../../../components/finance/categoryConfig";
import { LoanDetailSheet } from "../../../components/finance/LoanDetailSheet";
import { InsuranceDetailSheet } from "../../../components/finance/InsuranceDetailSheet";
import type { Insurance } from "@repo/shared";
import {
  CategoryCardStack,
  type StackCategory,
} from "../../../components/finance/CategoryCardStack";

const CARD_ORDER = ["流動資金", "負債", "固定資產", "應收款", "投資"];

interface FormConfig {
  topCategory: string;
  isLiability: boolean;
  color: string;
  subCategoryName: string;
  SubCategoryIcon: LucideIcon;
}

interface EditItem {
  id: string;
  name: string;
  value: number;
  category: string;
}

export default function AssetsPage() {
  const { fetchAll, entries, loading } = useFinanceStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [editItem, setEditItem] = useState<EditItem | null>(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [showLoanDetail, setShowLoanDetail] = useState(false);
  const [loanDetailLoanId, setLoanDetailLoanId] = useState<string | null>(null);
  const [loanDetailColor, setLoanDetailColor] = useState("#C7C7D4");
  const [showInsuranceDetail, setShowInsuranceDetail] = useState(false);
  const [insuranceDetailData, setInsuranceDetailData] = useState<{
    insurance: Insurance;
    color: string;
  } | null>(null);
  const [isCardExpanded, setIsCardExpanded] = useState(false);

  const loanDetailEntry =
    loanDetailLoanId != null ? entries.find((e) => e.loan?.id === loanDetailLoanId) : null;
  const loanDetailData = loanDetailEntry?.loan
    ? { loan: loanDetailEntry.loan, color: loanDetailColor }
    : null;

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const assets = entries.filter((e) => e.topCategory !== "負債");
  const liabilities = entries.filter((e) => e.topCategory === "負債");
  const netWorth =
    assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.value, 0);

  const groupedEntries = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.topCategory] ??= []).push(e);
    return acc;
  }, {});

  const stackCategories: StackCategory[] = CARD_ORDER.flatMap((name) => {
    const catConfig = CATEGORIES.find((c) => c.name === name);
    if (!catConfig) return [];
    const catEntries = groupedEntries[name] ?? [];
    if (catEntries.length === 0) return [];
    return [
      {
        name: catConfig.name,
        color: catConfig.color,
        isLiability: catConfig.isLiability,
        entries: catEntries,
        total: catEntries.reduce((s, e) => s + e.value, 0),
      },
    ];
  });

  const openDetail = (entry: Entry) => {
    if (entry.loan) {
      const topCat = getTopCategory(entry.topCategory);
      setLoanDetailLoanId(entry.loan.id);
      setLoanDetailColor(topCat?.color ?? "#C7C7D4");
      setShowLoanDetail(true);
    } else if (entry.insurance) {
      const topCat = getTopCategory(entry.topCategory);
      setInsuranceDetailData({ insurance: entry.insurance, color: topCat?.color ?? "#7B7EC4" });
      setShowInsuranceDetail(true);
    } else {
      setDetailEntry(entry);
      setShowDetail(true);
    }
  };

  const openFormForNew = (
    topCategory: string,
    isLiability: boolean,
    subCategoryName: string,
    icon: LucideIcon,
    color: string
  ) => {
    setFormConfig({ topCategory, isLiability, color, subCategoryName, SubCategoryIcon: icon });
    setEditItem(null);
    setShowForm(true);
  };

  const openFormFromDetail = (entry: Entry, mode: "add" | "adjust") => {
    const topCat = getTopCategory(entry.topCategory);
    const color = topCat?.color ?? "#007aff";
    const icon = getNodeIcon(entry.topCategory, entry.subCategory);
    setFormConfig({
      topCategory: entry.topCategory,
      isLiability: entry.topCategory === "負債",
      color,
      subCategoryName: entry.subCategory,
      SubCategoryIcon: icon,
    });
    setEditItem(
      mode === "adjust"
        ? { id: entry.id, name: entry.name, value: entry.value, category: entry.topCategory }
        : null
    );
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormConfig(null);
    setEditItem(null);
  };

  const closeAll = () => {
    setShowForm(false);
    setShowDetail(false);
    setShowMenu(false);
    setFormConfig(null);
    setEditItem(null);
    setDetailEntry(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-[#8e8e93]">載入中...</div>
      </div>
    );
  }

  const topHeightPct = isCardExpanded ? 28 : 50;
  const bottomHeightPct = 100 - topHeightPct;

  return (
    <div className="relative" style={{ height: "calc(100dvh - 64px)" }}>
      {/* Plus button: fixed top-right, same row as BottomNav */}
      <button
        onClick={() => setShowMenu(true)}
        className="fixed top-3 right-4 z-[51] flex h-9 w-9 items-center justify-center rounded-full shadow-md active:opacity-80"
        style={{ backgroundColor: "#5856D6" }}
      >
        <Plus size={18} className="text-white" />
      </button>

      {/* Top zone: net worth centered */}
      <motion.div
        animate={{ height: `${topHeightPct}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 28 }}
        className="flex flex-col items-center justify-center overflow-hidden"
      >
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[12px] font-semibold text-[#8e8e93]">Net Worth (TWD)</p>
          <button onClick={() => setHideBalance((v) => !v)} className="active:opacity-60">
            {hideBalance ? (
              <EyeOff size={14} className="text-[#8e8e93]" />
            ) : (
              <Eye size={14} className="text-[#8e8e93]" />
            )}
          </button>
        </div>
        <p className="text-[34px] font-bold tracking-tight text-[#1c1c1e]">
          {hideBalance ? "••••••" : formatCurrency(netWorth)}
        </p>
      </motion.div>

      {/* Bottom zone: card stack */}
      <motion.div
        animate={{ height: `${bottomHeightPct}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 28 }}
        className="relative overflow-hidden"
      >
        {stackCategories.length > 0 ? (
          <CategoryCardStack
            categories={stackCategories}
            hideBalance={hideBalance}
            getEntryIcon={(topCategory, subCategory) => getNodeIcon(topCategory, subCategory)}
            onEntryClick={openDetail}
            onExpandChange={setIsCardExpanded}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <button
              onClick={() => setShowMenu(true)}
              className="mx-4 w-full rounded-2xl bg-white px-4 py-12 text-center shadow-sm active:bg-[#f2f2f7]"
            >
              <p className="text-[15px] font-medium text-[#007aff]">+ 新增第一筆資產</p>
              <p className="mt-1 text-[13px] text-[#8e8e93]">記錄你的資產與負債</p>
            </button>
          </div>
        )}
      </motion.div>

      {/* Sheets */}
      <AddAccountPage
        open={showMenu}
        onClose={() => setShowMenu(false)}
        onSelectCategory={openFormForNew}
      />

      <EntryDetailPage
        open={showDetail}
        entry={detailEntry}
        onClose={() => {
          setShowDetail(false);
          setDetailEntry(null);
        }}
        onAddEntry={() => {
          if (detailEntry) openFormFromDetail(detailEntry, "add");
        }}
        onAdjust={() => {
          if (detailEntry) openFormFromDetail(detailEntry, "adjust");
        }}
      />

      <AccountFormPage
        open={showForm}
        onClose={closeForm}
        onSaved={closeAll}
        topCategory={formConfig?.topCategory ?? ""}
        isLiability={formConfig?.isLiability ?? false}
        categoryColor={formConfig?.color ?? "#007aff"}
        subCategoryName={formConfig?.subCategoryName ?? ""}
        SubCategoryIcon={formConfig?.SubCategoryIcon ?? Wallet}
        editItem={editItem}
        {...(!editItem && detailEntry?.name ? { nameSuggestion: detailEntry.name } : {})}
      />

      {loanDetailData && (
        <LoanDetailSheet
          open={showLoanDetail}
          loan={loanDetailData.loan}
          currentBalance={loanDetailEntry?.value}
          color={loanDetailData.color}
          onClose={() => {
            setShowLoanDetail(false);
            setLoanDetailLoanId(null);
          }}
          onRateUpdated={fetchAll}
          onSynced={fetchAll}
          onDeleted={fetchAll}
        />
      )}

      {insuranceDetailData && (
        <InsuranceDetailSheet
          open={showInsuranceDetail}
          insurance={insuranceDetailData.insurance}
          color={insuranceDetailData.color}
          onClose={() => {
            setShowInsuranceDetail(false);
            setInsuranceDetailData(null);
          }}
          onRateUpdated={fetchAll}
        />
      )}
    </div>
  );
}
