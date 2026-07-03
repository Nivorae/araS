import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useOAuth } from "@/hooks/useOAuth";
import { useAppleAuth } from "@/hooks/useAppleAuth";
import iconPng from "../../assets/icon.png";

// ─── Decorative floating cards (placeholder values — not real data) ─────────────
// Mirrors apps/web/app/page.tsx: each card "breathes" (scale oscillation by depth)
// and enters with a staggered scale-pop. Outer transform = enter, inner = breathe,
// so the final scale is enter × breathe (same as the web's nested DOM animations).

type Depth = "near" | "mid" | "far";

const DEPTH_SCALE: Record<Depth, { min: number; max: number }> = {
  near: { min: 1, max: 1.08 },
  mid: { min: 0.93, max: 1.02 },
  far: { min: 0.82, max: 0.91 },
};

interface CardConfig {
  name: string;
  color: string;
  textColor: string;
  value: string;
  depth: Depth;
  opacity: number;
  top: number;
  left?: number;
  right?: number;
  durationMs: number;
}

const CARDS: CardConfig[] = [
  {
    name: "投資",
    color: "#66788E",
    textColor: "#ffffff",
    value: "$82,500",
    depth: "near",
    opacity: 1,
    top: 65,
    right: -30,
    durationMs: 3800,
  },
  {
    name: "負債",
    color: "#C7C7D4",
    textColor: "#1c1c1e",
    value: "$320,000",
    depth: "far",
    opacity: 0.55,
    top: 115,
    left: 32,
    durationMs: 5200,
  },
  {
    name: "流動資金",
    color: "#FFFFFF",
    textColor: "#1c1c1e",
    value: "$540,000",
    depth: "mid",
    opacity: 0.78,
    top: 285,
    left: -28,
    durationMs: 4500,
  },
  {
    name: "固定資產",
    color: "#374254",
    textColor: "#ffffff",
    value: "$200,000",
    depth: "far",
    opacity: 0.55,
    top: 368,
    right: -12,
    durationMs: 6100,
  },
  {
    name: "應收帳款",
    color: "#0e1424",
    textColor: "#ffffff",
    value: "$15,000",
    depth: "near",
    opacity: 1,
    top: 490,
    left: 38,
    durationMs: 4200,
  },
];

const ENTER_DELAYS = [40, 160, 280, 400, 520];

function FloatingCard({ card, index }: { card: CardConfig; index: number }) {
  const enter = useRef(new Animated.Value(0)).current; // 0 → 1, scale-pop on mount
  const breathe = useRef(new Animated.Value(0)).current; // 0 ↔ 1 looping

  useEffect(() => {
    const half = card.durationMs / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const seq = Animated.sequence([
      Animated.delay(ENTER_DELAYS[index] ?? 0),
      // cubic-bezier(0.34,1.56,0.64,1) overshoot ≈ a lively spring
      Animated.spring(enter, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 90,
      }),
    ]);
    seq.start(() => loop.start());
    return () => {
      seq.stop();
      loop.stop();
    };
  }, [card.durationMs, index, enter, breathe]);

  const { min, max } = DEPTH_SCALE[card.depth];
  const enterScale = enter.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.55, 1.06, 1],
  });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [min, max] });
  const scale = Animated.multiply(enterScale, breatheScale);
  const enterOpacity = enter.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cardWrap,
        {
          top: card.top,
          ...(card.left !== undefined ? { left: card.left } : {}),
          ...(card.right !== undefined ? { right: card.right } : {}),
          opacity: enterOpacity,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: card.color, opacity: card.opacity }]}>
        <Text style={[styles.cardName, { color: card.textColor }]}>{card.name}</Text>
        <Text style={[styles.cardValue, { color: card.textColor }]}>{card.value}</Text>
      </View>
    </Animated.View>
  );
}

// ─── OAuth provider icons ───────────────────────────────────────────────────────

function AppleIcon() {
  return (
    <Svg width={18} height={22} viewBox="0 0 24 24">
      <Path
        fill="#ffffff"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.51 4.09l-.02-.01M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

function LineIcon() {
  return (
    <View style={styles.lineIcon}>
      <Text style={styles.lineIconText}>L</Text>
    </View>
  );
}

// ─── OAuth pill button ──────────────────────────────────────────────────────────

function OAuthPill({
  variant,
  icon,
  label,
  loading,
  disabled,
  onPress,
}: {
  variant: "apple" | "google" | "line";
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  // Google is a white pill with dark text; Apple and LINE are dark pills with
  // white text.
  const textColor = variant === "google" ? "#1c1c1e" : "#ffffff";
  const variantStyle =
    variant === "apple"
      ? styles.oauthApple
      : variant === "line"
        ? styles.oauthLine
        : styles.oauthGoogle;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.oauthPill,
        variantStyle,
        { opacity: loading ? 0.7 : disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.oauthText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { start, busy } = useOAuth();
  const { start: startApple, busy: appleBusy } = useAppleAuth();
  const [error, setError] = useState<string | null>(null);

  const anyBusy = busy !== null || appleBusy;

  return (
    <View style={styles.root}>
      {/* Background depth cards */}
      {CARDS.map((card, i) => (
        <FloatingCard key={card.name} card={card} index={i} />
      ))}

      {/* Center: icon + title + subtitle */}
      <View style={[styles.center, { top: height * 0.48 - 96 }]}>
        <Image source={iconPng} style={styles.icon} />
        <Text style={styles.title}>araS</Text>
        <Text style={styles.subtitle}>個人資產管理工具</Text>
      </View>

      {/* Bottom: OAuth login (no separate sign-in / sign-up screens) */}
      <View style={[styles.buttons, { bottom: insets.bottom + 36 }]}>
        {/* Apple is native and iOS-only; on Android it has no native flow. */}
        {Platform.OS === "ios" ? (
          <OAuthPill
            variant="apple"
            icon={<AppleIcon />}
            label="以 Apple 繼續"
            loading={appleBusy}
            disabled={anyBusy}
            onPress={() => startApple(setError)}
          />
        ) : null}
        <OAuthPill
          variant="google"
          icon={<GoogleIcon />}
          label="以 Google 繼續"
          loading={busy === "oauth_google"}
          disabled={anyBusy}
          onPress={() => start("oauth_google", setError)}
        />
        <OAuthPill
          variant="line"
          icon={<LineIcon />}
          label="以 LINE 繼續"
          loading={busy === "oauth_line"}
          disabled={anyBusy}
          onPress={() => start("oauth_line", setError)}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f7fa", overflow: "hidden" },

  // Floating cards
  cardWrap: { position: "absolute", width: 136, height: 136 },
  card: {
    width: 136,
    height: 136,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.3,
    width: "100%",
    textAlign: "center",
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "700",
    width: "100%",
    textAlign: "center",
  },

  // Center block
  center: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 10 },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    shadowColor: "#374254",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#4b5563",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#4b5563",
    textAlign: "center",
  },

  // Buttons
  buttons: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    zIndex: 20,
  },
  oauthPill: {
    minWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  oauthApple: { backgroundColor: "#000000" },
  oauthGoogle: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  oauthLine: { backgroundColor: "#06C755" },
  oauthText: { fontSize: 15, fontWeight: "600" },
  error: { color: "#ff3b30", fontSize: 13, textAlign: "center", marginTop: 4 },

  lineIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  lineIconText: { fontSize: 12, fontWeight: "800", color: "#06C755" },
});
