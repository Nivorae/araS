import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * 貼齊螢幕底部的 bottom sheet / modal，其最後一個元素要用的 paddingBottom。
 *
 * 為什麼需要：這些 sheet 的底緣就是螢幕底緣，不像一般畫面有 SafeAreaView 擋著，
 * 所以 home indicator 會直接壓在最下面的按鈕上。單純用 insets.bottom 也不行 ——
 * 舊機型（有實體 Home 鍵）回傳 0，會讓按鈕整個貼死在邊緣，所以取兩者較大值。
 *
 * @param min 沒有 home indicator 時要保留的視覺留白，預設 20。
 */
export function useSheetBottomPadding(min = 20): number {
  const insets = useSafeAreaInsets();
  return Math.max(min, insets.bottom);
}
