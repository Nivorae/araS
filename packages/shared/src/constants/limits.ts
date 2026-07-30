// Free-plan asset-entry cap. A non-premium user may hold at most this many
// Entry rows; creating the next one is blocked (existing rows untouched).
// Set to 20 per the premium-tier spec (2026-07-20): only 1 existing user is
// above this, and 15 would have caught 4 core users.
export const FREE_ENTRY_LIMIT = 20;
