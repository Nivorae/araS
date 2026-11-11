"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Web port of apps/mobile/components/BottomSheet.tsx: the backdrop fades in
// place and only the panel slides (never the whole overlay), content stays
// mounted until the exit animation ends, and `onClosed` fires once the sheet
// is fully gone — so one sheet can open another after it.

const OPEN_MS = 280;
const CLOSE_MS = 220;
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";
const EASE_IN = "cubic-bezier(0.32, 0, 0.67, 0)";

export function BottomSheet({
  open,
  onClose,
  onClosed,
  dismissOnBackdrop = true,
  className = "",
  panelClassName = "",
  maxHeight,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires after the exit animation, once nothing of the sheet remains. */
  onClosed?: () => void;
  dismissOnBackdrop?: boolean;
  className?: string;
  /** Extra classes for the white panel (padding etc.). */
  panelClassName?: string;
  /** CSS max-height for the panel, e.g. "80dvh". */
  maxHeight?: string;
  /** Accessible name for the dialog. */
  label?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames: commit the off-screen start state, then animate in.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShown(false);
    const t = setTimeout(() => {
      setMounted(false);
      onClosedRef.current?.();
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  const dur = shown ? OPEN_MS : CLOSE_MS;
  const ease = shown ? EASE_OUT : EASE_IN;

  return createPortal(
    <div className={`fixed inset-0 z-[120] ${className}`} data-testid="bottom-sheet">
      <div
        className="absolute inset-0 bg-black/40"
        style={{ opacity: shown ? 1 : 0, transition: `opacity ${dur}ms ${ease}` }}
        onClick={dismissOnBackdrop ? onClose : undefined}
        data-testid="bottom-sheet-backdrop"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-t-[20px] bg-white md:max-w-xl lg:max-w-2xl ${panelClassName}`}
          style={{
            maxHeight,
            transform: shown ? "translateY(0)" : "translateY(100%)",
            transition: `transform ${dur}ms ${ease}`,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Grab handle shown at the top of most sheets. */
export function SheetHandle() {
  return <div className="mx-auto mt-2 mb-3 h-1 w-9 shrink-0 rounded-full bg-[#d1d1d6]" />;
}
