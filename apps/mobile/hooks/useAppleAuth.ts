import { useSignInWithApple } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { extractClerkError } from "@/lib/clerkError";

// Native Sign in with Apple (App Store Guideline 4.8 — an app using third-party
// login must offer an equivalent privacy-preserving option). Clerk brokers the
// native Apple identity token (via expo-apple-authentication) into a session —
// no browser redirect. iOS only; not available in Expo Go, needs a dev/EAS build.
export function useAppleAuth() {
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const start = useCallback(
    async (onError: (msg: string) => void) => {
      if (busy) return;
      setBusy(true);
      onError("");
      try {
        const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/");
        } else {
          onError("登入未完成");
        }
      } catch (e) {
        // Dismissing the native Apple sheet throws ERR_REQUEST_CANCELED — a
        // normal user cancel, not an error worth surfacing.
        if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") {
          onError("");
        } else {
          onError(extractClerkError(e, "登入失敗"));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, startAppleAuthenticationFlow, router]
  );

  return { start, busy };
}
