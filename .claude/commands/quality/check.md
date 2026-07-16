---
description: Verify app and review code against project patterns
argument-hint: [path] [--tooling] [--patterns] [--fix] [--quick] [--strict]
allowed-tools: Read, Bash(git:*), Bash(pnpm:*), Grep
---

# Quality Check

Run tooling validation and/or pattern review. Use before committing or declaring work done.

## Flags

| Flag         | Description                                                          |
| ------------ | -------------------------------------------------------------------- |
| _(none)_     | Run both `--tooling` and `--patterns`                                |
| `--tooling`  | CI pipeline only: lint, typecheck, test, build                       |
| `--patterns` | Pattern review only: security, architecture, design                  |
| `--fix`      | Auto-fix lint/format before reporting (tooling only)                 |
| `--quick`    | Skip build step (tooling only)                                       |
| `--strict`   | Treat warnings as failures                                           |
| `[path]`     | Scope `--patterns` to this path; tooling always runs on full project |

## Instructions

Do NOT stop at the first failure — run everything and report all issues at once.

### --tooling Steps (run all in sequence)

#### 1. Check Uncommitted Changes

```bash
git status --short
```

#### 2. Format Check

```bash
pnpm format:check
```

If `--fix`: run `pnpm format` first, then re-check.

#### 3. Lint

```bash
pnpm lint
```

If `--fix`: run with `--fix` flag.

#### 4. Type Check

```bash
pnpm type-check
```

#### 5. Tests

```bash
pnpm test
```

#### 6. Build (skip if `--quick`)

```bash
pnpm build
```

### --patterns Checks

Check each against the files in scope (recent `git diff` if no path provided).

**Security (OWASP A01–A10):**

- [ ] URL Whitelist: API calls use `isPathAllowed()`
- [ ] Timing-Safe: Password comparisons use `constantTimeCompare()`
- [ ] Error Handling: Errors use `formatApiError()`
- [ ] Protected Routes: Sensitive routes use `<ProtectedRoute>`

**Architecture:**

- [ ] Feature Structure: Code in `src/features/[domain]/{components,hooks,services,types}/`
- [ ] Barrel Exports: Feature has `index.ts`
- [ ] Service Layer: Services validate paths against whitelist
- [ ] Hook Patterns: Data hooks use `classifyError()`

**Design:**

- [ ] Design Tokens: Uses typography/spacing/color tokens (not hardcoded values)
- [ ] Accessibility: Semantic HTML, ARIA labels, keyboard nav
- [ ] Responsive: Mobile-first breakpoints

## Warning vs Failure

- **Failure** (`❌ FAIL`): concrete violation that must be fixed
- **Warning** (`⚠️ WARN`): recommendation that may not apply (e.g., N/A — no password fields)

Without `--strict`: only failures block ALL PASS.
With `--strict`: both failures and warnings produce HAS FAILURES.

## Output Format

```
# Quality Check Report

## Status: ALL PASS | HAS FAILURES

### Tooling Results

| Step      | Status | Details          |
| --------- | ------ | ---------------- |
| Format    | PASS   |                  |
| Lint      | FAIL   | 3 errors, 1 warn |
| TypeCheck | PASS   |                  |
| Tests     | PASS   | 42 passed        |
| Build     | PASS   |                  |

### Pattern Review

✅ [PASS] URL Whitelist: services/users.ts — uses isPathAllowed
⚠️ [WARN] Timing-Safe: N/A — no password fields
❌ [FAIL] Error Handling: hooks/useUsers.ts:45 — raw error thrown

### Summary

- Tooling: 4 pass, 1 fail
- Patterns: 2 pass, 1 fail, 1 warn
- Action needed: Fix lint errors and raw error in useUsers.ts
```

## Decision Logic

| `--strict` | Failures | Warnings | Status       |
| ---------- | -------- | -------- | ------------ |
| Off        | 0        | any      | ALL PASS     |
| Off        | 1+       | any      | HAS FAILURES |
| On         | 0        | 0        | ALL PASS     |
| On         | 0        | 1+       | HAS FAILURES |
| On         | 1+       | any      | HAS FAILURES |
