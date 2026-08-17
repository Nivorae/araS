import { auth } from "@clerk/nextjs/server";
import { entitlementsService } from "@/services/entitlements.service";
import { ok, err, handleError } from "@/lib/api-response";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const isPremium = await entitlementsService.isPremium(userId);
    return ok({ isPremium });
  } catch (e) {
    return handleError(e);
  }
}
