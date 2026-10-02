import { useEffect, useRef } from "react";
// eslint-disable-next-line no-restricted-imports -- the one place allowed to wrap RN's Modal
import { Keyboard, Modal as RNModal, type ModalProps } from "react-native";
import { LockScreen } from "@/components/LockScreen";

/**
 * App 裡所有 Modal 都要用這個，不要直接用 react-native 的（lint 會擋）。
 *
 * RN 的 Modal 在 iOS 是另一個原生視窗，會浮在整個 App 畫面上面，AppLockGate
 * 蓋在主畫面的鎖定畫面擋不住它 —— 開著 Modal 時被鎖定，Modal 裡的內容會露在
 * 鎖定畫面外。所以每個 Modal 裡自己再畫一層 LockScreen。內容保持 mount，解鎖後
 * 填到一半的表單還在。
 *
 * 關閉時（取消、返回、點背景、Android 返回鍵，不論哪個按鈕觸發）一律收起鍵盤，
 * 否則 Modal 裡輸入框叫出的鍵盤會留在底下的畫面上。只在「開 → 關」那一刻收：
 * 很多 Modal 一直掛著 `visible={false}`，掛載時就收會把所在畫面 autoFocus 的
 * 鍵盤一起關掉。
 */
export function Modal({ children, visible, ...props }: ModalProps) {
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (wasVisible.current && !visible) Keyboard.dismiss();
    wasVisible.current = visible;
  }, [visible]);

  // 開著就被整個卸載（例如 `{open && <Modal visible />}` 的寫法）也要收。
  useEffect(
    () => () => {
      if (wasVisible.current) Keyboard.dismiss();
    },
    []
  );

  return (
    <RNModal visible={visible} {...props}>
      {children}
      <LockScreen />
    </RNModal>
  );
}
