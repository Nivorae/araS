# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `apps/web/app/page.tsx` to show the app icon, five animated depth-layered category cards, and three individual glass-pill navigation buttons.

**Architecture:** Single-file rewrite of `page.tsx` (server component — no client state needed since animations are CSS-only). A companion CSS module `page.module.css` holds the three `@keyframes` breath animations with CSS custom properties for per-card duration/delay. All other styling uses inline styles, matching the pattern established in `BottomNav.tsx`.

**Tech Stack:** Next.js 15 App Router, React 19, CSS Modules (keyframes only), `next/image`, inline styles.

---

## Files

| Action | Path                           | Purpose                                      |
| ------ | ------------------------------ | -------------------------------------------- |
| Create | `apps/web/app/page.module.css` | `@keyframes` definitions + animation classes |
| Modify | `apps/web/app/page.tsx`        | Full page rewrite                            |

---

## Task 1: Create CSS animation module

**Files:**

- Create: `apps/web/app/page.module.css`

- [ ] **Step 1: Create the CSS module**

Create `apps/web/app/page.module.css` with the following content:

```css
@keyframes breatheNear {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@keyframes breatheMid {
  0%,
  100% {
    transform: scale(0.93);
  }
  50% {
    transform: scale(1.02);
  }
}

@keyframes breatheFar {
  0%,
  100% {
    transform: scale(0.82);
  }
  50% {
    transform: scale(0.91);
  }
}

.near {
  animation-name: breatheNear;
  animation-duration: var(--dur, 3.8s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-delay: var(--delay, 0s);
}

.mid {
  animation-name: breatheMid;
  animation-duration: var(--dur, 4.5s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-delay: var(--delay, 0s);
}

.far {
  animation-name: breatheFar;
  animation-duration: var(--dur, 5.2s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-delay: var(--delay, 0s);
}
```

- [ ] **Step 2: Verify file was created**

```bash
ls apps/web/app/page.module.css
```

Expected: file listed with no error.

---

## Task 2: Rewrite page.tsx

**Files:**

- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace the entire file with the new implementation**

Replace `apps/web/app/page.tsx` with:

```tsx
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

interface CardConfig {
  name: string;
  color: string;
  textColor: string;
  value: string;
  depth: "near" | "mid" | "far";
  blur: string;
  opacity: number;
  top: number;
  left?: number;
  right?: number;
  duration: string;
  delay: string;
  boxShadow: string;
}

const CARDS: CardConfig[] = [
  {
    name: "流動資金",
    color: "#FFFFFF",
    textColor: "#1c1c1e",
    value: "NT$82,500",
    depth: "near",
    blur: "0px",
    opacity: 1,
    top: 65,
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
    top: 115,
    left: 32,
    duration: "5.2s",
    delay: "-1.3s",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
  {
    name: "投資",
    color: "#66788E",
    textColor: "#ffffff",
    value: "NT$540,000",
    depth: "mid",
    blur: "2.5px",
    opacity: 0.78,
    top: 315,
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
    top: 368,
    right: 28,
    duration: "6.1s",
    delay: "-0.8s",
    boxShadow: "0 8px 28px rgba(55,66,84,0.30)",
  },
  {
    name: "應收款",
    color: "#0e1424",
    textColor: "#ffffff",
    value: "NT$15,000",
    depth: "near",
    blur: "0px",
    opacity: 1,
    top: 462,
    left: 38,
    duration: "4.2s",
    delay: "-3.0s",
    boxShadow: "0 10px 28px rgba(14,20,36,0.38)",
  },
];

const depthClass: Record<CardConfig["depth"], string> = {
  near: styles.near,
  mid: styles.mid,
  far: styles.far,
};

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

export default function RootPage() {
  return (
    <main className="relative overflow-hidden" style={{ height: "100dvh", background: "#f7f7fa" }}>
      {/* Background depth cards */}
      {CARDS.map((card) => (
        <div
          key={card.name}
          className={depthClass[card.depth]}
          style={
            {
              position: "absolute",
              width: 136,
              height: 136,
              borderRadius: 22,
              background: card.color,
              boxShadow: card.boxShadow,
              filter: `blur(${card.blur})`,
              opacity: card.opacity,
              top: card.top,
              ...(card.left !== undefined ? { left: card.left } : {}),
              ...(card.right !== undefined ? { right: card.right } : {}),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 12,
              "--dur": card.duration,
              "--delay": card.delay,
            } as React.CSSProperties
          }
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.3px",
              color: card.textColor,
              width: "100%",
              textAlign: "center",
            }}
          >
            {card.name}
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.1,
              color: card.textColor,
              width: "100%",
              textAlign: "center",
            }}
          >
            {card.value}
          </span>
        </div>
      ))}

      {/* Center: icon + subtitle */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        style={{ top: "48%", gap: 10, zIndex: 10 }}
      >
        <Image
          src="/icons/icon-192x192.png"
          alt="araS"
          width={96}
          height={96}
          style={{
            borderRadius: 22,
            boxShadow: "0 8px 28px rgba(55,66,84,0.28)",
          }}
        />
        <p
          style={{
            fontSize: 13,
            color: "#8e8e93",
            textAlign: "center",
            maxWidth: 220,
            lineHeight: 1.5,
          }}
        >
          當你了解日常的花費後，接下來好好的管理你的「資產」吧
        </p>
      </div>

      {/* Bottom: 3 separate glass-pill buttons */}
      <div
        className="absolute right-0 left-0 flex flex-col items-center"
        style={{ bottom: 36, gap: 12, zIndex: 20 }}
      >
        {/* 登入 — dark primary glass */}
        <Link
          href="/sign-in"
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            minWidth: 200,
            padding: "14px 40px",
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            background: "linear-gradient(160deg, rgba(55,66,84,0.92) 0%, rgba(30,40,54,0.96) 100%)",
            border: "1.5px solid rgba(90,100,120,0.5)",
            boxShadow: [
              "0 10px 32px rgba(0,0,0,0.18)",
              "0 3px 8px rgba(0,0,0,0.10)",
              "inset 0 2px 3px rgba(255,255,255,0.18)",
              "inset 0 -1px 2px rgba(0,0,0,0.20)",
            ].join(", "),
          }}
        >
          <Sheen />
          登入
        </Link>

        {/* 註冊 — light glass */}
        <Link
          href="/sign-up"
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            minWidth: 200,
            padding: "14px 40px",
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            color: "#374254",
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(245,245,248,0.88) 40%, rgba(238,238,244,0.82) 65%, rgba(248,248,252,0.90) 100%)",
            border: "1.5px solid rgba(190,190,200,0.70)",
            boxShadow: [
              "0 10px 32px rgba(0,0,0,0.12)",
              "0 3px 8px rgba(0,0,0,0.08)",
              "inset 0 2px 3px rgba(255,255,255,1)",
              "inset 2px 0 3px rgba(255,255,255,0.80)",
              "inset 0 -2px 4px rgba(180,180,190,0.25)",
            ].join(", "),
          }}
        >
          <Sheen />
          註冊
        </Link>

        {/* 訪客 — ghost */}
        <Link
          href="/assets"
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            minWidth: 160,
            padding: "11px 40px",
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 500,
            color: "#8e8e93",
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.60) 0%, rgba(245,245,248,0.45) 65%, rgba(238,238,244,0.40) 100%)",
            border: "1.5px solid rgba(180,180,190,0.40)",
            boxShadow: [
              "0 4px 14px rgba(0,0,0,0.07)",
              "inset 0 1px 2px rgba(255,255,255,0.80)",
            ].join(", "),
          }}
        >
          <Sheen />
          訪客
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
pnpm --filter @repo/web type-check
```

Expected: exits 0 with no errors printed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/page.module.css
git commit -m "feat(web): redesign landing page with icon, animated cards, and glass buttons"
```

Expected: commit succeeds, pre-commit hooks pass.

---

## Task 3: Visual verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

Wait for "Ready" in the terminal output.

- [ ] **Step 2: Open http://localhost:3000 and verify the following**

| Check           | Expected                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Center icon     | 96×96px rounded image from `/icons/icon-192x192.png`                                                                                                                |
| Subtitle        | Chinese text below icon                                                                                                                                             |
| 5 cards visible | 流動資金 (top-right, clipped), 負債 (top-left, sharp blurry), 投資 (left-center, clipped, slight blur), 固定資產 (right-center, blurry), 應收款 (lower-left, sharp) |
| Card content    | Name + value centered in each square card                                                                                                                           |
| Animation       | All 5 cards breathing (scale pulse) at different rhythms                                                                                                            |
| Depth           | 流動資金 & 應收款 sharp; 投資 slightly soft; 負債 & 固定資產 heavily blurred                                                                                        |
| Buttons         | 3 glass pills at bottom — 登入 dark, 註冊 light, 訪客 ghost                                                                                                         |
| No overlap      | No card appears over the button area                                                                                                                                |
| Navigation      | Clicking each button navigates to the correct route                                                                                                                 |
