import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { pressFeedback } from "@/lib/haptics";

export type Mode = "retirement" | "finance";

const MODES: { key: Mode; label: string }[] = [
  { key: "retirement", label: "退休計劃" },
  { key: "finance", label: "理財規劃" },
];

const INDEX: Record<Mode, number> = { retirement: 0, finance: 1 };

// Content slides this far toward the direction of travel while fading.
const SHIFT = 28;
const EXIT_MS = 110;
const ENTER_SPRING = { damping: 20, stiffness: 190, mass: 0.9 } as const;
const PILL_SPRING = { damping: 19, stiffness: 240, mass: 0.8 } as const;

type Transition = { opacity: SharedValue<number>; offset: SharedValue<number> };

/**
 * Mode switching with a two-phase transition: the current content fades out
 * while sliding away, THEN the new mode is committed and slides in from the
 * other side. Doing it in sequence (rather than a cross-fade) means the two
 * layouts never occupy the page at once, so nothing below them jumps.
 *
 * `selected` updates immediately so the toggle responds on tap; `mode` is what
 * the screen renders and only flips once the old content is invisible.
 */
export function useModeTransition(initial: Mode) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);
  const modeRef = useRef(initial);
  // Direction of an enter that is waiting for React to commit the new mode.
  const pendingDir = useRef(0);

  const runEnter = useCallback(
    (dir: number) => {
      // Jump to the far side (invisible, opacity is 0) before springing home.
      offset.value = withSequence(
        withTiming(dir * SHIFT, { duration: 0 }),
        withSpring(0, ENTER_SPRING)
      );
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    },
    [offset, opacity]
  );

  const commit = useCallback(
    (next: Mode, dir: number) => {
      // Tapped back to the mode still on screen: nothing to re-render.
      if (next === modeRef.current) {
        runEnter(dir);
        return;
      }
      modeRef.current = next;
      pendingDir.current = dir;
      setMode(next);
    },
    [runEnter]
  );

  // Start the enter only after the new mode has been committed and painted.
  // Starting it alongside setMode fades the OLD tree back in while React is
  // still swapping the (heavy) retirement content, which reads as a leftover
  // frame of the previous screen.
  useEffect(() => {
    const dir = pendingDir.current;
    if (dir === 0) return;
    pendingDir.current = 0;
    runEnter(dir);
  }, [mode, runEnter]);

  const select = useCallback(
    (next: Mode) => {
      if (next === selected) return;
      pressFeedback();
      setSelected(next);

      if (reduceMotion) {
        modeRef.current = next;
        setMode(next);
        return;
      }

      // Forward (to the right-hand tab) moves content left, back moves it right.
      const dir = INDEX[next] > INDEX[selected] ? 1 : -1;
      // Ease-out so the old content starts disappearing on the tap itself;
      // ease-in held it almost fully visible for most of the exit.
      const exit = { duration: EXIT_MS, easing: Easing.out(Easing.quad) };
      opacity.value = withTiming(0, exit);
      offset.value = withTiming(-dir * SHIFT, exit, (finished) => {
        // A newer tap cancels this exit and schedules its own commit.
        if (finished) scheduleOnRN(commit, next, dir);
      });
    },
    [selected, reduceMotion, opacity, offset, commit]
  );

  return { mode, selected, select, transition: { opacity, offset } as Transition };
}

/** Wraps a block of mode-specific content so it follows the shared transition. */
export function ModeTransitionView({
  transition,
  children,
}: {
  transition: Transition;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: transition.opacity.value,
    transform: [{ translateX: transition.offset.value }],
  }));
  return <Animated.View style={[s.transition, style]}>{children}</Animated.View>;
}

/** Segmented control whose white pill springs between the two options. */
export function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const [segW, setSegW] = useState(0);
  const pos = useSharedValue(INDEX[value]);

  useEffect(() => {
    pos.value = withSpring(INDEX[value], PILL_SPRING);
  }, [value, pos]);

  const onLayout = (e: LayoutChangeEvent) =>
    setSegW((e.nativeEvent.layout.width - TRACK_PAD * 2) / MODES.length);

  const pillStyle = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: pos.value * segW }],
  }));

  return (
    <View style={s.track} onLayout={onLayout}>
      {segW > 0 && <Animated.View style={[s.pill, pillStyle]} />}
      {MODES.map((m, i) => (
        <Pressable
          key={m.key}
          style={s.segment}
          onPress={() => onChange(m.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: m.key === value }}
        >
          <ToggleLabel label={m.label} index={i} pos={pos} />
        </Pressable>
      ))}
    </View>
  );
}

function ToggleLabel({
  label,
  index,
  pos,
}: {
  label: string;
  index: number;
  pos: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const active = Math.max(0, 1 - Math.abs(pos.value - index));
    return { color: interpolateColor(active, [0, 1], ["#8e8e93", "#1c1c1e"]) };
  });
  return <Animated.Text style={[s.label, style]}>{label}</Animated.Text>;
}

const TRACK_PAD = 3;

const s = StyleSheet.create({
  transition: { gap: 16 },
  track: {
    flexDirection: "row",
    backgroundColor: "#e5e5ea",
    borderRadius: 12,
    padding: TRACK_PAD,
  },
  pill: {
    position: "absolute",
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: TRACK_PAD,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 10 },
  label: { fontSize: 14, fontWeight: "600" },
});
