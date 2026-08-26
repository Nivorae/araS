import { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { CATEGORIES } from "@/lib/categoryConfig";
import iconPng from "../assets/icon.png";

// Empty state for the assets screen: the top categories flow along an
// Archimedean spiral from off-screen into the centre, shrinking and fading as
// they arrive, with the "add your first entry" CTA sitting at the vortex's
// convergence point.
//
// Ported from a Canvas2D reference. There is no canvas in RN, so each slot is
// an absolutely-positioned Animated.View whose transform is derived in a
// worklet from ONE shared progress value — the whole animation runs on the UI
// thread with zero JS frames and zero layout passes, the same constraint the
// card stack next door is built around.

const TWO_PI = Math.PI * 2;

// Spiral shape. n in [0,1] walks the path from the outer edge (n=0) to the
// centre (n=1); the radius falls linearly, so every turn is equally spaced.
const TURNS = 2.6;
// Radius multiplier. >1 deliberately overflows the container: the outer arm is
// clipped, which is what makes the stream read as infinite rather than as a
// ring of cards popping into existence.
const SPREAD = 1.85;
const SLOTS = 12; // cards alive at once, spaced evenly by ARC length
const CYCLE_MS = 26000; // time for one card to travel the whole spiral
// The driver counts whole cycles rather than looping 0->1 every CYCLE_MS. The
// worklet takes `% 1` anyway, so the motion is identical — but `withRepeat`
// tears down and restarts the underlying timing animation at every iteration
// boundary, and that hand-off drops a frame. Positions match exactly across the
// seam (t is periodic in 1), so the dropped frame reads as the whole vortex
// snapping back to its starting layout. At 1000 cycles the restart moves to
// once every ~7 hours, which no session reaches.
const DRIVER_CYCLES = 1000;
const FADE_IN = 0.2; // fraction of the path spent fading in at the outer end
const FADE_OUT = 0.1; // ...and fading out into the centre
const SIZE_ATTENUATION = 2; // >0 shrinks cards toward the centre

const CARD_W = 152;
const CARD_H = 94;

function spiralX(n: number, R: number) {
  "worklet";
  return R * (1 - n) * Math.cos(n * TURNS * TWO_PI);
}
function spiralY(n: number, R: number) {
  "worklet";
  return -R * (1 - n) * Math.sin(n * TURNS * TWO_PI);
}

// Arc-length reparameterization. Stepping the raw parameter n uniformly bunches
// the cards up near the centre (the turns get shorter there); stepping arc
// length uniformly keeps the visual gap constant the whole way in. The shape is
// R-independent, so the table is built once at R=1 at module load.
const ARC_TABLE = (() => {
  const M = 1200;
  const cum = new Array<number>(M + 1);
  cum[0] = 0;
  let px = spiralX(0, 1);
  let py = spiralY(0, 1);
  for (let k = 1; k <= M; k++) {
    const x = spiralX(k / M, 1);
    const y = spiralY(k / M, 1);
    cum[k] = cum[k - 1]! + Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const total = cum[M]! || 1;
  const K = 128;
  const table = new Array<number>(K + 1);
  let j = 0;
  for (let a = 0; a <= K; a++) {
    const target = (a / K) * total;
    while (j < M && cum[j + 1]! < target) j++;
    const seg = cum[j + 1]! - cum[j]!;
    table[a] = (j + (seg > 0 ? (target - cum[j]!) / seg : 0)) / M;
  }
  return table;
})();

// arc fraction s in [0,1) -> spiral parameter n. Interpolated, not rounded:
// rounding here quantises the motion into visible steps.
function arcToN(table: number[], s: number) {
  "worklet";
  const K = table.length - 1;
  const x = Math.max(0, Math.min(K, s * K));
  const i = Math.floor(x);
  const a = table[i]!;
  const b = table[Math.min(i + 1, K)]!;
  return a + (b - a) * (x - i);
}

interface Props {
  onAdd: () => void;
  maxWidth?: number | undefined;
}

export function EmptyAssetsVortex({ onAdd, maxWidth }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  const isFocused = useIsFocused();
  const progress = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Parked while the tab is in the background: an infinite UI-thread animation
  // is cheap, but not free, and nothing is on screen to justify it. Reduce
  // Motion freezes the spiral into a static, still-composed fan.
  useEffect(() => {
    if (!isFocused || reduceMotion) {
      cancelAnimation(progress);
      return;
    }
    // Resume from the current phase, not from 0: `withTiming` animates from
    // whatever the value currently is, so targeting a fixed number would both
    // jump the layout and change the speed on every re-focus. The span stays
    // exactly DRIVER_CYCLES, so `% 1` is unchanged across the repeat seam.
    const from = progress.value % 1;
    progress.value = from;
    progress.value = withRepeat(
      withTiming(from + DRIVER_CYCLES, {
        duration: CYCLE_MS * DRIVER_CYCLES,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, [isFocused, reduceMotion, progress]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  return (
    <View style={s.root} onLayout={onLayout}>
      {size.w > 0 &&
        Array.from({ length: SLOTS }, (_, i) => (
          <VortexCard key={i} index={i} progress={progress} w={size.w} h={size.h} />
        ))}

      <TouchableOpacity
        style={[s.cta, maxWidth ? { maxWidth } : null]}
        onPress={onAdd}
        activeOpacity={0.85}
      >
        <Image source={iconPng} style={s.ctaLogo} />
        <Text style={s.ctaTitle}>＋ 新增第一筆資產</Text>
      </TouchableOpacity>
    </View>
  );
}

interface CardProps {
  index: number;
  progress: SharedValue<number>;
  w: number;
  h: number;
}

function VortexCard({ index, progress, w, h }: CardProps) {
  const cat = CATEGORIES[index % CATEGORIES.length]!;
  // Slots are offset by a fixed fraction of the path, so the stream stays
  // continuous no matter where `progress` happens to be.
  const offset = index / SLOTS;
  const R = 0.48 * Math.min(w, h) * SPREAD;
  const cx = w / 2;
  const cy = h / 2;

  const style = useAnimatedStyle(() => {
    const t = (progress.value + offset) % 1;
    const n = arcToN(ARC_TABLE, t);
    const x = spiralX(n, R);
    const y = spiralY(n, R);

    // Tangent by finite difference — cards turn to follow the path instead of
    // sliding along it face-on.
    const nAhead = Math.min(n + 0.002, 1);
    const angle = Math.atan2(spiralY(nAhead, R) - y, spiralX(nAhead, R) - x);

    const dist = Math.hypot(x, y);
    const scale = Math.pow(Math.min(dist / R, 1), SIZE_ATTENUATION * 0.5);

    let opacity = 1;
    if (t < FADE_IN) opacity = t / FADE_IN;
    else if (t > 1 - FADE_OUT) opacity = (1 - t) / FADE_OUT;

    return {
      opacity,
      transform: [
        { translateX: cx + x - CARD_W / 2 },
        { translateY: cy + y - CARD_H / 2 },
        { rotate: `${angle}rad` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        s.card,
        { backgroundColor: cat.color },
        // The two near-white cards would otherwise dissolve into the #f2f2f7
        // background, exactly as they do in the card stack.
        (cat.color === "#FFFFFF" || cat.color === "#f2f2f7") && s.cardBorder,
        style,
      ]}
      pointerEvents="none"
    >
      <Text style={[s.cardLabel, { color: cat.textColor }]} numberOfLines={1}>
        {cat.name}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },

  card: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 5,
  },
  cardBorder: { borderWidth: 1, borderColor: "rgba(28,28,30,0.12)" },
  cardLabel: { fontSize: 24, fontWeight: "700" },

  // 半透明而非實心白：卡片會從 CTA 底下飄過去，透出來的移動色塊就是玻璃感的
  // 來源。上緣一道亮邊模擬光線打在玻璃邊緣，跟 TopGlassNav 的 addInner 同手法。
  // 真正的背景模糊要 expo-blur（原生模組，OTA 送不了），這裡刻意不用。
  cta: {
    backgroundColor: "rgba(255,255,255,0.62)",
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 22,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  // 跟 welcome 頁同一套品牌標記處理，只是縮到 64 以免壓過 CTA 文字。
  ctaLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#374254",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaTitle: { fontSize: 15, fontWeight: "600", color: "#374254" },
});
