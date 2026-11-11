"use client";

import { useEffect, useRef, useState } from "react";

// Web port of apps/mobile/components/SegmentedToggle.tsx: fixed-width
// segments, a white pill that springs to the active one, a press squeeze and a
// little hop on the segment that just became active.

const SEG_W = 66;
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onPress,
}: {
  options: SegmentOption<T>[];
  value: T;
  /** The parent decides whether the tap switches (gated segments may not). */
  onPress: (v: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const [hopping, setHopping] = useState<T | null>(null);
  const prev = useRef<T>(value);

  // Hop only on a transition into active — never on first mount.
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setHopping(value);
    const t = setTimeout(() => setHopping(null), 520);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div role="tablist" className="relative flex rounded-[20px] bg-[#e5e5ea] p-[3px]">
      <div
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-[17px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
        style={{
          width: SEG_W,
          transform: `translateX(${index * SEG_W}px)`,
          transition: `transform 350ms ${SPRING}`,
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPress(o.value)}
            className="relative z-10 cursor-pointer py-1.5 text-[13px] font-semibold transition-[color,transform] duration-200 active:scale-[0.86] active:duration-75"
            style={{ width: SEG_W, color: active ? "#1c1c1e" : "#8e8e93" }}
          >
            <span
              className="inline-block"
              style={hopping === o.value ? { animation: `segment-hop 520ms ${SPRING}` } : undefined}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
