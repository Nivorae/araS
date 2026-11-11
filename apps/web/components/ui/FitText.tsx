"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Single-line text that shrinks to fit its width — the web stand-in for React
 * Native's `numberOfLines={1} adjustsFontSizeToFit minimumFontScale`. Never
 * grows above `fontSize`, never shrinks below `fontSize * minScale` (it clips
 * past that). Child elements can size themselves in `em` to scale along.
 */
export function FitText({
  children,
  fontSize,
  minScale = 0.6,
  className = "",
  style,
}: {
  children: ReactNode;
  fontSize: number;
  minScale?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = `${fontSize}px`;
      const avail = el.clientWidth;
      const need = el.scrollWidth;
      if (avail > 0 && need > avail) {
        el.style.fontSize = `${Math.max(fontSize * minScale, (fontSize * avail) / need)}px`;
      }
    };
    fit();
    // jsdom (tests) has no ResizeObserver; the one-off fit above is enough there.
    if (typeof ResizeObserver === "undefined") return;
    // The element is block-level, so its width comes from the parent and a
    // font-size change can't feed back into another resize.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fontSize, minScale, children]);

  return (
    <span
      ref={ref}
      className={`block overflow-hidden whitespace-nowrap ${className}`}
      style={{ ...style, fontSize }}
    >
      {children}
    </span>
  );
}
