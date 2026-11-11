// Web counterpart of apps/mobile/lib/accountStorage.ts.
//
// localStorage is per browser, not per account. Values that belong to a user
// (retirement inputs, salary) are keyed by Clerk userId so the next account
// signed in on the same browser doesn't see them.
//
// Every access is wrapped: storage can be unavailable (private mode, blocked
// site data) and the page must still work without it.

function accountKey(base: string, userId: string): string {
  return `${base}:${userId}`;
}

// Values written before per-account keys existed were stored under the bare
// `base` key. The first account to read adopts that value and the bare key is
// removed, so upgrading keeps what the user saved without handing it to every
// later account.
export function getAccountItem(base: string, userId: string): string | null {
  try {
    const key = accountKey(base, userId);
    const own = window.localStorage.getItem(key);
    if (own !== null) return own;
    const legacy = window.localStorage.getItem(base);
    if (legacy === null) return null;
    window.localStorage.setItem(key, legacy);
    window.localStorage.removeItem(base);
    return legacy;
  } catch {
    return null;
  }
}

export function setAccountItem(base: string, userId: string, value: string): void {
  try {
    window.localStorage.setItem(accountKey(base, userId), value);
  } catch {
    // storage unavailable — the value just won't survive a reload
  }
}
