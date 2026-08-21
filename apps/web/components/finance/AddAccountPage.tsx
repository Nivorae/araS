"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES, type CategoryNode, type TopCategory } from "./categoryConfig";

/**
 * 版面比例 —— 與 apps/mobile/app/(app)/entry/new.tsx 同一套：上方 15%、空隙 0%、
 * 卡片堆疊區 85%。卡片高度由容器決定，不是被內容撐出來的。
 *
 * ⚠️ 這是 flex 權重不是百分比，只因為總和是 100 才剛好相等。另外卡片上方的可見
 * 空隙是 (TOP_FLEX + GAP_FLEX) 佔的高度減掉上方內容的自然高度（約 96pt），在這
 * 兩者之間搬動數字沒有效果，要縮小只能減少總和。
 */
const TOP_FLEX = 15;
const GAP_FLEX = 0;
const STACK_FLEX = 85;

/**
 * 卡片彼此重疊多少。堆疊感全靠這個負的 marginTop —— 每張卡的圓角上緣壓在前一
 * 張卡的下緣上。不影響卡片的可見高度，只決定露出多少下一張卡的顏色。
 */
const CARD_OVERLAP = 28;

/** 展開時子項目下方的呼吸空間。算高度時要一起算進去。 */
const EXPANDED_PAD_BOTTOM = 24;

/** 卡片列的高度下限。子項目多到擠不下時寧可讓整疊超出容器、恢復成可捲動。 */
const MIN_BAND = 56;

/**
 * 流動資金是 #FFFFFF、保險是 #f2f2f7，跟頁面底色 #f2f2f7 幾乎同色 —— 堆疊版面
 * 靠卡片邊界辨識層次，這兩張會整片糊在一起。這裡不改 categoryConfig 的顏色
 * （那組色票同時被 entry 詳情頁與圖表使用），改成偵測出「淺色卡」後補一條細
 * 邊框讓它浮起來。
 *
 * 用相對亮度而不是寫死那兩個色碼，之後有人調色票也不會默默失效。
 * 與 apps/mobile/app/(app)/entry/new.tsx 的 isPaleColor 是同一套判斷。
 */
function isPaleColor(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.85;
}

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
  const showStack = !drillTarget;

  // 卡片高度是「容器決定內容」，所以得先量到堆疊區的實際高度才能平分；展開的
  // 子項目區也要量（chip 依寬度換行，行數算不出來）。
  const stackRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [stackHeight, setStackHeight] = useState(0);
  const [subHeight, setSubHeight] = useState(0);

  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setStackHeight(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [showStack]);

  useEffect(() => {
    const el = subRef.current;
    if (!el) {
      setSubHeight(0);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSubHeight(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expandedCategory]);

  /**
   * 容器高度固定是 75%，所以一張卡展開時由六張一起讓出空間 —— 而不是讓整疊長
   * 出容器再靠捲動補救（那會把最上面那張推出畫面）。先扣掉展開區的高度，剩下
   * 的才平分給六張的內容列。
   */
  const expandedExtra = expandedCategory ? subHeight + EXPANDED_PAD_BOTTOM : 0;
  const band =
    stackHeight > 0 ? Math.max(MIN_BAND, (stackHeight - expandedExtra) / CATEGORIES.length) : 0;

  const handleClose = () => {
    setExpandedCategory(null);
    setDrillTarget(null);
    onClose();
  };

  const handleBack = () => {
    if (drillTarget) {
      setDrillTarget(null);
    } else if (expandedCategory) {
      setExpandedCategory(null);
    } else {
      handleClose();
    }
  };

  /** 點卡片以外的區域（上方標題區）收合展開中的卡片。 */
  const collapseAll = () => {
    setExpandedCategory(null);
  };

  const handleTopCategoryClick = (topCat: TopCategory) => {
    // web 的 categoryConfig 裡保險是 children: []（險種是保險表單自己的第一步，
    // 不是這裡的子節點），展開會是一排空的 —— 所以它跳過展開直接開表單。
    // mobile 的設定給了保險一個「新增」子項目，所以那邊是展開後再點。這是既有
    // 的設定差異，不是這次改版造成的。
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

  const header = (
    <div className="mb-4 flex items-center px-4">
      <button
        onClick={(e) => {
          // 阻止冒泡到上方區塊的 collapseAll —— 返回鍵有自己的層級語意
          // （鑽入層 → 大類 → 關閉），不該被單純的「收合」蓋過。
          e.stopPropagation();
          handleBack();
        }}
        aria-label="返回"
        className="flex h-10 w-10 shrink-0 items-center justify-center"
      >
        <ChevronLeft size={24} className="text-[#1c1c1e]" />
      </button>
      <h1 className="flex-1 text-center text-[20px] font-bold text-[#1c1c1e]">
        {drillTarget ? drillTarget.title : "新增帳戶"}
      </h1>
      <div className="h-10 w-10 shrink-0" />
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[60] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto flex h-full max-w-md flex-col pt-10 md:max-w-xl lg:max-w-2xl">
        {drillTarget ? (
          <>
            {header}
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-8">
              {drillTarget.items.map((node) => {
                const Icon = node.icon;
                const isDark = drillTarget.textColor === "#ffffff";
                const iconColor = isDark ? drillTarget.color : "#3c3c3e";
                return (
                  <button
                    key={node.name}
                    onClick={() => handleDrillItemClick(node)}
                    className="flex w-full items-center gap-3.5 rounded-2xl bg-white px-5 py-4 text-left shadow-sm transition-colors active:bg-[#f2f2f7]"
                  >
                    <Icon size={22} style={{ color: iconColor }} />
                    <p className="text-[16px] font-medium text-[#1c1c1e]">{node.name}</p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* 內容只有一列，flex 置中讓它在這 15% 的區塊裡垂直置中 */}
            <div
              onClick={collapseAll}
              style={{ flex: TOP_FLEX }}
              className="flex flex-col justify-center"
            >
              {header}
            </div>

            <div style={{ flex: GAP_FLEX }} />

            {/* overscroll-none：iOS Safari 上同樣會有彈性回捲，理由見 mobile 版註解 */}
            <div
              ref={stackRef}
              style={{ flex: STACK_FLEX }}
              className="overflow-y-auto overscroll-none"
            >
              {band > 0 && (
                <div className="flex min-h-full flex-col justify-end">
                  {CATEGORIES.map((topCat, idx) => {
                    const isExpanded = expandedCategory === topCat.name;
                    // 最後一張沒有下一張壓上來，不需要那段被蓋住的下緣補償，
                    // 並補圓下緣兩角讓整疊有明確的結尾。
                    const isLast = idx === CATEGORIES.length - 1;
                    const isDark = topCat.textColor === "#ffffff";
                    const pale = isPaleColor(topCat.color);
                    // 卡片自己就是底色，所以子項目 chip 用同色系的透明疊層，
                    // 而不是另外挑一個會跟六種底色打架的固定色。
                    const chipBg = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.06)";
                    const hiddenPad = isLast ? 0 : CARD_OVERLAP;
                    return (
                      <div
                        key={topCat.name}
                        className={`shrink-0 rounded-t-[28px] px-5 ${
                          isLast ? "rounded-b-[28px]" : ""
                        } ${pale ? "border-t border-[#d8d8de]" : ""} ${
                          isLast && pale ? "border-b border-[#d8d8de]" : ""
                        }`}
                        style={{
                          backgroundColor: topCat.color,
                          zIndex: idx + 1,
                          marginTop: idx > 0 ? -CARD_OVERLAP : undefined,
                          paddingBottom: hiddenPad + (isExpanded ? EXPANDED_PAD_BOTTOM : 0),
                          // 陰影朝上，投在被壓住的那張卡上，層次才看得出來。
                          boxShadow: "0 -4px 12px rgba(0,0,0,0.10)",
                        }}
                      >
                        <button
                          onClick={() => handleTopCategoryClick(topCat)}
                          // min-height 而非 height —— 展開時內容比 band 高，要能長出去。
                          // CSS transition 讓展開與收合都有動畫，不需要像 RN 那樣
                          // 手動安排 LayoutAnimation。
                          style={{ minHeight: band }}
                          className="flex w-full items-center transition-[min-height] duration-300 ease-in-out"
                        >
                          <span
                            className="flex-1 truncate text-center text-[22px] font-bold tracking-tight"
                            style={{ color: topCat.textColor }}
                          >
                            {topCat.name}
                          </span>
                        </button>

                        {isExpanded && (
                          <div ref={subRef} className="flex flex-wrap gap-2">
                            {topCat.children.map((node) => {
                              const SubIcon = node.icon;
                              const hasChildren = !!(node.children && node.children.length > 0);
                              return (
                                <button
                                  key={node.name}
                                  onClick={() => handleSubItemClick(node, topCat)}
                                  className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 transition-opacity active:opacity-70"
                                  style={{ backgroundColor: chipBg }}
                                >
                                  <SubIcon size={16} style={{ color: topCat.textColor }} />
                                  <span
                                    className="text-[14px] font-semibold"
                                    style={{ color: topCat.textColor }}
                                  >
                                    {node.name}
                                  </span>
                                  {hasChildren && (
                                    <ChevronRight
                                      size={13}
                                      style={{ color: topCat.textColor, opacity: 0.6 }}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
