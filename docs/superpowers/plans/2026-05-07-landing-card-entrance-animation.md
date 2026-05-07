# Landing Card Entrance Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a spring-bounce entrance animation to the 5 background category cards on the landing page so they pop in sequentially when the page first loads.

**Architecture:** Two-layer DOM approach — each card gets an outer wrapper `<div>` that owns the one-shot entrance animation (`opacity` + `scale`), while the inner `<div>` retains the infinite breathing animation and depth styles. Separating them onto different elements avoids `transform: scale()` conflicts. Pure CSS — page stays a Server Component.

**Tech Stack:** CSS Modules (`page.module.css`), React/Next.js 15 Server Component (`page.tsx`).

---

## Files

| Action | Path                           |
| ------ | ------------------------------ |
| Modify | `apps/web/app/page.module.css` |
| Modify | `apps/web/app/page.tsx`        |

---

## Task 1: Add entrance keyframe + classes to CSS module

**Files:**

- Modify: `apps/web/app/page.module.css`

- [ ] **Step 1: Add `@keyframes enterScalePop` and five `.enter-N` classes**

Open `apps/web/app/page.module.css`. The file currently ends with the `@media (prefers-reduced-motion)` block at line 58. Insert the following **before** that block (between the `.far` block and the `@media` block):

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

- [ ] **Step 2: Extend the `prefers-reduced-motion` guard**

Replace the existing `@media` block:

```css
@media (prefers-reduced-motion: reduce) {
  .near,
  .mid,
  .far {
    animation: none;
  }
}
```

with:

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

- [ ] **Step 3: Verify the full file looks like this**

`apps/web/app/page.module.css` should now contain (in order):

1. `@keyframes breatheNear` / `breatheMid` / `breatheFar`
2. `.near` / `.mid` / `.far` classes
3. `@keyframes enterScalePop`
4. `.enter-0` through `.enter-4`
5. `@media (prefers-reduced-motion: reduce)` covering all 8 classes

---

## Task 2: Add wrapper div and `entryClasses` to page.tsx

**Files:**

- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Add `entryClasses` array after `depthClass`**

Currently at line 95–99 in `apps/web/app/page.tsx`:

```tsx
const depthClass: Record<CardConfig["depth"], string> = {
  near: styles.near ?? "",
  mid: styles.mid ?? "",
  far: styles.far ?? "",
};
```

Add the following immediately after it:

```tsx
const entryClasses = [
  styles["enter-0"] ?? "",
  styles["enter-1"] ?? "",
  styles["enter-2"] ?? "",
  styles["enter-3"] ?? "",
  styles["enter-4"] ?? "",
];
```

- [ ] **Step 2: Replace the card `.map()` with the two-layer wrapper structure**

Currently at lines 121–174, the map renders one `<div>` per card:

```tsx
{
  CARDS.map((card) => (
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
  ));
}
```

Replace the entire block with:

```tsx
{
  CARDS.map((card, i) => (
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
        style={
          {
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
    </div>
  ));
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
pnpm --filter @repo/web type-check
```

Expected: exits 0 with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/page.module.css
git commit -m "feat(web): add spring-bounce entrance animation to landing page cards"
```

Expected: commit succeeds, pre-commit hooks pass.

---

## Task 3: Visual verification

- [ ] **Step 1: Open http://localhost:3000 in browser** (dev server already running on port 3000)

- [ ] **Step 2: Hard-refresh the page** (`Ctrl+Shift+R` / `Cmd+Shift+R`) to ensure a clean load

- [ ] **Step 3: Verify the following**

| Check                   | Expected                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| Cards invisible on load | All 5 cards start hidden                                                |
| Sequential pop-in       | Cards appear one by one with spring bounce, ~0.12s apart                |
| Order                   | 流動資金 first → 負債 → 投資 → 固定資產 → 應收款 last                   |
| After entry             | Cards transition smoothly into the breathing animation                  |
| Depth intact            | Near cards sharp, mid slight blur, far heavily blurred — same as before |
| No layout shift         | Buttons, icon, and subtitle unaffected                                  |
