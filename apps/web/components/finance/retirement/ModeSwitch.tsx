"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

// Web port of apps/mobile/components/retirement/ModeSwitch.tsx.

export type PlanMode = "retirement" | "finance";

const EXIT_MS = 110;
const ENTER_MS = 220;
const OFFSET = 28;
const EASE_OUT_QUAD = "cubic-bezier(0.5, 1, 0.89, 1)";
const EASE_OUT_CUBIC = "cubic-bezier(0.33, 1, 0.68, 1)";
// Approximates the mobile spring (damping 20, stiffness 190, mass 0.9).
const SPRING = "cubic-bezier(0.34, 1.2, 0.64, 1)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * `selected` follows the tap immediately (drives the toggle pill); `mode` is
 * what the page renders and only flips once the old content has faded and slid
 * out. The new content then slides in from the other side — but only after it
 * has rendered, so the animation never plays on the stale content.
 * `style` is shared by every block that should move together.
 */
export function useModeTransition(initial: PlanMode) {
  const [selected, setSelected] = useState<PlanMode>(initial);
  const [mode, setMode] = useState<PlanMode>(initial);
  const [style, setStyle] = useState<CSSProperties>({});
  const [enterNonce, setEnterNonce] = useState(0);
  const dirRef = useRef(1);
  const timer = useRef<number | undefined>(undefined);
  const raf = useRef<number | undefined>(undefined);

  const select = (next: PlanMode) => {
    if (next === selected) return;
    setSelected(next);
    window.clearTimeout(timer.current);
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) {
      setMode(next);
      setStyle({});
      return;
    }
    // 理財規劃 is the right-hand tab: going there moves content to the left.
    const dir = next === "finance" ? 1 : -1;
    dirRef.current = dir;
    setStyle({
      opacity: 0,
      transform: `translateX(${-dir * OFFSET}px)`,
      transition: `opacity ${EXIT_MS}ms ${EASE_OUT_QUAD}, transform ${EXIT_MS}ms ${EASE_OUT_QUAD}`,
    });
    timer.current = window.setTimeout(() => {
      setMode(next);
      // A nonce rather than `mode` drives the enter: switching away and back
      // during the exit leaves `mode` unchanged but still needs to fade in.
      setEnterNonce((n) => n + 1);
    }, EXIT_MS);
  };

  useLayoutEffect(() => {
    if (enterNonce === 0) return;
    const dir = dirRef.current;
    setStyle({ opacity: 0, transform: `translateX(${dir * OFFSET}px)`, transition: "none" });
    // Two frames: the first commits the off-screen start position, the second
    // starts the transition from it.
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        setStyle({
          opacity: 1,
          transform: "translateX(0)",
          transition: `opacity ${ENTER_MS}ms ${EASE_OUT_CUBIC}, transform 420ms ${SPRING}`,
        });
      });
    });
  }, [enterNonce]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    },
    []
  );

  return { selected, mode, style, select };
}

const OPTIONS: { value: PlanMode; label: string }[] = [
  { value: "retirement", label: "退休計劃" },
  { value: "finance", label: "理財規劃" },
];

/** Segmented control with a white pill that springs between the two modes. */
export function ModeToggle({
  value,
  onChange,
}: {
  value: PlanMode;
  onChange: (v: PlanMode) => void;
}) {
  const index = OPTIONS.findIndex((o) => o.value === value);
  return (
    <div role="tablist" aria-label="模式" className="relative flex rounded-xl bg-[#e5e5ea] p-[3px]">
      <div
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-[10px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
        style={{
          width: "calc(50% - 3px)",
          transform: `translateX(${index * 100}%)`,
          transition: `transform 380ms ${SPRING}`,
        }}
      />
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className="relative z-10 flex-1 cursor-pointer py-2.5 text-[14px] font-semibold transition-colors duration-300"
            style={{ color: active ? "#1c1c1e" : "#8e8e93" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
