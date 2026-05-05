"use client";

import { useState, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import type { Entry } from "@repo/shared";
import { formatCurrency } from "../../lib/format";

const ASSET_ICON_MAP: Record<string, string> = {
  "Bank of Taiwan": "/assets_icons/Bank of Taiwan.png",
  "Cathay United Bank": "/assets_icons/Cathay United Bank.jpg",
  Dawho: "/assets_icons/Dawho.png",
  "Esun Bank": "/assets_icons/Esun Bank.jpg",
  "Line Bank": "/assets_icons/Line Bank.png",
  "New New Bank": "/assets_icons/New New Bank.png",
};

export interface StackCategory {
  name: string;
  color: string;
  textColor: string;
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

export interface CategoryCardStackHandle {
  collapse: () => void;
}

export const CategoryCardStack = forwardRef<CategoryCardStackHandle, Props>(
  function CategoryCardStack(
    { categories, hideBalance, getEntryIcon, onEntryClick, onExpandChange }: Props,
    ref
  ) {
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [hoveredName, setHoveredName] = useState<string | null>(null);

    const collapse = () => {
      setSelectedName(null);
      onExpandChange(false);
    };

    useImperativeHandle(ref, () => ({ collapse }));

    const handleCardClick = (name: string) => {
      if (selectedName === name) {
        collapse();
      } else {
        setSelectedName(name);
        setHoveredName(null);
        onExpandChange(true);
      }
    };

    const total = categories.length;

    return (
      <div
        className="relative h-full w-full"
        onClick={() => {
          if (selectedName !== null) collapse();
        }}
      >
        {categories.map((cat, index) => {
          const isSelected = selectedName === cat.name;
          const isHovered = hoveredName === cat.name;
          const widthPct = CARD_WIDTHS[Math.min(index, CARD_WIDTHS.length - 1)] ?? 68;
          const leftPct = (100 - widthPct) / 2;
          const defaultY = (total - 1 - index) * STACK_SPACING;
          const zIndex = isSelected ? total + 1 : total - index;

          let animY: number;
          if (selectedName === null) {
            animY = defaultY - (isHovered ? 28 : 0);
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
              onMouseEnter={() => {
                if (!selectedName) setHoveredName(cat.name);
              }}
              onMouseLeave={() => setHoveredName(null)}
              onPointerEnter={() => {
                if (!selectedName) setHoveredName(cat.name);
              }}
              onPointerLeave={() => setHoveredName(null)}
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick(cat.name);
              }}
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
                <p className="text-[18px] font-extrabold" style={{ color: cat.textColor }}>
                  {cat.name}
                </p>
                <p className="mt-[3px] text-[12px]" style={{ color: cat.textColor, opacity: 0.5 }}>
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
                    className="mt-[14px] flex flex-col gap-[7px] overflow-y-auto px-[6.5%] [&::-webkit-scrollbar]:hidden"
                    style={{ maxHeight: "calc(100% - 72px)", scrollbarWidth: "none" }}
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
                            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-[8px]"
                            style={{ background: "rgba(255,255,255,0.7)" }}
                          >
                            {ASSET_ICON_MAP[entry.name] ? (
                              <Image
                                src={ASSET_ICON_MAP[entry.name]!}
                                alt={entry.name}
                                width={28}
                                height={28}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <EntryIcon size={15} className="text-[#1c1c1e]" />
                            )}
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
);
