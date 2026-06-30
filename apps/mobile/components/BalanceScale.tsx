import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

/**
 * Animated balance scale — mirrors web's TransactionsPage BalanceScale.
 * Tilts based on assets/liabilities ratio; jiggles when a pan is tapped.
 */
export function BalanceScale({ assets, liabilities }: { assets: number; liabilities: number }) {
  const total = assets + liabilities;
  const assetRatio = total > 0 ? assets / total : 0.5;
  const rotation = (0.5 - assetRatio) * 28;

  // animated tilt value in degrees
  const tilt = useRef(new Animated.Value(0)).current;
  const isJiggling = useRef(false);

  // settle to resting rotation on mount / when rotation changes
  useEffect(() => {
    Animated.timing(tilt, {
      toValue: rotation,
      duration: 1300,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();
  }, [rotation, tilt]);

  function jiggle(side: "left" | "right") {
    if (isJiggling.current) return;
    isJiggling.current = true;
    const dir = side === "left" ? -1 : 1;
    const seq = (to: number, duration: number) =>
      Animated.timing(tilt, {
        toValue: rotation + to,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    Animated.sequence([
      seq(dir * 11, 180),
      seq(dir * -8, 160),
      seq(dir * 5, 140),
      seq(dir * -2, 120),
      seq(0, 180),
    ]).start(() => {
      isJiggling.current = false;
    });
  }

  const beamRotate = tilt.interpolate({
    inputRange: [-30, 30],
    outputRange: ["-30deg", "30deg"],
  });
  // pans counter-rotate to stay vertical
  const panRotate = tilt.interpolate({
    inputRange: [-30, 30],
    outputRange: ["30deg", "-30deg"],
  });

  return (
    <View style={s.root}>
      {/* Stand */}
      <View style={s.stand} />
      {/* Pivot dot */}
      <View style={s.pivot} />
      {/* Beam */}
      <Animated.View style={[s.beam, { transform: [{ rotate: beamRotate }] }]}>
        {/* Left (assets) */}
        <Animated.View style={[s.panWrap, s.panLeft, { transform: [{ rotate: panRotate }] }]}>
          <Pressable onPress={() => jiggle("left")} style={s.panPress}>
            <View style={s.string} />
            <View style={[s.pan, { backgroundColor: "#374254" }]} />
          </Pressable>
        </Animated.View>
        {/* Right (liabilities) */}
        <Animated.View style={[s.panWrap, s.panRight, { transform: [{ rotate: panRotate }] }]}>
          <Pressable onPress={() => jiggle("right")} style={s.panPress}>
            <View style={s.string} />
            <View style={[s.pan, { backgroundColor: "#C7C7D4" }]} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { width: 220, height: 108 },
  stand: {
    position: "absolute",
    top: 11,
    left: "50%",
    marginLeft: -3,
    width: 6,
    height: 44,
    backgroundColor: "#1c1c1e",
    borderRadius: 2,
  },
  pivot: {
    position: "absolute",
    top: 50,
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#374254",
    zIndex: 1,
  },
  beam: {
    position: "absolute",
    top: 55,
    left: 10,
    right: 10,
    height: 6,
    backgroundColor: "#1c1c1e",
    borderRadius: 2,
  },
  panWrap: {
    position: "absolute",
    top: 3,
    width: 0,
    alignItems: "center",
    transformOrigin: "top center",
  },
  panLeft: { left: 0 },
  panRight: { right: 0 },
  panPress: { alignItems: "center" },
  string: { width: 3, height: 30, backgroundColor: "#8e8e93" },
  pan: {
    width: 52,
    height: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});
