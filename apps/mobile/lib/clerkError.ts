// Clerk surfaces validation/auth problems as an array of ClerkAPIError objects.
// This pulls out the most useful human-readable string, prefixed with the
// offending field name when Clerk provides one (e.g. "email_address: ...").
export function extractClerkError(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "errors" in e) {
    const err = (
      e as {
        errors: { message: string; longMessage?: string; meta?: { paramName?: string } }[];
      }
    ).errors?.[0];
    if (err) {
      const param = err.meta?.paramName ? `${err.meta.paramName}: ` : "";
      return `${param}${err.longMessage ?? err.message}`;
    }
  }
  return fallback;
}
