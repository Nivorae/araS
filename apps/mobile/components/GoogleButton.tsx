import { useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { extractClerkError } from "@/lib/clerkError";

// Lets the native auth session close the in-app browser once OAuth completes.
WebBrowser.maybeCompleteAuthSession();

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

// Clerk native SSO (Google). Clerk brokers the Google handshake server-side —
// no Google Cloud config needed on the client; it deep-links back to the app
// via the redirect URL. Works for both existing and new Google users.
export function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onPress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      } else {
        // No session usually means the user cancelled the browser flow.
        onError("Google sign-in was cancelled or did not complete.");
      }
    } catch (e) {
      onError(extractClerkError(e, "Google sign-in failed"));
    } finally {
      setBusy(false);
    }
  }, [busy, startSSOFlow, router, onError]);

  return (
    <TouchableOpacity style={styles.button} onPress={onPress} disabled={busy} activeOpacity={0.8}>
      {busy ? (
        <ActivityIndicator color="#111" />
      ) : (
        <Text style={styles.text}>Continue with Google</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: { color: "#111", fontSize: 16, fontWeight: "600" },
});
