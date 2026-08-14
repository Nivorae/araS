import { err, handleError } from "@/lib/api-response";
import { PremiumRequiredError, NotFoundError, ConflictError } from "@/services/dividends.service";

// 共用的 service 錯誤映射。routes 只做 HTTP 轉譯，判斷全在 service。
export function mapDividendError(e: unknown) {
  if (e instanceof PremiumRequiredError) {
    return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
  }
  if (e instanceof NotFoundError) return err("NOT_FOUND", e.message, 404);
  if (e instanceof ConflictError) return err("CONFLICT", e.message, 409);
  return handleError(e);
}
