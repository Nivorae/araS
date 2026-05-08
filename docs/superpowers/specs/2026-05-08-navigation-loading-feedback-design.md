# Navigation Loading Feedback

**Date:** 2026-05-08
**Status:** Approved

## Problem

Next.js App Router uses client-side navigation. When a user taps a button on the landing page, nothing visually changes until the destination page finishes rendering. This gap makes the app feel unresponsive.

## Solution

Two complementary layers of feedback:

1. **Top progress bar** — a thin animated bar at the top of the viewport that appears immediately on any route change, using `nextjs-toploader`.
2. **Button loading state** — the clicked button shows a spinner and dims, while the other buttons are disabled, giving instant confirmation that input was received.

## Architecture

```
app/layout.tsx          ← add <NextTopLoader> (global, affects all routes)
app/page.tsx            ← stays Server Component; bottom section replaced by <LandingButtons />
app/landing-buttons.tsx ← new Client Component; owns button click logic
```

Keeping `page.tsx` as a Server Component minimises the client bundle — only the interactive buttons ship as client JS.

## Components

### `NextTopLoader` (in `layout.tsx`)

- Package: `nextjs-toploader`
- Color: `#374254` (matches app's dark blue-grey)
- Height: 3px
- Shadow: off (clean look)
- Spinner: off (button already provides per-action feedback)

### `LandingButtons` (`app/landing-buttons.tsx`)

State: `activeHref: string | null` — which button is currently navigating.

On click:

1. Set `activeHref` to the button's href
2. Call `router.push(href)`

While `activeHref` is set:

- Active button: reduced opacity + small CSS spinner replaces label text
- Other buttons: `pointer-events: none` (prevents double-navigation)

Styles are copied from the existing inline styles in `page.tsx` (dark glass 登入, light glass 註冊, ghost 訪客). The `Sheen` component moves into this file since it is only used by the buttons.

## Installation

```
pnpm --filter @repo/web add nextjs-toploader
```

## Out of Scope

- Loading states for other pages (assets, sign-in, sign-up) — handled by Next.js's own `loading.tsx` convention if needed later.
- Page transition animations — separate concern.
