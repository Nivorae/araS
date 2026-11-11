"use client";

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Entry } from "@repo/shared";
import { INSURANCE_TYPE_LABELS } from "@repo/shared";
import { formatCurrency } from "../../lib/format";
import { BankLogo } from "../ui/BankLogo";

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
  onAddClick?: (categoryName: string) => void;
}

const MAX_STACK_SPACING = 70;
const FRONT_CARD_HEADER_HEIGHT = 80; // px reserved so front card header is always visible
// Headroom above the top card so a hover-lifted card isn't clipped.
const TOP_INSET = 16;
const PEEK_LIFT = 11;
const ENTRANCE_STAGGER_S = 0.06;

// The deck plays its entrance (cards spring up from below, top card first)
// every time the assets tab is shown again — but not on the first page load,
// same as mobile's re-focus-only entrance.
let mountedBefore = false;

export interface CategoryCardStackHandle {
  collapse: () => void;
}

export const CategoryCardStack = forwardRef<CategoryCardStackHandle, Props>(
  function CategoryCardStack(
    { categories, hideBalance, getEntryIcon, onEntryClick, onExpandChange, onAddClick }: Props,
    ref
  ) {
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [hoveredName, setHoveredName] = useState<string | null>(null);
    const [zoneHeight, setZoneHeight] = useState(400);
    const containerRef = useRef<HTMLDivElement>(null);
    // Per-category sort direction for the entry list — largest balance first.
    const [sortDirs, setSortDirs] = useState<Record<string, "asc" | "desc">>({});
    const getSortDir = (name: string): "asc" | "desc" => sortDirs[name] ?? "desc";
    const toggleSort = (name: string) =>
      setSortDirs((prev) => ({ ...prev, [name]: getSortDir(name) === "desc" ? "asc" : "desc" }));
    const [playEntrance] = useState(() => mountedBefore);
    useEffect(() => {
      mountedBefore = true;
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => {
        if (entry) setZoneHeight(entry.contentRect.height);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const collapse = () => {
      setSelectedName(null);
      onExpandChange(false);
    };

    useImperativeHandle(ref, () => ({ collapse }));

    // The open category vanished (its last entry was deleted from a detail
    // page while the deck stayed mounted) — fold back up and tell the parent.
    useEffect(() => {
      if (selectedName !== null && !categories.some((c) => c.name === selectedName)) {
        setSelectedName(null);
        onExpandChange(false);
      }
    }, [categories, selectedName, onExpandChange]);

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
    const spacing =
      total > 1
        ? Math.min(
            MAX_STACK_SPACING,
            Math.floor((zoneHeight - FRONT_CARD_HEADER_HEIGHT - TOP_INSET) / (total - 1))
          )
        : 0;

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full"
        onClick={() => {
          if (selectedName !== null) collapse();
        }}
      >
        {categories.map((cat, index) => {
          const isSelected = selectedName === cat.name;
          const isHovered = hoveredName === cat.name;
          const widthPct = Math.max(50, 92 - index * 8);
          const leftPct = (100 - widthPct) / 2;
          const defaultY = TOP_INSET + (total - 1 - index) * spacing;
          const zIndex = isSelected ? total + 1 : total - index;
          const isInsurance = cat.name === "保險";
          const dir = getSortDir(cat.name);
          const sortedEntries = isInsurance
            ? cat.entries
            : [...cat.entries].sort((a, b) =>
                dir === "desc" ? b.value - a.value : a.value - b.value
              );

          let animY: number;
          if (selectedName === null) {
            animY = defaultY - (isHovered ? PEEK_LIFT : 0);
          } else if (isSelected) {
            animY = 0;
          } else {
            animY = 600;
          }

          const Icon = getEntryIcon;

          return (
            <motion.div
              key={cat.name}
              initial={playEntrance ? { y: Math.round(zoneHeight * 1.3), zIndex } : false}
              animate={{ y: animY, zIndex }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: selectedName === null ? 30 : 25,
                // Entrance: the top card (last index) first, then down the deck.
                delay: playEntrance ? (total - 1 - index) * ENTRANCE_STAGGER_S : 0,
              }}
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
              className="absolute top-0 cursor-pointer overflow-hidden"
              style={{
                width: `${widthPct}%`,
                left: `${leftPct}%`,
                height: isSelected ? "100%" : 420,
                backgroundColor: cat.color,
                boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
                borderRadius: isSelected ? "26px 26px 0 0" : "26px",
                border: isInsurance ? "1px solid rgba(28,28,30,0.12)" : undefined,
              }}
            >
              {/* Always-visible header (保險: one row — it shows a count, not a total) */}
              <div
                className={
                  isInsurance
                    ? "flex items-center justify-center gap-1.5"
                    : "flex flex-col items-center pt-[14px]"
                }
                style={isInsurance ? { height: FRONT_CARD_HEADER_HEIGHT } : undefined}
              >
                <p className="text-[18px] font-extrabold" style={{ color: cat.textColor }}>
                  {cat.name}
                </p>
                <p
                  className={isInsurance ? "text-[12px]" : "mt-[3px] text-[12px]"}
                  style={{ color: cat.textColor, opacity: 0.5 }}
                >
                  {isInsurance
                    ? `共 ${cat.entries.length} 張保單`
                    : hideBalance
                      ? "••••••"
                      : formatCurrency(cat.total)}
                </p>
              </div>

              {/* Entry list — only when expanded */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.11, duration: 0.25 } }}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    className="mt-[6px] flex flex-col gap-[7px] overflow-y-auto px-[6.5%] pb-3 [&::-webkit-scrollbar]:hidden"
                    style={{ maxHeight: "calc(100% - 72px)", scrollbarWidth: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 保險列的是保單而非金額，排序沒有意義。 */}
                    {!isInsurance && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleSort(cat.name)}
                          aria-label={dir === "desc" ? "金額由大到小" : "金額由小到大"}
                          className="flex cursor-pointer items-center gap-[3px] rounded-[10px] px-2 py-1"
                          style={{ background: "rgba(255,255,255,0.45)", color: cat.textColor }}
                        >
                          <span className="text-[11px] font-semibold">金額</span>
                          {dir === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                        </button>
                      </div>
                    )}
                    {sortedEntries.map((entry) => {
                      const EntryIcon = Icon(cat.name, entry.subCategory);
                      return (
                        <button
                          key={entry.id}
                          onClick={() => onEntryClick(entry)}
                          className="flex w-full items-center gap-[10px] rounded-[14px] px-[14px] py-[10px] text-left active:opacity-70"
                          style={{ background: "rgba(255,255,255,0.55)" }}
                        >
                          {!entry.insurance && (
                            <div
                              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-[8px]"
                              style={{ background: "rgba(255,255,255,0.7)" }}
                            >
                              {entry.bankCode ? (
                                <BankLogo code={entry.bankCode} name={entry.name} size={28} />
                              ) : (
                                <EntryIcon size={15} className="text-[#1c1c1e]" />
                              )}
                            </div>
                          )}
                          {entry.insurance ? (
                            <span className="flex-1 truncate text-[13px] font-semibold text-[#1c1c1e]">
                              🧾 {INSURANCE_TYPE_LABELS[entry.insurance.insuranceType]}
                            </span>
                          ) : (
                            <>
                              <span className="flex-1 truncate text-[13px] font-semibold text-[#1c1c1e]">
                                {entry.name}
                              </span>
                              <span className="text-[12px] text-[#1c1c1e]">
                                {hideBalance ? "••••" : formatCurrency(entry.value)}
                              </span>
                            </>
                          )}
                          <span className="text-[11px] text-black/30">›</span>
                        </button>
                      );
                    })}
                    {onAddClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddClick(cat.name);
                        }}
                        className="mt-1 mb-3 flex w-full items-center justify-center rounded-[14px] px-[14px] py-[10px] active:opacity-70"
                        style={{ background: "rgba(255,255,255,0.55)" }}
                      >
                        <span className="text-[13px] font-semibold text-[#1c1c1e]">+ 新增</span>
                      </button>
                    )}
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
