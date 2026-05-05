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

        const Icon = getEntryIcon;

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
            {/* Always-visible header */}
            <div className="flex flex-col items-center pt-[14px]">
              <p className="text-[18px] font-extrabold text-[#1c1c1e]">{cat.name}</p>
              <p className="mt-[3px] text-[12px] text-black/45">
                {hideBalance ? "••••••" : formatCurrency(cat.total)}
              </p>
            </div>

            {/* Entry list — only when expanded */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: 0.12, duration: 0.25 }}
                  className="mt-[14px] flex flex-col gap-[7px] overflow-y-auto px-[6.5%]"
                  style={{ maxHeight: "calc(100% - 72px)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {cat.entries.map((entry) => {
                    const EntryIcon = Icon(cat.name, entry.subCategory);
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
                          <EntryIcon size={15} className="text-[#1c1c1e]" />
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
