// The finance store and fetch caches are module-level and survive sign-out, so
// without this the next account signed in on the same device would first see
// the previous account's data. Kept free of React Native imports so it can be
// unit-tested.
export function createAccountChangeTracker(clear: () => void) {
  let last: string | null | undefined; // undefined = no account observed yet
  return (userId: string | null): void => {
    if (last !== undefined && userId !== last) clear();
    last = userId;
  };
}
