// Top-level Entry categories that represent liabilities, not assets. This is
// business classification (used server-side by EntriesService), kept separate
// from apps/web|mobile's categoryConfig.ts — those own the UI-only fields
// (icon, color, children) for the same category names and must stay in sync
// with this list, but shouldn't be imported into a service.
export const LIABILITY_TOP_CATEGORIES: readonly string[] = ["負債"];

// Top-level Entry categories eligible for the 轉帳 (transfer) feature — both
// the source and target entry must belong to one of these. Investment/
// insurance entries etc. are excluded: a "transfer" between them wouldn't be
// a plain balance move, it'd be a purchase/redemption with its own semantics.
export const TRANSFER_TOP_CATEGORIES: readonly string[] = ["流動資金", "負債", "應收款"];
