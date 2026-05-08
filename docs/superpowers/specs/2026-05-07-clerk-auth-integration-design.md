# Clerk Auth Integration — Design Spec

## Overview

Install and configure `@clerk/nextjs` in `apps/web`. Add `ClerkProvider` to the root layout, create an open middleware (injects auth context without blocking any routes), create hosted sign-in and sign-up pages, and wire the landing page buttons to those pages. Guests continue to access `/assets` freely.

Data-layer split (guests see hardcoded data, authenticated users see their DB data) is **out of scope** and handled in a follow-up task.

---

## Package

Install in `apps/web/package.json` dependencies:

```
@clerk/nextjs: ^6.0.0
```

Run `pnpm install` from the repo root after adding.

---

## Environment Variables

### `.env.example` additions

```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
CLERK_SECRET_KEY=sk_test_replace_me
```

### `.env` (user-populated, not committed)

The user has already added real keys. No action required.

### Clerk redirect env vars

Add to `.env.example` (and `.env`):

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/assets
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/assets
```

These are read automatically by `@clerk/nextjs` — no prop drilling needed.

---

## Files

### 1. `apps/web/app/layout.tsx` — Add ClerkProvider

Wrap `{children}` inside `<body>` with `ClerkProvider`:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "araS",
  description: "個人財務管理工具",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="zh-TW">
        <head>
          <meta name="theme-color" content="#f2f2f7" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="財務管家" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        </head>
        <body suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

`ClerkProvider` wraps the entire `<html>` element (required for Next.js App Router SSR).

---

### 2. `apps/web/middleware.ts` — Open Clerk Middleware

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

This middleware runs on every request and makes `auth()` / `currentUser()` available in Server Components. It does **not** block any route — all pages remain publicly accessible.

---

### 3. `apps/web/app/sign-in/[[...sign-in]]/page.tsx` — Sign-in Page

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
```

Redirect after sign-in is handled by `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/assets` env var.

---

### 4. `apps/web/app/sign-up/[[...sign-up]]/page.tsx` — Sign-up Page

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="bg-surface flex min-h-screen items-center justify-center">
      <SignUp />
    </main>
  );
}
```

Redirect after sign-up is handled by `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/assets` env var.

---

### 5. `apps/web/app/page.tsx` — Update Landing Page Buttons

Change 登入 and 註冊 `href` from `#` to the Clerk pages:

```tsx
import Link from "next/link";

export default function RootPage() {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-4xl font-bold tracking-tight">araS</h1>
      <p className="text-foreground-secondary mt-2 text-sm">個人財務管理工具</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/sign-in"
          className="bg-primary text-primary-foreground focus-visible:ring-ring w-full cursor-pointer rounded-[--radius] py-3 text-center text-sm font-medium transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          登入
        </Link>
        <Link
          href="/sign-up"
          className="border-primary bg-surface text-primary focus-visible:ring-ring w-full cursor-pointer rounded-[--radius] border py-3 text-center text-sm font-medium transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          註冊
        </Link>
        <Link
          href="/assets"
          className="bg-muted text-muted-foreground focus-visible:ring-ring w-full cursor-pointer rounded-[--radius] py-3 text-center text-sm font-medium transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          訪客瀏覽
        </Link>
      </div>
    </main>
  );
}
```

---

### 6. `apps/web/next.config.ts` — CSP Updates

Append Clerk-required domains to the existing CSP directives:

| Directive     | Add                                                                          |
| ------------- | ---------------------------------------------------------------------------- |
| `connect-src` | `https://clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com` |
| `img-src`     | `https://img.clerk.com`                                                      |
| `script-src`  | `https://clerk-telemetry.com`                                                |
| `worker-src`  | `blob:`                                                                      |
| `frame-src`   | `https://challenges.cloudflare.com` (Clerk bot-protection)                   |

Current `frame-src 'none'` must become `frame-src https://challenges.cloudflare.com`.

---

### 7. `apps/web/tests/landing/LandingPage.test.tsx` — Update href assertions

The 登入 and 註冊 links now point to `/sign-in` and `/sign-up` respectively. Update the two tests that check those links (currently they assert `href="#"` implicitly via `getByRole("link", { name: "登入" })`).

Add explicit href assertions for all three links:

```tsx
it("renders 登入 link pointing to /sign-in", () => {
  render(<RootPage />);
  expect(screen.getByRole("link", { name: "登入" })).toHaveAttribute("href", "/sign-in");
});

it("renders 註冊 link pointing to /sign-up", () => {
  render(<RootPage />);
  expect(screen.getByRole("link", { name: "註冊" })).toHaveAttribute("href", "/sign-up");
});
```

The existing `renders 訪客瀏覽 link pointing to /assets` test remains unchanged.

---

## Auth Flow

```
/  (landing page)
  └─ 登入 → /sign-in → Clerk UI → success → /assets
  └─ 註冊 → /sign-up → Clerk UI → success → /assets
  └─ 訪客瀏覽 → /assets (no auth required)

/assets, /transactions, etc.
  └─ Accessible by everyone (middleware does not block)
  └─ auth() available in Server Components for future data-split
```

---

## Out of Scope

- Guest hardcoded data vs authenticated DB data (follow-up task)
- API (`apps/api`) Clerk middleware — separate task
- User roles (`admin`, `editor`, `viewer`) — separate task
- Sign-out button in finance pages — separate task
- Clerk webhook for user sync to Prisma DB — separate task
