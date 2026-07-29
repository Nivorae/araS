import * as SecureStore from "expo-secure-store";

// Matches the shape ClerkProvider expects for its `tokenCache` prop. Defined
// locally to avoid a fragile deep import into the package's dist folder.
type TokenCache = {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
};

// Every stored key is scoped to the Clerk instance the app is built against.
//
// Why: clerk-expo stores the client JWT under a single fixed key
// (`__clerk_client_jwt`). Its own guard against a changed publishable key only
// fires when the key changes *within one JS runtime* — on a cold start its
// module-level clerk instance is undefined, so the guard is skipped and the
// credential from the previous instance is handed to the new one. The client is
// invalid there, and sign-in then fails with "You are signed out".
//
// That is exactly what happened during the development -> production migration:
// the OTA swapped in `pk_live_` while every device still held a `pk_test_`
// client JWT. Scoping the key makes an instance switch start from an empty
// cache, so this heals itself for any future key change too.
const SCOPE = (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "unset").replace(
  /[^A-Za-z0-9._-]/g,
  "_"
);

const scoped = (key: string) => `${key}__${SCOPE}`;

// One-time cleanup of the pre-scoping entry so a stale credential for another
// instance does not sit in the keychain indefinitely. Best effort: failing to
// delete it is harmless, because nothing reads the unscoped key any more.
void SecureStore.deleteItemAsync("__clerk_client_jwt").catch(() => {});

// Persists the Clerk session token in the device keychain/keystore so the user
// stays logged in across app restarts. This is what makes "kill app -> reopen ->
// still signed in" work (Phase 1 acceptance criterion).
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(scoped(key));
    } catch {
      // If the stored item is corrupt, clear it so the user can re-auth cleanly.
      await SecureStore.deleteItemAsync(scoped(key)).catch(() => {});
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(scoped(key), value);
  },
  clearToken(key: string) {
    void SecureStore.deleteItemAsync(scoped(key)).catch(() => {});
  },
};
