import { auth, clerkClient } from "@clerk/nextjs/server";
import { accountService } from "@/services/account.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

// Account deletion (App Store Guideline 5.1.1(v)): an app that supports account
// creation must let users delete their account and data from within the app.
// Removes all user-owned data, then the Clerk identity itself.
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/account" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    // Delete owned data first, then the auth record. If Clerk deletion fails
    // after the data is gone, the account is empty and the call is re-runnable.
    await accountService.deleteAllData(userId);
    const client = await clerkClient();
    await client.users.deleteUser(userId);

    logSecurityEvent({
      type: "auth_success",
      userId,
      resource: "/api/account",
      details: { action: "account_deleted" },
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
