# OWASP Symptom Map

| Symptom                                        | OWASP Category                     | Fix Location                                                                                         |
| ---------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Path not in whitelist` error                  | A10:2021 SSRF (CWE-918)            | `frontend/src/core/security/urlWhitelist.ts` — add path prefix to `*_WHITELIST`                      |
| Auth 401 on protected route                    | A01:2021 Broken Access Control     | Check JWT expiry in DevTools → check `requiredPermission` on `<ProtectedRoute>`                      |
| Raw error.message shown to user                | A05:2021 Security Misconfiguration | Find `error.message` in catch blocks → replace with `formatApiError(error, context)`                 |
| Timing-safe compare returns false unexpectedly | A07:2021 Auth Failures (CWE-208)   | Verify import from `frontend/src/core/security/constantTimeCompare.ts` — never use `===` for secrets |
| CORS blocking API calls                        | A05:2021 Security Misconfiguration | Check `CLIENT_URL` in `backend/.env` matches Vite dev server port (5173)                             |
| JWT missing from request headers               | A07:2021 Auth Failures             | Check auth interceptor in `frontend/src/core/api/client.ts`                                          |
| Input validation bypassed                      | A03:2021 Injection                 | Confirm Zod schema applied at form submit and API boundary                                           |
