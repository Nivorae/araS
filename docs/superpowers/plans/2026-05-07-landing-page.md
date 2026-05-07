# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root redirect in `apps/web/app/page.tsx` with a full-screen centered landing page showing the araS branding and three CTA buttons (登入, 註冊, 訪客瀏覽).

**Architecture:** Single Server Component at the app root. No new files, no route groups, no layout changes. Buttons use `<Link>` as placeholders; 訪客瀏覽 links to `/assets`, 登入/註冊 link to `#` until Clerk is added.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, `next/link`, Vitest + React Testing Library

---

### Task 1: Write failing test

**Files:**

- Create: `apps/web/tests/landing/LandingPage.test.tsx`

- [ ] **Step 1: Create test file**

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

  it("renders 登入 link", () => {
    render(<RootPage />);
    expect(screen.getByRole("link", { name: "登入" })).toBeInTheDocument();
  });

  it("renders 註冊 link", () => {
    render(<RootPage />);
    expect(screen.getByRole("link", { name: "註冊" })).toBeInTheDocument();
  });

  it("renders 訪客瀏覽 link pointing to /assets", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "訪客瀏覽" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/assets");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/web test -- tests/landing/LandingPage.test.tsx
```

Expected: FAIL — `RootPage` currently calls `redirect("/assets")` and renders no HTML elements.

---

### Task 2: Implement landing page

**Files:**

- Modify: `apps/web/app/page.tsx`

- [ ] **Step 3: Replace redirect with landing page component**

Replace the entire file content:

```tsx
import Link from "next/link";

export default function RootPage() {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-4xl font-bold tracking-tight">araS</h1>
      <p className="text-foreground-secondary mt-2 text-sm">個人財務管理工具</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="#"
          className="bg-primary text-primary-foreground w-full rounded-[--radius] py-3 text-center text-sm font-medium"
        >
          登入
        </Link>
        <Link
          href="#"
          className="border-primary bg-surface text-primary w-full rounded-[--radius] border py-3 text-center text-sm font-medium"
        >
          註冊
        </Link>
        <Link
          href="/assets"
          className="bg-muted text-muted-foreground w-full rounded-[--radius] py-3 text-center text-sm font-medium"
        >
          訪客瀏覽
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @repo/web test -- tests/landing/LandingPage.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Run type-check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/page.tsx apps/web/tests/landing/LandingPage.test.tsx
git commit -m "feat(web): add landing page with hero and CTA buttons"
```

---

### Task 3: Verify in browser

**Files:** (none modified)

- [ ] **Step 7: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 8: Open browser and verify**

Navigate to `http://localhost:3000`.

Confirm:

- White full-screen page
- `araS` heading visible, large and bold
- `個人財務管理工具` subtitle below it
- Three buttons stacked vertically: 登入 (solid dark), 註冊 (outline), 訪客瀏覽 (grey)
- Clicking 訪客瀏覽 navigates to `/assets`
- Clicking 登入 and 註冊 stays on `#` (no navigation)
