import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage is per device, not per account. Values that belong to a user
// (retirement inputs, salary, recent stock picks) are keyed by Clerk userId so
// the next account signed in on the same phone doesn't see them. Device-level
// settings (reminder toggle, what's-new seen) stay on plain keys.

function accountKey(base: string, userId: string): string {
  return `${base}:${userId}`;
}

// Values written before this were stored under the bare `base` key. The first
// account to read adopts that value and the bare key is removed, so upgrading
// keeps what the user saved without handing it to every later account.
export async function getAccountItem(base: string, userId: string): Promise<string | null> {
  const key = accountKey(base, userId);
  const own = await AsyncStorage.getItem(key);
  if (own !== null) return own;
  const legacy = await AsyncStorage.getItem(base);
  if (legacy === null) return null;
  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(base);
  return legacy;
}

export function setAccountItem(base: string, userId: string, value: string): Promise<void> {
  return AsyncStorage.setItem(accountKey(base, userId), value);
}
