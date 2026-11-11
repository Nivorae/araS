"use client";

import { useEffect, useState } from "react";
import type { ModalContent } from "../../../lib/retirement";

const ANIMATION_DURATION = 330;

/**
 * 「計算說明」bottom sheet shared by the retirement metric cards and the
 * finance-planning rule cards (mobile components/retirement/InfoModal.tsx):
 * 88% of the viewport tall, capped to the app column width on wide screens.
 */
export function InfoModal({ content, onClose }: { content: ModalContent; onClose: () => void }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, ANIMATION_DURATION);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsClosing(true);
        setTimeout(onClose, ANIMATION_DURATION);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const easing = "cubic-bezier(0.32,0.72,0,1)";
  const dur = `${ANIMATION_DURATION}ms`;

  return (
    <div data-testid="modal-backdrop" className="fixed inset-0 z-50" onClick={handleClose}>
      {/* Scrim — fades in/out */}
      <div
        className="absolute inset-0 bg-black/30"
        style={{
          animation: isClosing
            ? `modal-scrim-out ${dur} ${easing} forwards`
            : `modal-scrim-in ${dur} ${easing}`,
        }}
      />

      {/* Bottom sheet — 88% tall, column-width on wide screens */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        className="absolute right-0 bottom-0 left-0 mx-auto flex max-w-md flex-col overflow-hidden rounded-t-3xl md:max-w-xl lg:max-w-2xl"
        style={{
          height: "88dvh",
          overscrollBehavior: "contain",
          animation: isClosing
            ? `modal-slide-down ${dur} ${easing} forwards`
            : `modal-slide-up ${dur} ${easing}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pointer-events-none absolute top-3 right-0 left-0 z-10 flex justify-center">
          <div className="h-1 w-8 rounded-full bg-white/20" />
        </div>

        {/* Hero */}
        <div className="flex-shrink-0 bg-[#0e1424] px-6 pt-10 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
              計算說明
            </span>
            <button
              aria-label="關閉"
              onClick={handleClose}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-[17px] leading-none text-white/60"
            >
              ×
            </button>
          </div>
          <h2 className="text-[28px] font-bold text-white">{content.result.label}</h2>
          <p className="mt-5 text-[40px] leading-none font-bold text-[#ff9500]">
            {content.result.value}
          </p>
          <p className="mt-6 text-[13px] leading-relaxed text-white/70">{content.description}</p>
        </div>

        {/* Formula — fills remaining space */}
        <div className="flex-1 overflow-auto bg-[#f2f2f7] px-5 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="mb-3 text-[16px] font-bold tracking-widest text-[#8e8e93] uppercase">
            計算公式
          </p>
          <div className="space-y-2">
            {content.steps.map((step) => (
              <div
                key={step.label}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5"
              >
                <span className="text-[13px] text-[#8e8e93]">{step.label}</span>
                {step.value && (
                  <span className="ml-3 text-right text-[13px] font-semibold text-[#1c1c1e]">
                    {step.value}
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleClose}
            className="mt-6 w-full cursor-pointer rounded-2xl bg-[#1c1c1e] py-3 text-[15px] font-semibold text-white"
          >
            了解了
          </button>
        </div>
      </div>
    </div>
  );
}
