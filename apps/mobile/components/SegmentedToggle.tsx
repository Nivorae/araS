import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { pressFeedback } from "@/lib/haptics";

// Same spring shapes as TopGlassNav (press / highlight / bounce) and
// ModeToggle's pill, so every toggle in the app moves with one feel.
const PILL_SPRING = { damping: 19, stiffness: 240, mass: 0.8 } as const;
const PRESS_SPRING = { damping: 20, stiffness: 300, mass: 1 } as const;
const BOUNCE_SPRING = { damping: 14, stiffness: 220, mass: 1 } as const;

const TRACK_PAD = 3;

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

/**
 * Pill-shaped segmented control: the white highlight springs between segments,
 * a pressed segment shrinks and springs back, and the newly-active label hops
 * up and lands with an overshoot — the TopGlassNav tab feel in text form.
 *
 * `onPress` decides whether the value actually changes (e.g. a Premium gate
 * can open the paywall instead), so a blocked tap still gets press feedback
 * but the highlight stays put.
 */
export function SegmentedToggle<K extends string>({
  options,
  value,
  onPress,
}: {
  options: SegmentOption<K>[];
  value: K;
  onPress: (key: K) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value)
  );
  const [segW, setSegW] = useState(0);
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = withSpring(index, PILL_SPRING);
  }, [index, pos]);

  const onLayout = (e: LayoutChangeEvent) =>
    setSegW((e.nativeEvent.layout.width - TRACK_PAD * 2) / options.length);

  const pillStyle = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: pos.value * segW }],
  }));

  return (
    <View style={s.track} onLayout={onLayout}>
      {segW > 0 && <Animated.View style={[s.pill, pillStyle]} />}
      {options.map((o, i) => (
        <Segment
          key={o.key}
          label={o.label}
          index={i}
          active={i === index}
          pos={pos}
          onPress={() => {
            if (o.key !== value) pressFeedback();
            onPress(o.key);
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  index,
  active,
  pos,
  onPress,
}: {
  label: string;
  index: number;
  active: boolean;
  pos: SharedValue<number>;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const hop = useSharedValue(0);

  // Hop only on the transition into active, not on first mount.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      hop.value = withSequence(withTiming(-5, { duration: 130 }), withSpring(0, BOUNCE_SPRING));
    }
    wasActive.current = active;
  }, [active, hop]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: hop.value }],
  }));
  const textStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(pos.value - index));
    return { color: interpolateColor(t, [0, 1], ["#8e8e93", "#1c1c1e"]) };
  });

  return (
    <Pressable
      style={s.segment}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.86, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={wrapStyle}>
        <Animated.Text style={[s.label, textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: "#e5e5ea",
    borderRadius: 20,
    padding: TRACK_PAD,
  },
  pill: {
    position: "absolute",
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: TRACK_PAD,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segment: { width: 66, alignItems: "center", paddingVertical: 6 },
  label: { fontSize: 13, fontWeight: "600" },
});
