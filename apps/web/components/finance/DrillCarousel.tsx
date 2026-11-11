"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CategoryNode } from "./categoryConfig";

// Web port of the DrillCarousel in apps/mobile/app/(app)/entry/new.tsx: a row
// of full-colour cards you swipe between (neighbours shrink and fade), a row
// of dots that selects in step, and a fixed 新增 button at the bottom.

const CARD_GAP = 16;
/** Card width as a share of the visible width — neighbours peek at both sides. */
const CARD_WIDTH_RATIO = 0.68;
const CARD_HEIGHT = 360;

/** The app's own brand colours, cycled — leaf nodes have no colour of their own. */
const BRAND_PALETTE = ["#374254", "#0e1424", "#66788E", "#C7C7D4"];

/** Sub-items with a ready-made card face (white background, centred logo). */
const DRILL_CARD_IMAGES: Record<string, string> = {
  "Line Pay": "/wallets/wallet-line-pay.png",
  "Apple Pay": "/wallets/wallet-apple-pay.png",
  街口支付: "/wallets/wallet-jko-pay.png",
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

function isPale(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.85;
}

export function DrillCarousel({
  topColor,
  items,
  onSubmit,
}: {
  topColor: string;
  items: CategoryNode[];
  onSubmit: (node: CategoryNode) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(0);
  const palette = useMemo(
    () => items.map((_, i) => BRAND_PALETTE[i % BRAND_PALETTE.length] ?? topColor),
    [items, topColor]
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardWidth = width * CARD_WIDTH_RATIO;
  const snap = cardWidth + CARD_GAP;
  const sidePad = (width - cardWidth) / 2;

  // Neighbours scale to 0.88 and fade to 0.55 across one snap — written straight
  // to the DOM on scroll, so no React render per frame.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || snap <= 0) return;
    let settle: number | undefined;
    const paint = () => {
      const x = sc.scrollLeft;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.min(1, Math.abs(x - i * snap) / snap);
        el.style.transform = `scale(${1 - 0.12 * d})`;
        el.style.opacity = String(1 - 0.45 * d);
      });
    };
    const onScroll = () => {
      paint();
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        setSelected(Math.min(items.length - 1, Math.max(0, Math.round(sc.scrollLeft / snap))));
      }, 90);
    };
    paint();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle);
    };
  }, [snap, items.length]);

  const selectIndex = (idx: number) => {
    setSelected(idx);
    scrollRef.current?.scrollTo({ left: idx * snap, behavior: "smooth" });
  };

  return (
    <div ref={wrapRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingLeft: sidePad, paddingRight: sidePad, scrollPaddingLeft: sidePad }}
          data-testid="drill-carousel"
        >
          {width > 0 &&
            items.map((node, i) => {
              const image = DRILL_CARD_IMAGES[node.name];
              const bg = palette[i]!;
              const { h, s, l } = hexToHsl(bg);
              const textColor = l > 62 ? "#1c1c1e" : "#ffffff";
              const pale = image != null || isPale(bg);
              return (
                <div
                  key={node.name}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  onClick={() => selectIndex(i)}
                  className="shrink-0 cursor-pointer snap-start overflow-hidden rounded-[28px] shadow-[0_8px_16px_rgba(0,0,0,0.18)] will-change-transform"
                  style={{
                    width: cardWidth,
                    height: CARD_HEIGHT,
                    marginRight: i === items.length - 1 ? 0 : CARD_GAP,
                    border: pale ? "0.5px solid #d8d8de" : undefined,
                  }}
                >
                  {image ? (
                    <img src={image} alt={node.name} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center p-4"
                      style={{
                        background: `linear-gradient(135deg, ${hsl(h, s, Math.min(l + 12, 92))}, ${bg}, ${hsl(h, s, Math.max(l - 10, 8))})`,
                      }}
                    >
                      <span
                        className="text-center text-[34px] font-extrabold tracking-[4px]"
                        style={{ color: textColor }}
                      >
                        {node.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <p className="mt-5 text-center text-[17px] font-bold text-[#1c1c1e]">
          {items[selected]?.name}
        </p>

        <div className="mt-3 flex h-[52px] items-center justify-center gap-4 overflow-x-auto px-4">
          {items.map((node, i) => (
            <button
              key={node.name}
              type="button"
              onClick={() => selectIndex(i)}
              aria-label={node.name}
              aria-pressed={selected === i}
              className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 ${
                selected === i ? "border-[#1c1c1e]" : "border-transparent"
              }`}
            >
              <span className="h-8 w-8 rounded-full" style={{ backgroundColor: palette[i] }} />
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-7 pb-8">
        <button
          type="button"
          onClick={() => {
            const node = items[selected];
            if (node) onSubmit(node);
          }}
          className="h-14 w-full cursor-pointer rounded-[28px] bg-[#1c1c1e] text-[17px] font-bold text-white active:opacity-85"
        >
          新增
        </button>
      </div>
    </div>
  );
}
