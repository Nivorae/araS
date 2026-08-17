import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { revokeOAuthGrants } from "@/lib/oauth-revoke";
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
    // Strictly before deleteUser: once the Clerk user is gone their OAuth tokens
    // can no longer be looked up, and a surviving provider-side grant locks the
    // user out of ever signing in again. See lib/oauth-revoke.ts.
    await revokeOAuthGrants(client, userId);
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
