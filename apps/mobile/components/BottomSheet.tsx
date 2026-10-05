import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
 * 多留約 0.2 秒；鍵盤則在關閉的當下就收，不等動畫。面板裡有輸入框時，iOS 會把
 * 面板推到鍵盤上方。
 *
 * `sheetStyle` 的高度不能用百分比（`maxHeight: "88%"`）：面板的父層高度由內容
 * 決定，百分比算不出來，外層與面板量到的高度會不一致，面板底下露出一截背景。
 * 要限制高度就用 `useWindowDimensions().height * 0.88` 換成像素。
 */
export function BottomSheet({
  visible,
  onClose,
  sheetStyle,
  dismissOnBackdrop = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  /** false：點黑底不關閉（例如內容很長、怕跟捲動搶手勢的面板）。 */
  dismissOnBackdrop?: boolean;
  children: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  // 面板實際高度；量到之前先用螢幕高度，保證一開始完全在畫面外。
  const [sheetHeight, setSheetHeight] = useState(0);
  const wasVisible = useRef(visible);

  useEffect(() => {
    // 只在「開 → 關」那一刻收鍵盤；掛載時就是關著的面板不能動到所在畫面的鍵盤。
    if (wasVisible.current && !visible) Keyboard.dismiss();
    wasVisible.current = visible;
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
        {dismissOnBackdrop && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
      </Animated.View>
      {/* box-none：空白處的點擊穿過去落到黑底上（點背景關閉）。 */}
      <KeyboardAvoidingView
        style={s.avoider}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        {/* 外層負責滑動，sheetStyle 放在內層：iPad 的置中寬度（width +
            alignSelf）要在一般排版的子元素上才會生效。 */}
        <Animated.View
          style={{ transform: [{ translateY }] }}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        >
          <View style={sheetStyle}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  avoider: { flex: 1, justifyContent: "flex-end" },
});
