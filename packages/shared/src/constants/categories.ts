// Top-level Entry categories that represent liabilities, not assets. This is
// business classification (used server-side by EntriesService), kept separate
// from apps/web|mobile's categoryConfig.ts — those own the UI-only fields
// (icon, color, children) for the same category names and must stay in sync
// with this list, but shouldn't be imported into a service.
export const LIABILITY_TOP_CATEGORIES: readonly string[] = ["負債"];
