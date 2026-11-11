"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CATEGORIES } from "./categoryConfig";

// Web port of apps/mobile/components/EmptyAssetsVortex.tsx: the top categories
// flow along an Archimedean spiral from off-screen into the centre, shrinking
// and fading as they arrive, with the "add your first entry" CTA at the
// convergence point. One rAF loop writes transforms straight to the DOM —
// no React render per frame.

const TWO_PI = Math.PI * 2;
const TURNS = 2.6;
// >1 deliberately overflows the container: the outer arm is clipped, so the
// stream reads as infinite rather than as a ring of cards popping in.
const SPREAD = 1.85;
const SLOTS = 12;
const CYCLE_MS = 26000;
const FADE_IN = 0.2;
const FADE_OUT = 0.1;
const SIZE_ATTENUATION = 2;
const CARD_W = 152;
const CARD_H = 94;

function spiralX(n: number, R: number) {
  return R * (1 - n) * Math.cos(n * TURNS * TWO_PI);
}
function spiralY(n: number, R: number) {
  return -R * (1 - n) * Math.sin(n * TURNS * TWO_PI);
}

// Arc-length reparameterization: stepping n uniformly bunches cards near the
// centre; stepping arc length keeps the gap constant. Built once at R=1.
const ARC_TABLE = (() => {
  const M = 1200;
  const cum = new Array<number>(M + 1);
  cum[0] = 0;
  let px = spiralX(0, 1);
  let py = spiralY(0, 1);
  for (let k = 1; k <= M; k++) {
    const x = spiralX(k / M, 1);
    const y = spiralY(k / M, 1);
    cum[k] = cum[k - 1]! + Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const total = cum[M]! || 1;
  const K = 128;
  const table = new Array<number>(K + 1);
  let j = 0;
  for (let a = 0; a <= K; a++) {
    const target = (a / K) * total;
    while (j < M && cum[j + 1]! < target) j++;
    const seg = cum[j + 1]! - cum[j]!;
    table[a] = (j + (seg > 0 ? (target - cum[j]!) / seg : 0)) / M;
  }
  return table;
})();

// Interpolated, not rounded: rounding quantises the motion into visible steps.
function arcToN(s: number) {
  const K = ARC_TABLE.length - 1;
  const x = Math.max(0, Math.min(K, s * K));
  const i = Math.floor(x);
  const a = ARC_TABLE[i]!;
  const b = ARC_TABLE[Math.min(i + 1, K)]!;
  return a + (b - a) * (x - i);
}

export function cardTransform(progress: number, index: number, w: number, h: number) {
  const offset = index / SLOTS;
  const R = 0.48 * Math.min(w, h) * SPREAD;
  const t = (((progress + offset) % 1) + 1) % 1;
  const n = arcToN(t);
  const x = spiralX(n, R);
  const y = spiralY(n, R);
  const nAhead = Math.min(n + 0.002, 1);
  const angle = Math.atan2(spiralY(nAhead, R) - y, spiralX(nAhead, R) - x);
  const dist = Math.hypot(x, y);
  const scale = Math.pow(Math.min(dist / R, 1), SIZE_ATTENUATION * 0.5);
  let opacity = 1;
  if (t < FADE_IN) opacity = t / FADE_IN;
  else if (t > 1 - FADE_OUT) opacity = (1 - t) / FADE_OUT;
  return {
    opacity,
    transform: `translate(${w / 2 + x - CARD_W / 2}px, ${h / 2 + y - CARD_H / 2}px) rotate(${angle}rad) scale(${scale})`,
  };
}

export function EmptyAssetsVortex({ onAdd }: { onAdd: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () =>
      setSize((p) =>
        p.w === el.clientWidth && p.h === el.clientHeight
          ? p
          : { w: el.clientWidth, h: el.clientHeight }
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w === 0) return;
    const paint = (progress: number) => {
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const { opacity, transform } = cardTransform(progress, i, size.w, size.h);
        el.style.opacity = String(opacity);
        el.style.transform = transform;
      });
    };
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion freezes the spiral into a static, still-composed fan.
    if (reduce) {
      paint(0.35);
      return;
    }
    // Phase survives pauses: resume from where it stopped, not from 0.
    let phase = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      phase = (phase + (now - last) / CYCLE_MS) % 1;
      last = now;
      paint(phase);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    // Parked while the tab is hidden.
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) start();
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [size]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
    >
      {size.w > 0 &&
        Array.from({ length: SLOTS }, (_, i) => {
          const cat = CATEGORIES[i % CATEGORIES.length]!;
          const pale = cat.color.toUpperCase() === "#FFFFFF" || cat.color === "#f2f2f7";
          return (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 flex items-center justify-center rounded-[18px] shadow-[0_3px_10px_rgba(0,0,0,0.11)] will-change-transform"
              style={{
                width: CARD_W,
                height: CARD_H,
                backgroundColor: cat.color,
                border: pale ? "1px solid rgba(28,28,30,0.12)" : undefined,
                opacity: 0,
              }}
            >
              <span className="truncate text-[24px] font-bold" style={{ color: cat.textColor }}>
                {cat.name}
              </span>
            </div>
          );
        })}

      <button
        type="button"
        onClick={onAdd}
        className="relative z-10 flex cursor-pointer flex-col items-center rounded-[22px] px-8 py-[22px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-sm active:opacity-85"
        style={{
          background: "rgba(255,255,255,0.62)",
          border: "0.5px solid rgba(255,255,255,0.85)",
          borderTop: "1.5px solid rgba(255,255,255,0.9)",
        }}
      >
        <img
          src="/icons/app-icon.png"
          alt=""
          width={64}
          height={64}
          className="mb-3 h-16 w-16 rounded-2xl shadow-[0_6px_12px_rgba(55,66,84,0.24)]"
        />
        <span className="text-[15px] font-semibold text-[#374254]">＋ 新增第一筆資產</span>
      </button>
    </div>
  );
}
