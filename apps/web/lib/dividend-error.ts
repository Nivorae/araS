import { err, handleError } from "@/lib/api-response";
import { PremiumRequiredError, NotFoundError, ConflictError } from "@/services/dividends.service";
import { logSecurityEvent } from "@/lib/security-log";

// 共用的 service 錯誤映射。routes 只做 HTTP 轉譯，判斷全在 service。
//
// FIX FOR FINDING 5 (final review) — entries/[id] and insurances/[id] both
// log `ownership_violation` when a mismatched userId produces a 404; the
// dividend routes only logged `auth_fail` for missing auth, so a cross-user
// probe of entryId/bankEntryId/dividend id was silent. `ctx` is optional and
// best-effort: every current call site passes userId + resource (matching the
// same resource strings already used for this route's `auth_fail` log), but
// this must not throw or change behavior if a future caller omits it.
export function mapDividendError(e: unknown, ctx?: { userId?: string | null; resource?: string }) {
  if (e instanceof PremiumRequiredError) {
    return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
  }
  if (e instanceof NotFoundError) {
    // exactOptionalPropertyTypes is on: omit `userId` entirely rather than
    // assigning `undefined` to it when the caller didn't have one.
    logSecurityEvent({
      type: "ownership_violation",
      ...(ctx?.userId ? { userId: ctx.userId } : {}),
      resource: ctx?.resource ?? e.message,
    });
    return err("NOT_FOUND", e.message, 404);
  }
  if (e instanceof ConflictError) return err("CONFLICT", e.message, 409);
  return handleError(e);
}
