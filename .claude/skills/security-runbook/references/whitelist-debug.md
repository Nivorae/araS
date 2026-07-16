# URL Whitelist Debugging

## Symptom

`Error: Path not in whitelist: /your/path`

## Step-by-step diagnosis

1. Read the service file throwing the error. Note the exact path string.

2. Read `frontend/src/core/security/urlWhitelist.ts`. Find the `*_WHITELIST` for this service.

3. Check exact prefix matching — `isPathAllowed` checks whether the path _starts with_ a prefix:
   - Whitelist `/user` does NOT match `/users` (different prefix)
   - Whitelist `/users/` (trailing slash) does NOT match `/users/123`
   - Whitelist `/Users` does NOT match `/users` (case-sensitive)

4. Query params are stripped before checking. `/users?page=1` is checked as `/users`.

5. Fix — add the correct prefix to the appropriate `*_WHITELIST` constant:

   ```typescript
   export const USERS_WHITELIST = ["/users"] as const;
   ```

6. Also add to the WhitelistEntry union type at the bottom of the file.

## What NOT to do

- Do not change isPathAllowed to be more permissive
- Do not add `"/"` as a wildcard — this defeats SSRF protection
- Do not add the path to CORE_WHITELIST unless it is truly a core endpoint
