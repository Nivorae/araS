import Image from "next/image";
import styles from "./page.module.css";
import { LandingButtons } from "./landing-buttons";

interface CardConfig {
  name: string;
  color: string;
  textColor: string;
  value: string;
  depth: "near" | "mid" | "far";
  blur: string;
  opacity: number;
  /**
   * Vertical position as a share of the stage height rather than a pixel
   * offset. The composition was laid out against a ~844pt phone; on an iPad
   * the same percentages keep the cards spread over the whole screen instead
   * of bunching into the top two-thirds.
   */
  topPct: number;
  left?: number;
  right?: number;
  duration: string;
  delay: string;
  boxShadow: string;
}

// Decorative placeholder values — not wired to real data
const CARDS: CardConfig[] = [
  {
    name: "投資",
    color: "#0e1424",
    textColor: "#ffffff",
    value: "NT$82,500",
    depth: "near",
    blur: "0px",
    opacity: 1,
    topPct: 7.7,
    right: -30,
    duration: "3.8s",
    delay: "0s",
    boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
  },
  {
    name: "負債",
    color: "#C7C7D4",
    textColor: "#1c1c1e",
    value: "NT$320,000",
    depth: "far",
    blur: "7px",
    opacity: 0.55,
    topPct: 13.6,
    left: 32,
    duration: "5.2s",
    delay: "-1.3s",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
  {
    name: "流動資金",
    color: "#66788E",
    textColor: "#ffffff",
    value: "NT$540,000",
    depth: "mid",
    blur: "0px",
    opacity: 0.78,
    topPct: 37.3,
    left: -28,
    duration: "4.5s",
    delay: "-2.1s",
    boxShadow: "0 8px 28px rgba(102,120,142,0.35)",
  },
  {
    name: "固定資產",
    color: "#374254",
    textColor: "#ffffff",
    value: "NT$4,200,000",
    depth: "far",
    blur: "7px",
    opacity: 0.55,
    topPct: 43.6,
    right: 8,
    duration: "6.1s",
    delay: "-0.8s",
    boxShadow: "0 8px 28px rgba(55,66,84,0.30)",
  },
  {
    name: "應收帳款",
    color: "#FFFFFF",
    textColor: "#1c1c1e",
    value: "NT$15,000",
    depth: "near",
    blur: "7px",
    opacity: 1,
    topPct: 66.6,
    left: 38,
    duration: "4.2s",
    delay: "-3.0s",
    boxShadow: "0 10px 28px rgba(14,20,36,0.38)",
  },
];

const depthClass: Record<CardConfig["depth"], string> = {
  near: styles.near ?? "",
  mid: styles.mid ?? "",
  far: styles.far ?? "",
};

const entryClasses = [
  styles["enter-0"] ?? "",
  styles["enter-1"] ?? "",
  styles["enter-2"] ?? "",
  styles["enter-3"] ?? "",
  styles["enter-4"] ?? "",
];

export default function RootPage() {
  return (
    <main className="relative overflow-hidden" style={{ height: "100dvh", background: "#f7f7fa" }}>
      {/*
        Background depth cards. The stage keeps the composition at phone
        proportions and centres it, so on an iPad the cards frame the logo
        instead of splaying out to the far edges of a 768–1366pt screen.
        Card size scales with the stage via --card-size.
      */}
      <div className="relative mx-auto h-full w-full max-w-[430px] [--card-size:136px] md:max-w-[600px] md:[--card-size:172px]">
        {CARDS.map((card, i) => (
          <div
            key={card.name}
            className={`absolute h-[var(--card-size)] w-[var(--card-size)] ${entryClasses[i]}`}
            style={{
              top: `${card.topPct}%`,
              ...(card.left !== undefined ? { left: card.left } : {}),
              ...(card.right !== undefined ? { right: card.right } : {}),
            }}
          >
            <div
              className={`flex h-full w-full flex-col items-center justify-center ${depthClass[card.depth]}`}
              style={
                {
                  borderRadius: 22,
                  background: card.color,
                  boxShadow: card.boxShadow,
                  filter: `blur(${card.blur})`,
                  opacity: card.opacity,
                  gap: 6,
                  padding: 12,
                  "--dur": card.duration,
                  "--delay": card.delay,
                } as React.CSSProperties
              }
            >
              <span
                className="w-full text-center text-[18px] md:text-[22px]"
                style={{
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                  color: card.textColor,
                }}
              >
                {card.name}
              </span>
              <span
                className="w-full text-center text-[18px] md:text-[22px]"
                style={{
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: card.textColor,
                }}
              >
                {card.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Center: icon + subtitle */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        style={{ top: "48%", gap: 10, zIndex: 10 }}
      >
        <Image
          src="/icons/icon.svg"
          alt="araS"
          width={96}
          height={96}
          priority
          className="md:h-[124px] md:w-[124px]"
          style={{
            borderRadius: 22,
            boxShadow: "0 8px 28px rgba(55,66,84,0.28)",
          }}
        />
        <p className="mt-2 w-full text-center text-2xl font-bold whitespace-nowrap text-gray-600 italic md:text-3xl">
          araS
        </p>
        <p className="text-1xl w-full text-center font-bold whitespace-nowrap text-gray-600 italic md:text-xl">
          個人資產管理工具
        </p>
      </div>

      <LandingButtons />
    </main>
  );
}
