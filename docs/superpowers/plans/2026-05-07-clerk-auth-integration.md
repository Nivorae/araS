# Clerk Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install `@clerk/nextjs`, wire the root layout and middleware, create hosted sign-in/sign-up pages, and update the landing page buttons to point to them.

**Architecture:** `ClerkProvider` wraps the root layout; an open `clerkMiddleware` injects auth context on every request without blocking any route; `/sign-in` and `/sign-up` use Clerk's hosted UI components; landing page `<Link>` hrefs point to those pages.

**Tech Stack:** Next.js 15 App Router, `@clerk/nextjs ^6`, Vitest + React Testing Library, Tailwind CSS 4

---

## File Map

| Action | Path                                           |
| ------ | ---------------------------------------------- |
| Modify | `apps/web/package.json`                        |
| Modify | `.env.example`                                 |
| Create | `apps/web/middleware.ts`                       |
| Modify | `apps/web/app/layout.tsx`                      |
| Create | `apps/web/app/sign-in/[[...sign-in]]/page.tsx` |
| Create | `apps/web/app/sign-up/[[...sign-up]]/page.tsx` |
| Modify | `apps/web/app/page.tsx`                        |
| Modify | `apps/web/next.config.ts`                      |
| Modify | `apps/web/tests/landing/LandingPage.test.tsx`  |
| Create | `apps/web/tests/auth/SignInPage.test.tsx`      |
| Create | `apps/web/tests/auth/SignUpPage.test.tsx`      |

---

### Task 1: Install @clerk/nextjs and add env vars

**Files:**

- Modify: `apps/web/package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install the package**

Run from the repo root:

```bash
pnpm --filter @repo/web add @clerk/nextjs
```

Expected: `apps/web/package.json` now has `"@clerk/nextjs": "^6.x.x"` in `dependencies`. `pnpm-lock.yaml` is updated.

- [ ] **Step 2: Add env vars to .env.example**

Open `.env.example` and append:

```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
CLERK_SECRET_KEY=sk_test_replace_me
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/assets
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/assets
```

- [ ] **Step 3: Verify .env has the redirect vars**

Confirm that `.env` (the real secrets file, not committed) contains all six Clerk vars:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/assets`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/assets`

If the redirect vars are missing, add them now.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml .env.example
git commit -m "feat(web): install @clerk/nextjs and add env vars"
```

---

### Task 2: Create middleware and update root layout

**Files:**

- Create: `apps/web/middleware.ts`
- Modify: `apps/web/app/layout.tsx`

No unit tests for this task — middleware and layout are structural; covered by type-check and browser verification in Task 8.

- [ ] **Step 1: Create middleware.ts**

Create `apps/web/middleware.ts` with this exact content:

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

This runs on every matched request and makes `auth()` / `currentUser()` available in Server Components. It does **not** block any route.

- [ ] **Step 2: Update root layout with ClerkProvider**

Replace the full content of `apps/web/app/layout.tsx`:

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

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/middleware.ts apps/web/app/layout.tsx
git commit -m "feat(web): add ClerkProvider to layout and open middleware"
```

---

### Task 3: Create sign-in page (TDD)

**Files:**

- Create: `apps/web/tests/auth/SignInPage.test.tsx`
- Create: `apps/web/app/sign-in/[[...sign-in]]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/auth/SignInPage.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SignInPage from "../../app/sign-in/[[...sign-in]]/page";

vi.mock("@clerk/nextjs", () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
}));

describe("Sign-in Page", () => {
  it("renders Clerk SignIn component", () => {
    render(<SignInPage />);
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
  });

  it("wraps SignIn in a full-screen centered main element", () => {
    render(<SignInPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen");
    expect(main).toHaveClass("items-center");
    expect(main).toHaveClass("justify-center");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/web test -- tests/auth/SignInPage.test.tsx
```

Expected: FAIL — `apps/web/app/sign-in/[[...sign-in]]/page.tsx` does not exist yet.

- [ ] **Step 3: Create the sign-in page**

Create directory and file `apps/web/app/sign-in/[[...sign-in]]/page.tsx`:

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

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @repo/web test -- tests/auth/SignInPage.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sign-in apps/web/tests/auth/SignInPage.test.tsx
git commit -m "feat(web): add Clerk sign-in page"
```

---

### Task 4: Create sign-up page (TDD)

**Files:**

- Create: `apps/web/tests/auth/SignUpPage.test.tsx`
- Create: `apps/web/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/auth/SignUpPage.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SignUpPage from "../../app/sign-up/[[...sign-up]]/page";

vi.mock("@clerk/nextjs", () => ({
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

describe("Sign-up Page", () => {
  it("renders Clerk SignUp component", () => {
    render(<SignUpPage />);
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
  });

  it("wraps SignUp in a full-screen centered main element", () => {
    render(<SignUpPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen");
    expect(main).toHaveClass("items-center");
    expect(main).toHaveClass("justify-center");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/web test -- tests/auth/SignUpPage.test.tsx
```

Expected: FAIL — `apps/web/app/sign-up/[[...sign-up]]/page.tsx` does not exist yet.

- [ ] **Step 3: Create the sign-up page**

Create directory and file `apps/web/app/sign-up/[[...sign-up]]/page.tsx`:

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

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @repo/web test -- tests/auth/SignUpPage.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sign-up apps/web/tests/auth/SignUpPage.test.tsx
git commit -m "feat(web): add Clerk sign-up page"
```

---

### Task 5: Update landing page buttons (TDD)

**Files:**

- Modify: `apps/web/tests/landing/LandingPage.test.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Add failing href tests to the landing page test file**

Replace the full content of `apps/web/tests/landing/LandingPage.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RootPage from "../../app/page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Landing Page", () => {
  it("renders app name", () => {
    render(<RootPage />);
    expect(screen.getByRole("heading", { name: "araS" })).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<RootPage />);
    expect(screen.getByText("個人財務管理工具")).toBeInTheDocument();
  });

  it("renders 登入 link pointing to /sign-in", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "登入" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("renders 註冊 link pointing to /sign-up", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "註冊" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  it("renders 訪客瀏覽 link pointing to /assets", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "訪客瀏覽" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/assets");
  });
});
```

- [ ] **Step 2: Run tests to verify the two new href assertions fail**

```bash
pnpm --filter @repo/web test -- tests/landing/LandingPage.test.tsx
```

Expected: 2 FAIL (登入 link has href="#" not "/sign-in", 註冊 link has href="#" not "/sign-up"), 3 PASS.

- [ ] **Step 3: Update landing page hrefs**

Replace the full content of `apps/web/app/page.tsx`:

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

- [ ] **Step 4: Run all landing page tests to verify they pass**

```bash
pnpm --filter @repo/web test -- tests/landing/LandingPage.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/tests/landing/LandingPage.test.tsx
git commit -m "feat(web): wire landing page buttons to Clerk sign-in and sign-up"
```

---

### Task 6: Update CSP for Clerk

**Files:**

- Modify: `apps/web/next.config.ts`

No unit tests — CSP is a runtime concern verified in browser.

- [ ] **Step 1: Update the CSP in next.config.ts**

Replace the full content of `apps/web/next.config.ts`:

```ts
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  experimental: {
    taint: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk-telemetry.com"
                : "script-src 'self' 'unsafe-inline' https://clerk-telemetry.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss: https://openapi.twse.com.tw https://clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com",
              "frame-src https://challenges.cloudflare.com",
              "worker-src blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
```

Changes from original:

- `script-src`: added `https://clerk-telemetry.com` in both dev and prod
- `connect-src`: added `https://clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com`
- `frame-src`: changed from `'none'` to `https://challenges.cloudflare.com`
- `worker-src blob:`: new directive (Clerk uses web workers)

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "fix(web): update CSP to allow Clerk domains"
```

---

### Task 7: Browser verification

**Files:** none modified

- [ ] **Step 1: Run all web tests**

```bash
pnpm --filter @repo/web test
```

Expected: `tests/landing/LandingPage.test.tsx` (5 pass), `tests/auth/SignInPage.test.tsx` (2 pass), `tests/auth/SignUpPage.test.tsx` (2 pass). Pre-existing failures in `loans.service` and `LoanDetailSheet` are unrelated — ignore them.

- [ ] **Step 2: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Verify landing page**

Navigate to `http://localhost:3000`. Confirm:

- Landing page renders correctly
- 登入 button is present
- 註冊 button is present
- 訪客瀏覽 button is present

- [ ] **Step 4: Verify sign-in flow**

Click 登入. Confirm:

- Browser navigates to `http://localhost:3000/sign-in`
- Clerk sign-in UI renders (email/password form or social login)
- No CSP errors in browser dev console

- [ ] **Step 5: Verify sign-up flow**

Go back to `/`. Click 註冊. Confirm:

- Browser navigates to `http://localhost:3000/sign-up`
- Clerk sign-up UI renders
- No CSP errors in browser dev console

- [ ] **Step 6: Verify guest flow**

Go back to `/`. Click 訪客瀏覽. Confirm:

- Browser navigates to `http://localhost:3000/assets`
- Finance page loads normally (no auth redirect)

- [ ] **Step 7: Verify sign-in redirect**

Complete a sign-in (or create a test account). Confirm:

- After successful sign-in, browser redirects to `/assets`
- Finance page loads
