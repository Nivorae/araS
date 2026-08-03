// Free-plan asset-entry cap. A non-premium user may hold at most this many
// Entry rows; creating the next one is blocked (existing rows untouched).
//
// TEMPORARILY RAISED for the 1.2 launch (2026-08-03). The intended value is
// 20, per the premium-tier spec (2026-07-20): only 1 existing user was above
// that, and 15 would have caught 4 core users.
//
// Why it is not 20 right now: 1.2 is the first build with a paywall, and it is
// still in App Store review. Merging develop into main puts this cap live
// against the 1.1 binary that users currently have installed — a build with no
// purchase flow at all — so anyone at the cap would be hard-blocked with no way
// to upgrade. Effectively disabling the cap keeps those users unaffected while
// the premium API routes (insurance, allocation, entitlements) go live, which
// they must before review.
//
// The paywall is still fully reachable and testable while this is raised: the
// settings screen's upgrade card routes straight to it (apps/mobile/app/(app)/
// settings.tsx), independent of entry count.
//
// RESTORE TO 20 once 1.2 is live in the App Store.
export const FREE_ENTRY_LIMIT = 100_000;
