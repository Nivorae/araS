# security-runbook False Positives

## "Path not in whitelist" fires from the wrong service

Misdiagnosis: You add the path to USERS_WHITELIST but the error persists.
Reality: A different service is making the call. Read the full stack trace — the error message includes the path. Search for that path in service files to find the real caller.

## Whitelist prefix has trailing slash

Misdiagnosis: Path looks correct but isPathAllowed returns false.
Reality: Whitelist entry is `/users/` but path is `/users/123`. Remove the trailing slash from the whitelist entry.

## formatApiError used but raw error still appears

Misdiagnosis: formatApiError is in the toast so error masking must be working.
Reality: There are two code paths — a toast from formatApiError AND a state update with the raw error elsewhere. Search for setError near the same catch block.

## constantTimeCompare returning false for identical values

Misdiagnosis: The function is broken.
Reality: OWASP A07 (timing) errors are silent — constantTimeCompare returns false with identical timing for mismatched inputs. If it returns false, the values are not actually identical. Check for hidden whitespace, encoding differences, or case sensitivity.

Note: constantTimeCompare is blocked from AI modification by security hooks. Edit manually if needed.

## CORS error only in production, not local

Misdiagnosis: CORS looks fine because it works locally.
Reality: Local dev uses Vite's proxy (server.proxy) which strips CORS entirely. Production makes direct browser requests. Check CLIENT_URL in backend/.env for the production value.
