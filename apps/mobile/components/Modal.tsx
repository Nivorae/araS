// eslint-disable-next-line no-restricted-imports -- the one place allowed to wrap RN's Modal
import { Modal as RNModal, type ModalProps } from "react-native";
import { LockScreen } from "@/components/LockScreen";

/**
 * App 裡所有 Modal 都要用這個，不要直接用 react-native 的（lint 會擋）。
 *
 * RN 的 Modal 在 iOS 是另一個原生視窗，會浮在整個 App 畫面上面，AppLockGate
 * 蓋在主畫面的鎖定畫面擋不住它 —— 開著 Modal 時被鎖定，Modal 裡的內容會露在
 * 鎖定畫面外。所以每個 Modal 裡自己再畫一層 LockScreen。內容保持 mount，解鎖後
 * 填到一半的表單還在。
 */
export function Modal({ children, ...props }: ModalProps) {
  return (
    <RNModal {...props}>
      {children}
      <LockScreen />
    </RNModal>
  );
}
