# Auth / JWT Debugging

## Symptom: 401 on a protected route

Step 1 — Check JWT expiry: DevTools → Application → Local Storage → localhost:5173.
Find the auth token. Decode the JWT (base64-decode the middle segment). Check `exp` field — if in the past, the token is expired. Fix: log out and back in.

Step 2 — Check ProtectedRoute permission: Find `<ProtectedRoute requiredPermission="...">` in the component. Compare the permission string to the user's actual role. Fix: correct the requiredPermission prop or update the user's role in the DB.

Step 3 — Check auth interceptor: Open `frontend/src/core/api/client.ts`. Confirm the interceptor attaches `Authorization: Bearer ${token}`. If the token is read from the wrong key, all calls will be unauthenticated.

## Symptom: 403 on a protected route

User is authenticated but lacks the required permission. Check the user's role in the DB and compare to the requiredPermission prop.

## Symptom: Redirect loop at /login

App redirects to /login, user authenticates, redirects back to /login.
Cause: Auth state not initialized correctly on page load.
Debug: Check `frontend/src/core/auth/` — how the auth state is read on app load and whether the token survives page reload.
