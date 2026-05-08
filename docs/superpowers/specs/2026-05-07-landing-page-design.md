# araS Landing Page — Design Spec

## Overview

Single-screen landing page for araS. Replaces the current root redirect (`apps/web/app/page.tsx`). Presents app branding and three authentication entry points in a full-screen centered layout. Buttons are placeholders until Clerk is wired up.

---

## File

| Path                    | Type                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `apps/web/app/page.tsx` | Server Component — replaces existing `redirect("/assets")` |

No new files, no new route groups, no layout changes.

---

## Layout

| Property       | Value                           |
| -------------- | ------------------------------- |
| Background     | `bg-surface` (white, `#ffffff`) |
| Height         | `min-h-screen`                  |
| Direction      | `flex flex-col`                 |
| Alignment      | `items-center justify-center`   |
| Inner gap      | `gap-6`                         |
| Text alignment | `text-center`                   |

---

## Content Structure

### 1. App Name

| Property | Value                                               |
| -------- | --------------------------------------------------- |
| Text     | `araS`                                              |
| Class    | `text-4xl font-bold tracking-tight text-foreground` |

### 2. Subtitle

| Property | Value                               |
| -------- | ----------------------------------- |
| Text     | `個人財務管理工具`                  |
| Class    | `text-sm text-foreground-secondary` |

### 3. Button Group

Container: `flex flex-col gap-3 w-full max-w-xs mt-2`

| Button   | Text     | Style                                                     | `href`    |
| -------- | -------- | --------------------------------------------------------- | --------- |
| 登入     | 登入     | `bg-primary text-primary-foreground` (solid)              | `#`       |
| 註冊     | 註冊     | `border border-primary text-primary bg-surface` (outline) | `#`       |
| 訪客瀏覽 | 訪客瀏覽 | `bg-muted text-muted-foreground` (ghost)                  | `/assets` |

All buttons share: `w-full py-3 rounded-[--radius] text-sm font-medium text-center`

Rendered as `<Link>` from `next/link`.

---

## Behavior

- **登入 / 註冊**: Link to `#` — no-op placeholders. Clerk `<SignInButton>` / `<SignUpButton>` will replace these in a future task.
- **訪客瀏覽**: Links directly to `/assets`, bypassing authentication entirely.
- No client-side state, no effects, no `"use client"` directive.
- No loading or error states (static Server Component).

---

## Future Clerk Integration (out of scope now)

When Clerk is wired up:

- 登入 → `<SignInButton mode="modal">` wrapping the button, or redirect to `/sign-in`
- 註冊 → `<SignUpButton mode="modal">` wrapping the button, or redirect to `/sign-up`
- 訪客瀏覽 → no change

---

## Out of Scope

- Navigation bar
- Feature highlight cards or product screenshots
- Footer
- Dark mode
- Animations or transitions
- Any responsive breakpoint work beyond `max-w-xs` centering
