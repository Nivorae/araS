// Free-plan asset-entry cap. A non-premium user may hold at most this many
// Entry rows; creating the next one is blocked (existing rows untouched).
//
// Set from the premium-tier spec (2026-07-20): only 1 existing user was above
// 20, and 15 would have caught 4 core users.
//
// It was temporarily raised to 100_000 between 2026-08-03 and the 1.2 launch,
// because merging develop into main put this cap live against the 1.1 binary
// users had installed — a build with no purchase flow at all — which would have
// hard-blocked anyone at the cap with no way to upgrade. 1.2 ships the paywall,
// so that reason is gone.
//
// Note this value is not only a server-side gate: apps/mobile's paywall
// interpolates it into its first selling point ("免費版上限 N 筆"), so changing
// it rewrites user-facing copy in the App. Ship a mobile OTA alongside any
// change here, or the App will advertise the wrong number.
export const FREE_ENTRY_LIMIT = 20;
