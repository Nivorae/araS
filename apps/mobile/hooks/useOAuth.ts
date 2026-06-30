import { useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { extractClerkError } from "@/lib/clerkError";

// Lets the native auth session close the in-app browser once OAuth completes.
WebBrowser.maybeCompleteAuthSession();

export type OAuthStrategy = "oauth_google" | "oauth_line";

// Android optimization: pre-warms the browser for a faster OAuth handoff.
// No-op on iOS, safe to always run.
function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

// Clerk native SSO. Clerk brokers the provider handshake server-side — no provider
// Cloud config needed on the client; it deep-links back to the app via the redirect
// URL. Works for both existing and new users (OAuth signs up first-timers too).
// `busy` holds the in-flight strategy so callers can show a spinner on that button.
export function useOAuth() {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [busy, setBusy] = useState<OAuthStrategy | null>(null);

  const start = useCallback(
    async (strategy: OAuthStrategy, onError: (msg: string) => void) => {
      if (busy) return;
      setBusy(strategy);
      onError("");
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri(),
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/");
        } else {
          // No session usually means the user cancelled the browser flow.
          onError("登入已取消或未完成");
        }
      } catch (e) {
        onError(extractClerkError(e, "登入失敗"));
      } finally {
        setBusy(null);
      }
    },
    [busy, startSSOFlow, router]
  );

  return { start, busy };
}
