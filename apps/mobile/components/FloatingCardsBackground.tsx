import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

// Mirrors apps/web/app/welcome/page.tsx: each card "breathes" (scale oscillation
// by depth) and enters with a staggered scale-pop. Outer transform = enter,
// inner = breathe, so the final scale is enter × breathe (same as the web's
// nested DOM animations). Extracted so any screen can drop in the same
// decorative background (currently: the auth welcome screen and the paywall).

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
    color: "#0e1424",
    textColor: "#ffffff",
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
    color: "#FFFFFF",
    textColor: "#1c1c1e",
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

export function FloatingCardsBackground() {
  return (
    <>
      {CARDS.map((card, i) => (
        <FloatingCard key={card.name} card={card} index={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
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
});
