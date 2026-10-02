import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Modal } from "@/components/Modal";

const OPEN_MS = 280;
const CLOSE_MS = 220;

/**
 * 從底部滑上來的面板，背後一層半透明黑底。
 *
 * 不用 RN Modal 的 `animationType="slide"`：那會把整個 Modal（連黑底一起）
 * 從底下推上來，看得到一大塊黑色往上滑、往下滑。這裡 Modal 本身不做動畫，
 * 改成黑底原地淡入淡出、只有面板滑動，跟 iOS 原生的表單一樣。
 *
 * 關閉時先跑完退場動畫才把 Modal 拿掉，所以 `visible` 變 false 後內容還會
 * 多留約 0.2 秒。
 */
export function BottomSheet({
  visible,
  onClose,
  sheetStyle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  // 面板實際高度；量到之前先用螢幕高度，保證一開始完全在畫面外。
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight || windowHeight, 0],
  });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      {/* 外層負責定位與滑動，sheetStyle 放在內層：iPad 的置中寬度
          （width + alignSelf）在絕對定位的元素上不會生效。 */}
      <Animated.View
        style={[s.slider, { transform: [{ translateY }] }]}
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      >
        <View style={sheetStyle}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  slider: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
