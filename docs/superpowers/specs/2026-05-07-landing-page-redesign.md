# Landing Page Redesign — araS

**Date:** 2026-05-07  
**File:** `apps/web/app/page.tsx`

---

## Overview

Redesign the root landing page (`/`) with three goals:

1. Replace the `araS` text heading with the app icon image.
2. Replace the three stacked links with three individual glass-pill buttons anchored to the bottom of the screen.
3. Add a background layer of five animated, depth-layered category cards that fill the space above the buttons.

---

## 1. App Icon

- Remove the `<h1>araS</h1>` element.
- Replace with `<img src="/icons/icon-192x192.png" alt="araS" />` sized 96×96px, `border-radius: 22px`, and a subtle drop shadow matching the app's dark palette (`rgba(55,66,84,0.28)`).
- Keep the subtitle paragraph unchanged beneath the icon.

---

## 2. Background Category Cards

### Data

Five categories hardcoded from `categoryConfig.ts` with static demo values:

| Category | Color     | Text color | Demo value   |
| -------- | --------- | ---------- | ------------ |
| 流動資金 | `#FFFFFF` | `#1c1c1e`  | NT$82,500    |
| 負債     | `#C7C7D4` | `#1c1c1e`  | NT$320,000   |
| 投資     | `#66788E` | `#ffffff`  | NT$540,000   |
| 固定資產 | `#374254` | `#ffffff`  | NT$4,200,000 |
| 應收款   | `#0e1424` | `#ffffff`  | NT$15,000    |

### Card appearance

- Square: 136×136px, `border-radius: 22px`
- Content: category name (12px semibold) and value (18px bold), both centered horizontally and vertically (`align-items: center; justify-content: center; text-align: center`)
- No dynamic data fetching — values are hardcoded constants on this page

### Depth layers

Three depth levels, each controlling `filter: blur()` and `opacity`:

| Depth             | blur  | opacity | Cards            |
| ----------------- | ----- | ------- | ---------------- |
| Near (foreground) | 0px   | 1.0     | 流動資金, 應收款 |
| Mid               | 2.5px | 0.78    | 投資             |
| Far (background)  | 7px   | 0.55    | 負債, 固定資產   |

### Positions

All cards must remain above the button safe-zone (bottom ~230px of the screen). Mix of fully-visible and edge-clipped cards:

| Card     | top   | horizontal   | clip             |
| -------- | ----- | ------------ | ---------------- |
| 流動資金 | 65px  | right: −30px | clipped on right |
| 負債     | 115px | left: 32px   | fully visible    |
| 投資     | 315px | left: −28px  | clipped on left  |
| 固定資產 | 368px | right: 28px  | fully visible    |
| 應收款   | 462px | left: 38px   | fully visible    |

### Animation

Each card breathes (scale pulse) with `animation: breathe-X Ys ease-in-out infinite`, staggered by `animation-delay` so no two cards move in sync:

| Depth | keyframes                   | duration  | delays used  |
| ----- | --------------------------- | --------- | ------------ |
| Near  | `scale(1.00) → scale(1.08)` | ~3.8–4.2s | 0s, −3.0s    |
| Mid   | `scale(0.93) → scale(1.02)` | 4.5s      | −2.1s        |
| Far   | `scale(0.82) → scale(0.91)` | 5.2–6.1s  | −1.3s, −0.8s |

`transform-origin: center center` on each card so it scales from its own center.

The card layer sits below the center content and buttons (`z-index` ordering: cards → center content → buttons).

---

## 3. Bottom Glass-Pill Buttons

Three `<Link>` elements (Next.js) stacked vertically, each a separate full pill. Positioned `absolute` at `bottom: 36px`, centered horizontally with `flex-direction: column; align-items: center; gap: 12px`. The `<main>` wrapper is `position: relative; height: 100dvh; overflow: hidden` so absolute children are constrained to the viewport.

| Button | Style              | Route      |
| ------ | ------------------ | ---------- |
| 登入   | Dark primary glass | `/sign-in` |
| 註冊   | Light/white glass  | `/sign-up` |
| 訪客   | Ghost (subtle)     | `/assets`  |

**Dark primary glass** (登入):

- Background: `linear-gradient(160deg, rgba(55,66,84,0.92), rgba(30,40,54,0.96))`
- Border: `1.5px solid rgba(90,100,120,0.5)`
- Box-shadow: outer drop + inner top highlight + inner bottom shadow
- Text: white

**Light glass** (註冊): mirrors the existing `BottomNav` glass style — near-opaque white gradient, metallic border, inner rim highlights, text `#374254`.

**Ghost** (訪客): low-opacity white gradient, faint border, `color: #8e8e93`, slightly smaller padding.

All three share a `::before` pseudo-element diagonal light streak (`linear-gradient(128deg, ...)`) for the glass sheen.

`min-width: 200px` for 登入/註冊, `160px` for 訪客.

---

## 4. Layout structure

```
<main>                         ← full screen, overflow hidden, bg #f7f7fa
  <!-- background cards -->
  <div.bg-card.card-liquidity> ...
  <div.bg-card.card-liability> ...
  <div.bg-card.card-invest>    ...
  <div.bg-card.card-fixed>     ...
  <div.bg-card.card-receivable>...

  <!-- center -->
  <div.center-content>          ← absolute, centered at ~48% from top
    <img icon />
    <p subtitle />

  <!-- bottom buttons -->
  <div.bottom-buttons>          ← absolute, bottom: 36px
    <Link 登入 />
    <Link 註冊 />
    <Link 訪客 />
</main>
```

No external libraries needed beyond what's already in the project (Tailwind for utility classes where convenient, inline styles for the glass/blur/animation effects as they are already used in `BottomNav.tsx`).

---

## Out of scope

- No auth-state awareness on this page (always shows all three buttons).
- No dark mode variant.
- No animation pause for `prefers-reduced-motion` (can be added later).
