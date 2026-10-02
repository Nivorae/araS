import { Keyboard } from "react-native";

/**
 * 離開畫面時收起鍵盤，掛在 navigator 的 `screenListeners` 上，所有畫面一次套用。
 *
 * - `beforeRemove`：按返回 / 取消（`router.back()`）時，在畫面滑走「之前」就收，
 *   不會等動畫跑完鍵盤才掉下來。
 * - `transitionStart` 且 `closing`：iOS 從邊緣滑動返回，手勢一開始就收。只看
 *   closing —— 進入新畫面時不能收，那會關掉新畫面 autoFocus 叫出的鍵盤。
 * - `blur`：只給分頁（Tabs）用，切到別的分頁時收。Stack 不用 blur：push 新畫面時
 *   舊畫面的 blur 可能晚於新畫面 autoFocus，會把新畫面的鍵盤收掉。
 */
export const dismissKeyboardOnLeave = {
  beforeRemove: () => Keyboard.dismiss(),
  transitionStart: (e: { data?: { closing?: boolean } }) => {
    if (e.data?.closing) Keyboard.dismiss();
  },
};

export const dismissKeyboardOnTabBlur = {
  blur: () => Keyboard.dismiss(),
};
