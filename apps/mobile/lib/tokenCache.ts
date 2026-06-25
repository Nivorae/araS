import * as SecureStore from "expo-secure-store";

// Matches the shape ClerkProvider expects for its `tokenCache` prop. Defined
// locally to avoid a fragile deep import into the package's dist folder.
type TokenCache = {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
};

// Persists the Clerk session token in the device keychain/keystore so the user
// stays logged in across app restarts. This is what makes "kill app -> reopen ->
// still signed in" work (Phase 1 acceptance criterion).
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // If the stored item is corrupt, clear it so the user can re-auth cleanly.
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};
