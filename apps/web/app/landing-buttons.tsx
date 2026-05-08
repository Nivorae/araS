"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./landing-buttons.module.css";

function Sheen() {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        background:
          "linear-gradient(128deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.15) 30%, transparent 55%)",
        pointerEvents: "none",
      }}
    />
  );
}

const BUTTONS = [
  {
    href: "/sign-in",
    label: "登入",
    loadingLabel: "登入中",
    style: {
      minWidth: 200,
      padding: "14px 40px",
      borderRadius: 100,
      fontSize: 15,
      fontWeight: 600,
      color: "#fff",
      background: "linear-gradient(160deg, rgba(55,66,84,0.92) 0%, rgba(30,40,54,0.96) 100%)",
      border: "1.5px solid rgba(90,100,120,0.5)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: [
        "0 10px 32px rgba(0,0,0,0.18)",
        "0 3px 8px rgba(0,0,0,0.10)",
        "inset 0 2px 3px rgba(255,255,255,0.18)",
        "inset 0 -1px 2px rgba(0,0,0,0.20)",
      ].join(", "),
    },
  },
  {
    href: "/sign-up",
    label: "註冊",
    loadingLabel: "註冊中",
    style: {
      minWidth: 200,
      padding: "14px 40px",
      borderRadius: 100,
      fontSize: 15,
      fontWeight: 600,
      color: "#374254",
      background:
        "linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(245,245,248,0.88) 40%, rgba(238,238,244,0.82) 65%, rgba(248,248,252,0.90) 100%)",
      border: "1.5px solid rgba(190,190,200,0.70)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: [
        "0 10px 32px rgba(0,0,0,0.12)",
        "0 3px 8px rgba(0,0,0,0.08)",
        "inset 0 2px 3px rgba(255,255,255,1)",
        "inset 2px 0 3px rgba(255,255,255,0.80)",
        "inset 0 -2px 4px rgba(180,180,190,0.25)",
      ].join(", "),
    },
  },
  {
    href: "/assets",
    label: "訪客",
    loadingLabel: "進入中",
    style: {
      minWidth: 160,
      padding: "11px 40px",
      borderRadius: 100,
      fontSize: 14,
      fontWeight: 500,
      color: "#8e8e93",
      background:
        "linear-gradient(160deg, rgba(255,255,255,0.60) 0%, rgba(245,245,248,0.45) 65%, rgba(238,238,244,0.40) 100%)",
      border: "1.5px solid rgba(180,180,190,0.40)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: ["0 4px 14px rgba(0,0,0,0.07)", "inset 0 1px 2px rgba(255,255,255,0.80)"].join(
        ", "
      ),
    },
  },
] as const;

export function LandingButtons() {
  const router = useRouter();
  const [activeHref, setActiveHref] = useState<string | null>(null);

  function handleClick(href: string) {
    if (activeHref) return;
    setActiveHref(href);
    router.push(href);
  }

  return (
    <div
      className="absolute right-0 left-0 flex flex-col items-center"
      style={{ bottom: 36, gap: 12, zIndex: 20 }}
    >
      {BUTTONS.map((btn) => {
        const isActive = activeHref === btn.href;
        const isDisabled = activeHref !== null;

        return (
          <button
            key={btn.href}
            onClick={() => handleClick(btn.href)}
            disabled={isDisabled}
            className="relative flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#374254]/60 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none"
            style={{
              ...btn.style,
              opacity: isActive ? 0.7 : isDisabled ? 0.5 : 1,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
          >
            <Sheen />
            {isActive ? <span className={styles.spinner} aria-hidden /> : btn.label}
            {isActive && <span className="sr-only">{btn.loadingLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
