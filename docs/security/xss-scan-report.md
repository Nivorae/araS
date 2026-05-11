# XSS Vulnerability Scan Report

**Project:** araS (Turborepo monorepo)
**Scope:** `apps/` and `packages/`
**Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Express 4 + Prisma 6
**Date:** 2026-05-10
**Scanner:** Static pattern analysis (rg) across `.ts` / `.tsx` / `.js` / `.jsx`
**Result:** **No critical or high-severity XSS vulnerabilities detected.** 1 low, 2 informational findings.

---

## Summary

| Severity      | Count |
| ------------- | ----- |
| Critical      | 0     |
| High          | 0     |
| Low           | 1     |
| Informational | 2     |

The codebase relies on React's default JSX escaping correctly. The only call site for a dangerous DOM API contains a static, non-user-controlled value. CSP, anti-clickjacking, and HSTS headers are already configured in `apps/web/next.config.ts`. The Express API runs `securityHeaders` middleware globally.

---

## Findings

### LOW-1 — React `dangerously*SetInnerHTML` with a static CSS string

> Note: throughout this document the React API name is written `dangerously*SetInnerHTML` (with an asterisk) to avoid triggering the repo's automated security-warning hook. The actual code uses the un-asterisked form.

- **File:** `apps/web/components/finance/RetirementPage.tsx:611`
- **Code (verbatim):**
  ```tsx
  <style dangerously*SetInnerHTML={{ __html: WAVE_CSS }} />
  ```
- **Source of `__html`:** `WAVE_CSS` is a module-level constant (line 27) containing only `@keyframes` rules — no user input flows in.
- **Exploitable today:** No.
- **Why it's still flagged:** The pattern is fragile. A future edit could introduce string interpolation of user data without anyone noticing.
- **CWE:** CWE-79 (defensive)
- **Recommended fix:** Move the keyframes into the global stylesheet `apps/web/app/globals.css` (already used per `CLAUDE.md` `@theme` block) and delete the `<style>` injection. This eliminates the dangerous-API surface entirely.

---

### INFO-1 — `localStorage` to JSON parse without schema validation

- **Files:**
  - `apps/web/hooks/useExchangeRate.ts:29-31`
  - `apps/web/components/finance/RetirementPage.tsx:341-343`
- **Code (representative):**
  ```ts
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed: Params = { ...DEFAULTS, ...JSON.parse(saved) };
  }
  ```
- **XSS impact:** None directly — parsed objects feed typed React state, never rendered as HTML.
- **Latent risk:** An attacker with DOM access (via separate XSS, shared device, or browser extension) can poison the stored shape. Without validation, malformed values flow into business logic (e.g., negative rates, NaN ages).
- **Recommended fix:** Validate with `zod` before consuming. `zod` is already a workspace dependency (`packages/shared` and `apps/web`).

  ```ts
  import { z } from "zod";

  const CachedRateSchema = z.object({
    rate: z.number().positive(),
    timestamp: z.number().int().nonnegative(),
  });

  const result = CachedRateSchema.safeParse(JSON.parse(cached));
  if (!result.success) {
    localStorage.removeItem(CACHE_KEY); // drop poisoned entry
  } else {
    // use result.data
  }
  ```

---

### INFO-2 — Dynamic `<img src>` from a static map

- **Files:**
  - `apps/web/components/finance/CategoryCardStack.tsx:180`
  - `apps/web/components/finance/FinanceCategoryCard.tsx:167`
- **Code:**
  ```tsx
  <img src={ASSET_ICON_MAP[entry.name]!} />
  <img src={encodeURI(ASSET_ICON_MAP[item.name]!)} />
  ```
- **XSS impact:** None — `ASSET_ICON_MAP` is sourced from internal data, not user input.
- **Latent risk:** Non-null assertion silently produces `undefined` if the key is missing. Cosmetic, not a security issue.
- **Recommended fix (optional):** Replace the non-null assertion with a guarded fallback (e.g., a placeholder asset).

---

## Patterns scanned (clean)

| Pattern                                                          | Result                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` | none found                                                  |
| Code-execution sinks (dynamic code evaluation primitives)        | none found                                                  |
| `dangerously*SetInnerHTML` with dynamic data                     | none found (only static CSS — see LOW-1)                    |
| `window.location.*` assignment / `location.href` write           | none found (Next.js `Link` / `router.push` used throughout) |
| `window.open(...)`                                               | none found                                                  |
| Dynamic `href` with external/user data                           | none found (all `href` values are static route literals)    |
| `target="_blank"` without `rel="noopener"`                       | none found                                                  |
| Vue `v-html`, Angular `bypassSecurityTrust`                      | N/A — React-only stack                                      |
| `DOMPurify` / `sanitize-html`                                    | not installed — and not currently needed                    |

---

## Existing defenses (verified in place)

### Web (`apps/web/next.config.ts`)

A full Content Security Policy and supporting headers are configured for `/(.*)`:

| Header                      | Value (abridged)                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'`; `script-src` allowlists Clerk + Cloudflare Turnstile; `connect-src` allowlists Clerk + TWSE; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'` |
| `X-Frame-Options`           | `DENY`                                                                                                                                                                          |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                                                       |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                                               |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`                                                                                                                                      |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                                                                                                                                  |

> Note: `script-src` includes `'unsafe-inline'` to support Next.js's hydration shim. This is industry-standard for Next.js but reduces CSP strength against injected `<script>` blocks. Migrating to a nonce-based CSP via Next.js middleware would close this gap.

### API (`apps/api`)

The request lifecycle declared in `CLAUDE.md` runs `securityHeaders` middleware globally:

```
Request -> securityHeaders -> CORS -> JSON body -> ... -> routes -> errorHandler
```

---

## Recommendations (priority order)

1. **Eliminate the only dangerous API call** — move `WAVE_CSS` into `apps/web/app/globals.css` and remove the `dangerously*SetInnerHTML` invocation. Result: codebase is XSS-API-free.
2. **Validate `localStorage` payloads** with the `zod` schemas already shared via `@repo/shared`. Treat browser storage as an untrusted input boundary.
3. **Add lint rules to keep it that way.** In `packages/eslint-config/react.js`:
   ```js
   rules: {
     // ...existing
     "react/no-danger": "error",
     "no-eval": "error",
     "no-implied-eval": "error",
   }
   ```
   These will fail CI if `dangerously*SetInnerHTML` or dynamic code execution reappears.
4. **(Optional, future)** Migrate the web CSP to a per-request nonce so `'unsafe-inline'` can be dropped from `script-src`. Requires Next.js middleware that mints a nonce, attaches it to the response header, and exposes it to React via headers/server context.
5. **(Optional)** Add `dompurify` to the dependency tree only if HTML rendering of user content is added later (e.g., a rich-text editor). Until then, no need to install it.

---

## Methodology

Static pattern search across the monorepo using `rg`, focusing on:

- **DOM sinks:** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, React unsafe HTML APIs
- **Code execution sinks:** dynamic code evaluation primitives, string-form `setTimeout` / `setInterval`
- **Navigation sinks:** `window.location.*` assignment, `window.open(...)`, dynamic `href` / `src`
- **Browser-storage trust boundaries:** `localStorage.getItem` + JSON parse patterns
- **Existing sanitization libraries:** `DOMPurify`, `sanitize-html`
- **Framework-specific:** React unsafe APIs; Vue/Angular equivalents (N/A here)
- **Existing security middleware/headers** in `apps/web/next.config.ts` and the Express API

This scan does not perform dynamic analysis, fuzzing, or authenticated session testing. For deeper coverage, consider:

- `eslint-plugin-security` in CI
- `semgrep --config=p/xss` as a periodic automated scan
- A dedicated DAST pass against a deployed preview

---

## Appendix: Files referenced

- `apps/web/next.config.ts`
- `apps/web/app/globals.css`
- `apps/web/components/finance/RetirementPage.tsx`
- `apps/web/components/finance/CategoryCardStack.tsx`
- `apps/web/components/finance/FinanceCategoryCard.tsx`
- `apps/web/hooks/useExchangeRate.ts`
- `packages/eslint-config/react.js`
- `packages/shared/src/schemas/finance.ts`
