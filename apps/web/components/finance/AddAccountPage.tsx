"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES, type CategoryNode, type TopCategory } from "./categoryConfig";

interface DrillTarget {
  title: string;
  color: string;
  textColor: string;
  isLiability: boolean;
  topCategory: string;
  items: CategoryNode[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectCategory: (
    topCategory: string,
    isLiability: boolean,
    nameSuggestion: string,
    icon: LucideIcon,
    color: string
  ) => void;
  onSelectInsurance: () => void;
}

export function AddAccountPage({ open, onClose, onSelectCategory, onSelectInsurance }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);

  const handleClose = () => {
    setExpandedCategory(null);
    setDrillTarget(null);
    onClose();
  };

  const handleBack = () => {
    if (drillTarget) {
      // Level 3 → back to the expanded category (Level 2)
      setDrillTarget(null);
    } else if (expandedCategory) {
      // Level 2 → back to root (all collapsed)
      setExpandedCategory(null);
    } else {
      // Root → close
      handleClose();
    }
  };

  const handleTopCategoryClick = (topCat: TopCategory) => {
    // 保險 has no children — its "category" is really the insurance form's own
    // first step (險種), so tapping it skips the drill-down entirely.
    if (topCat.name === "保險") {
      handleClose();
      onSelectInsurance();
      return;
    }
    setExpandedCategory((prev) => (prev === topCat.name ? null : topCat.name));
  };

  const handleSubItemClick = (node: CategoryNode, topCat: TopCategory) => {
    if (node.children && node.children.length > 0) {
      setDrillTarget({
        title: node.name,
        color: topCat.color,
        textColor: topCat.textColor,
        isLiability: topCat.isLiability,
        topCategory: topCat.name,
        items: node.children,
      });
    } else {
      onSelectCategory(topCat.name, topCat.isLiability, node.name, node.icon, topCat.color);
    }
  };

  const handleDrillItemClick = (node: CategoryNode) => {
    if (!drillTarget) return;
    onSelectCategory(
      drillTarget.topCategory,
      drillTarget.isLiability,
      node.name,
      node.icon,
      drillTarget.color
    );
  };

  return (
    <div
      className={`fixed inset-0 z-[60] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="mx-auto max-w-md px-4 pt-14">
        <div className="mb-6 flex items-center">
          <button
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <h1 className="flex-1 text-center text-[20px] font-bold text-[#1c1c1e]">
            {drillTarget ? drillTarget.title : "新增帳戶"}
          </h1>
        </div>
      </div>

      {/* Drill-down view (Level 3 items) */}
      {drillTarget ? (
        <div
          className="mx-auto max-w-md overflow-y-auto px-4"
          style={{ height: "calc(100vh - 120px)" }}
        >
          <div className="space-y-2 pb-8">
            {drillTarget.items.map((node) => {
              const Icon = node.icon;
              const isDark = drillTarget.textColor === "#ffffff";
              const iconColor = isDark ? drillTarget.color : "#3c3c3e";
              const iconBg = isDark ? drillTarget.color + "20" : "rgba(0,0,0,0.06)";
              return (
                <button
                  key={node.name}
                  onClick={() => handleDrillItemClick(node)}
                  className="flex w-full items-center gap-4 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition-colors active:bg-[#f2f2f7]"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: iconBg }}
                  >
                    <Icon size={20} style={{ color: iconColor }} />
                  </div>
                  <p className="text-[16px] font-medium text-[#1c1c1e]">{node.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Root view — accordion categories */
        <div
          className="mx-auto max-w-md overflow-y-auto px-4"
          style={{ height: "calc(100vh - 120px)" }}
        >
          <div className="space-y-3 pb-8">
            {CATEGORIES.map((topCat) => {
              const isExpanded = expandedCategory === topCat.name;
              return (
                <div key={topCat.name} className="overflow-hidden rounded-2xl shadow-sm">
                  {/* Category header — tap to expand/collapse */}
                  <button
                    onClick={() => handleTopCategoryClick(topCat)}
                    className="flex w-full items-center justify-between px-5 py-5 active:opacity-80"
                    style={{ backgroundColor: topCat.color }}
                  >
                    <p className="text-[18px] font-semibold" style={{ color: topCat.textColor }}>
                      {topCat.name}
                    </p>
                    {isExpanded ? (
                      <ChevronDown size={18} style={{ color: topCat.textColor, opacity: 0.6 }} />
                    ) : (
                      <ChevronRight size={18} style={{ color: topCat.textColor, opacity: 0.6 }} />
                    )}
                  </button>

                  {/* Sub-category items — smooth height animation via CSS Grid row trick */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                    style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-[#f2f2f7]">
                        {topCat.children.map((node, idx) => {
                          const Icon = node.icon;
                          const hasChildren = !!(node.children && node.children.length > 0);
                          const isLast = idx === topCat.children.length - 1;
                          const isDark = topCat.textColor === "#ffffff";
                          const iconColor = isDark ? topCat.color : "#3c3c3e";
                          const iconBg = isDark ? topCat.color + "20" : "rgba(0,0,0,0.06)";
                          return (
                            <div key={node.name}>
                              <button
                                onClick={() => handleSubItemClick(node, topCat)}
                                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors active:bg-[#f2f2f7]"
                              >
                                <div
                                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                                  style={{ backgroundColor: iconBg }}
                                >
                                  <Icon size={18} style={{ color: iconColor }} />
                                </div>
                                <p className="flex-1 text-[15px] font-medium text-[#1c1c1e]">
                                  {node.name}
                                </p>
                                {hasChildren && (
                                  <ChevronRight size={16} className="text-[#c7c7cc]" />
                                )}
                              </button>
                              {!isLast && <div className="mx-5 h-px bg-[#f2f2f7]" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
