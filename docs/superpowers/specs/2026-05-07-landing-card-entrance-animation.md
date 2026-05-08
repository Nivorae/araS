# Landing Page Card Entrance Animation

**Date:** 2026-05-07
**File:** `apps/web/app/page.tsx`, `apps/web/app/page.module.css`

---

## Overview

Add a one-shot entrance animation to the five background category cards on the landing page. When the page first loads, each card pops in with a spring-bounce scale effect, staggered so they appear one after another.

---

## Animation Spec

**Style:** Scale pop with spring easing (Option B)

**Keyframes (`enterScalePop`):**

| Progress | opacity | transform   |
| -------- | ------- | ----------- |
| 0%       | 0       | scale(0.55) |
| 70%      | 1       | scale(1.06) |
| 100%     | 1       | scale(1)    |

**Per-card parameters:**

| Class      | Card index   | animation-delay |
| ---------- | ------------ | --------------- |
| `.enter-0` | 0 (流動資金) | 0.04s           |
| `.enter-1` | 1 (負債)     | 0.16s           |
| `.enter-2` | 2 (投資)     | 0.28s           |
| `.enter-3` | 3 (固定資產) | 0.40s           |
| `.enter-4` | 4 (應收款)   | 0.52s           |

- **Duration:** 0.6s
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring bounce)
- **Fill mode:** `both` — card stays invisible during its delay period, then stays at final state after animation ends

---

## Architecture

Each card currently renders as a single `<div>` that carries both the depth styles (position, blur, opacity, breathing animation) and would naively need the entry animation too. Since both the entry and the breathing animations use `transform: scale()`, stacking them on one element causes conflicts.

**Solution: two-layer wrapper**

```
<div class="enter-N">           ← Entry animation only (opacity + scale)
                                   position: absolute, top, left/right
  <div class="near|mid|far">   ← Breathing animation + depth styles
                                   width, height, background, blur, opacity, --dur, --delay
    <span> name </span>
    <span> value </span>
  </div>
</div>
```

- The outer wrapper div owns: `position: absolute`, `top`, `left`/`right`, and the `.enter-N` class
- The inner card div owns: `width`, `height`, `borderRadius`, `background`, `boxShadow`, `filter`, `opacity`, CSS custom properties `--dur`/`--delay`, and the `.near|mid|far` breathing class
- The two `transform: scale()` animations compose via separate DOM elements — no conflict

---

## CSS Changes (`page.module.css`)

Add after the existing animation classes:

```css
@keyframes enterScalePop {
  0% {
    opacity: 0;
    transform: scale(0.55);
  }
  70% {
    opacity: 1;
    transform: scale(1.06);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.enter-0 {
  animation: enterScalePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.04s;
}
.enter-1 {
  animation: enterScalePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.16s;
}
.enter-2 {
  animation: enterScalePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.28s;
}
.enter-3 {
  animation: enterScalePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.4s;
}
.enter-4 {
  animation: enterScalePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.52s;
}
```

Also extend the `prefers-reduced-motion` guard at the bottom of the file to cover the new classes:

```css
@media (prefers-reduced-motion: reduce) {
  .near,
  .mid,
  .far,
  .enter-0,
  .enter-1,
  .enter-2,
  .enter-3,
  .enter-4 {
    animation: none;
  }
}
```

---

## TSX Changes (`page.tsx`)

Add an entry class array above `depthClass` (bracket notation required for hyphenated CSS module keys):

```tsx
const entryClasses = [
  styles["enter-0"] ?? "",
  styles["enter-1"] ?? "",
  styles["enter-2"] ?? "",
  styles["enter-3"] ?? "",
  styles["enter-4"] ?? "",
];
```

In the `.map()`, change from:

```tsx
<div
  key={card.name}
  className={depthClass[card.depth]}
  style={{ position: "absolute", top: card.top, left/right, width, height, ... }}
>
```

to:

```tsx
<div
  key={card.name}
  className={entryClasses[i]}
  style={{
    position: "absolute",
    top: card.top,
    ...(card.left !== undefined ? { left: card.left } : {}),
    ...(card.right !== undefined ? { right: card.right } : {}),
  }}
>
  <div
    className={depthClass[card.depth]}
    style={{
      width: 136,
      height: 136,
      borderRadius: 22,
      background: card.color,
      boxShadow: card.boxShadow,
      filter: `blur(${card.blur})`,
      opacity: card.opacity,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: 12,
      "--dur": card.duration,
      "--delay": card.delay,
    } as React.CSSProperties}
  >
    <span ...>{card.name}</span>
    <span ...>{card.value}</span>
  </div>
</div>
```

Where `i` is the map index from `CARDS.map((card, i) => ...)`.

---

## Out of Scope

- No entrance animation on the icon, subtitle, or buttons (those are always visible)
- No repeat animation on route re-navigation (CSS one-shot on DOM mount is sufficient)
