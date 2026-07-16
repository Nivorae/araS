# OWASP Top 10 (2021) Quick Reference

AI assistant reference for security patterns. Full details in `docs/SECURITY.md`.

## Rules Summary

| #   | Category                  | One-Liner Rule                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------- |
| A01 | Broken Access Control     | Always validate permissions server-side; never trust UI hiding            |
| A02 | Cryptographic Failures    | Use env vars for secrets; use `constantTimeCompare` for sensitive strings |
| A03 | Injection                 | Use `isPathAllowed()` whitelist; validate input with Zod                  |
| A04 | Insecure Design           | Design security from start; use `src/core/security/` utilities            |
| A05 | Security Misconfiguration | Generic error messages; no stack traces in production                     |
| A06 | Vulnerable Components     | Run `npm audit`; commit `package-lock.json`                               |
| A07 | Auth Failures             | Use `constantTimeCompare` for passwords; validate JWT expiry              |
| A08 | Integrity Failures        | Use lockfiles; verify package sources                                     |
| A09 | Logging Failures          | Send `X-User-ID`/`X-Username` headers; log errors to ErrorBoundary        |
| A10 | SSRF                      | Validate ALL paths against whitelist before API calls                     |

## Critical Patterns

### 1. URL Whitelist (A10)

```typescript
import { isPathAllowed, USERS_WHITELIST } from "@/core/security/urlWhitelist";

const path = `/users/${id}`;
if (!isPathAllowed(path, USERS_WHITELIST)) {
  throw new Error(`Path not in whitelist: ${path}`);
}
```

### 2. Timing-Safe Comparison (A07)

```typescript
import { constantTimeCompare } from "@/core/security/constantTimeCompare";

// Password confirmation
if (!constantTimeCompare(password, confirmPassword)) {
  setError("Passwords do not match");
}
```

### 3. Error Handling (A05)

```typescript
import { formatApiError } from "@/core/api/errors";

catch (error) {
  // Never expose raw error to user
  toast.error(formatApiError(error, "save user"));
}
```

### 4. Protected Routes (A01)

```typescript
<ProtectedRoute requiredPermission="admin:access">
  <AdminPanel />
</ProtectedRoute>
```

## When Writing Code

1. **API Services**: Always validate paths against whitelist before `apiClient.get/post/put/delete`
2. **Forms**: Use Zod schemas for validation; use `constantTimeCompare` for password confirmation
3. **Error Handling**: Use `classifyError()` and generic messages
4. **Auth**: Check permissions in `ProtectedRoute`; never trust client-side checks alone
5. **Secrets**: Use `import.meta.env.VITE_*`; never hardcode
