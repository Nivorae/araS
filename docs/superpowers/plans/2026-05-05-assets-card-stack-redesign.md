# Assets Page Card Stack Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the assets page from a horizontal category list into an animated card stack where each category is a card that expands to show its entries.

**Architecture:** A new `CategoryCardStack` component handles the animated stack using `motion/react`. The `(finance)/layout.tsx` moves `BottomNav` from bottom to top. The assets page becomes a two-zone full-height layout: net worth centered in the top half, card stack in the bottom half — the stack zone grows when a card expands.

**Tech Stack:** motion/react (new), Next.js 15, React 19, Tailwind CSS 4, Zustand

---

## File Map

| File                                                | Action | Responsibility                                                 |
| --------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `apps/web/package.json`                             | Modify | Add `motion` dependency                                        |
| `apps/web/components/layout/BottomNav.tsx`          | Modify | Move nav pill from `bottom-6` to `top-3`                       |
| `apps/web/app/(finance)/layout.tsx`                 | Modify | Change `pb-20` → `pt-16`, remove BottomNav render (it's fixed) |
| `apps/web/components/finance/CategoryCardStack.tsx` | Create | Animated card stack component                                  |
| `apps/web/app/(finance)/assets/page.tsx`            | Modify | Use new two-zone layout + CategoryCardStack                    |

---

## Task 1: Install motion/react

**Files:**

- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the motion package**

```bash
cd apps/web && pnpm add motion
```

Expected output: motion added to dependencies in apps/web/package.json.

- [ ] **Step 2: Verify install**

```bash
ls node_modules/motion
```

Expected: directory exists.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add motion animation library"
```

---

## Task 2: Move BottomNav to top

**Files:**

- Modify: `apps/web/components/layout/BottomNav.tsx`
- Modify: `apps/web/app/(finance)/layout.tsx`

- [ ] **Step 1: Change BottomNav positioning from bottom to top**

In `apps/web/components/layout/BottomNav.tsx`, change line 30:

```tsx
// Before
<nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">

// After
<nav className="fixed top-3 left-1/2 z-50 -translate-x-1/2">
```

- [ ] **Step 2: Update finance layout padding**

Replace the entire content of `apps/web/app/(finance)/layout.tsx`:

```tsx
import { BottomNav } from "../../components/layout/BottomNav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f2f7]">
      <BottomNav />
      <div className="mx-auto max-w-md pt-16">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify other finance pages still render correctly**

Run `pnpm dev` and check `/transactions`, `/loans`, `/insurance`, `/retirement` — content should be below the top nav pill, not hidden behind it.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/BottomNav.tsx apps/web/app/(finance)/layout.tsx
git commit -m "feat(web): move bottom nav to top of screen"
```

---

## Task 3: Create CategoryCardStack component

**Files:**

- Create: `apps/web/components/finance/CategoryCardStack.tsx`

The card stack displays categories as overlapping cards. The front card (index 0) is widest and at the bottom. Cards behind it are progressively narrower and stacked above. Tapping a card expands it to fill the zone; tapping again collapses.

Card width per position (front → back): 92%, 84%, 76%, 68%  
Card top offset per position (front → back): `(total - 1 - index) * 70`px from top of container  
z-index per position: `total - index` (front = highest)

- [ ] **Step 1: Create the file**

Create `apps/web/components/finance/CategoryCardStack.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import type { Entry } from "@repo/shared";
import { formatCurrency } from "../../lib/format";

export interface StackCategory {
  name: string;
  color: string;
  isLiability: boolean;
  entries: Entry[];
  total: number;
}

interface Props {
  categories: StackCategory[];
  hideBalance: boolean;
  getEntryIcon: (topCategory: string, subCategory: string) => LucideIcon;
  onEntryClick: (entry: Entry) => void;
  onExpandChange: (expanded: boolean) => void;
}

const CARD_WIDTHS = [92, 84, 76, 68];
const STACK_SPACING = 70;

export function CategoryCardStack({
  categories,
  hideBalance,
  getEntryIcon,
  onEntryClick,
  onExpandChange,
}: Props) {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const handleCardClick = (name: string) => {
    if (selectedName === name) {
      setSelectedName(null);
      onExpandChange(false);
    } else {
      setSelectedName(name);
      onExpandChange(true);
    }
  };

  const total = categories.length;

  return (
    <div className="relative h-full w-full">
      {categories.map((cat, index) => {
        const isSelected = selectedName === cat.name;
        const widthPct = CARD_WIDTHS[Math.min(index, CARD_WIDTHS.length - 1)] ?? 68;
        const leftPct = (100 - widthPct) / 2;
        const defaultY = (total - 1 - index) * STACK_SPACING;
        const zIndex = isSelected ? total + 1 : total - index;

        let animY: number;
        if (selectedName === null) {
          animY = defaultY;
        } else if (isSelected) {
          animY = 0;
        } else {
          animY = 600;
        }

        return (
          <motion.div
            key={cat.name}
            animate={{ y: animY, zIndex }}
            transition={{ type: "spring", stiffness: 220, damping: 25 }}
            onClick={() => handleCardClick(cat.name)}
            className="absolute top-0 cursor-pointer overflow-hidden rounded-[26px]"
            style={{
              width: `${widthPct}%`,
              left: `${leftPct}%`,
              height: isSelected ? "100%" : 420,
              backgroundColor: cat.color,
              boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
            }}
          >
            {/* Card header: always visible */}
            <div className="flex flex-col items-center pt-[14px]">
              <p className="text-[18px] font-extrabold text-[#1c1c1e]">{cat.name}</p>
              <p className="mt-[3px] text-[12px] text-black/45">
                {hideBalance ? "••••••" : formatCurrency(cat.total)}
              </p>
            </div>

            {/* Entry list: only visible when expanded */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: 0.12, duration: 0.25 }}
                  className="mt-[14px] flex flex-col gap-[7px] px-[6.5%]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {cat.entries.map((entry) => {
                    const Icon = getEntryIcon(cat.name, entry.subCategory);
                    return (
                      <button
                        key={entry.id}
                        onClick={() => onEntryClick(entry)}
                        className="flex w-full items-center gap-[10px] rounded-[14px] px-[14px] py-[10px] text-left active:opacity-70"
                        style={{ background: "rgba(255,255,255,0.55)" }}
                      >
                        <div
                          className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px]"
                          style={{ background: "rgba(255,255,255,0.7)" }}
                        >
                          <Icon size={15} className="text-[#1c1c1e]" />
                        </div>
                        <span className="flex-1 truncate text-[13px] font-semibold text-[#1c1c1e]">
                          {entry.name}
                        </span>
                        <span className="text-[12px] text-[#1c1c1e]">
                          {hideBalance ? "••••" : formatCurrency(entry.value)}
                        </span>
                        <span className="text-[11px] text-black/30">›</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd apps/web && pnpm type-check 2>&1 | head -30
```

Expected: no errors in CategoryCardStack.tsx.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/finance/CategoryCardStack.tsx
git commit -m "feat(web): add CategoryCardStack animated card component"
```

---

## Task 4: Rewrite assets/page.tsx

**Files:**

- Modify: `apps/web/app/(finance)/assets/page.tsx`

The new layout has two zones:

- **Top zone**: net worth centered, shrinks from 50% → 28% when a card expands (motion/react animated)
- **Bottom zone**: CategoryCardStack, grows from 50% → 72% when a card expands

The plus button renders `fixed top-3 right-4 z-[51]` (same height as BottomNav pill, on the right side).

The detail sheets (EntryDetailPage, LoanDetailSheet, InsuranceDetailSheet) remain and open when an entry is tapped.

Card display order (front → back): 流動資金, 負債, 固定資產, 應收款, 投資

- [ ] **Step 1: Replace assets/page.tsx**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
import { calculateLoanStatus } from "@repo/shared";
import type { Insurance } from "@repo/shared";
import {
  CategoryCardStack,
  type StackCategory,
} from "../../../components/finance/CategoryCardStack";

// Display order for card stack: front card first
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
  const { fetchAll, entries, loading, deleteEntry } = useFinanceStore();
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

  // Build ordered stack categories (only those with entries)
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

  // Two-zone layout heights
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

      {/* Top zone: Net worth */}
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

      {/* Bottom zone: Card stack */}
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
```

- [ ] **Step 2: Run type-check**

```bash
cd apps/web && pnpm type-check 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(finance)/assets/page.tsx
git commit -m "feat(web): redesign assets page with animated card stack layout"
```

---

## Task 5: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Open browser at http://localhost:3000/assets**

Check:

- BottomNav pill appears at top-center
- Plus button at top-right, same row as nav
- Net Worth shown in upper half, centered
- Card stack in lower half: 流動資金 (front, widest, green) with 負債/固定資產/投資 peeking behind
- Each visible card shows category name + amount
- Tapping a card expands it with spring animation, net worth zone shrinks
- Tapping an expanded entry opens the correct detail sheet
- Tapping expanded card again collapses it

- [ ] **Step 3: Check other finance pages**

Navigate to `/transactions`, `/loans`, `/insurance`, `/retirement`. Content should be below the top nav, no layout regressions.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(web): assets card stack redesign complete"
```
