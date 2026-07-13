import { useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

export interface SwipeAction {
  key: string;
  label: string;
  color: string;
  onPress: () => void;
}

const ACTION_WIDTH = 76;

/**
 * A left-swipe row that reveals action buttons — built on core RN
 * `PanResponder` + `Animated` (no react-native-gesture-handler), so it ships
 * over-the-air without a native rebuild.
 *
 * Horizontal drags are claimed by this row; vertical drags fall through to the
 * parent ScrollView.
 */
export function SwipeableRow({
  children,
  actions,
  containerStyle,
}: {
  children: React.ReactNode;
  actions: SwipeAction[];
  containerStyle?: ViewStyle;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const openWidth = actions.length * ACTION_WIDTH;

  const animateTo = (to: number) => {
    offset.current = to;
    Animated.spring(translateX, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const close = () => animateTo(0);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_evt, g) => {
        const next = Math.min(0, Math.max(-openWidth - 24, offset.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, g) => {
        const projected = offset.current + g.dx;
        // Open if dragged past halfway or flicked left; otherwise snap closed.
        const shouldOpen = projected < -openWidth / 2 || g.vx < -0.4;
        animateTo(shouldOpen ? -openWidth : 0);
      },
      onPanResponderTerminate: () => animateTo(offset.current < -openWidth / 2 ? -openWidth : 0),
    })
  ).current;

  return (
    <View style={[s.wrap, containerStyle]}>
      {/* Action buttons sit behind the row, revealed as it slides left. */}
      <View style={s.actions} pointerEvents="box-none">
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => {
              close();
              a.onPress();
            }}
            style={[s.actionBtn, { backgroundColor: a.color }]}
          >
            <Text style={s.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: "#ffffff" },
  actions: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  actionBtn: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
});
