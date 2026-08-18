import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";
import {
  WHATS_NEW_STORAGE_KEY,
  parseWhatsNew,
  shouldShowWhatsNew,
  type WhatsNew,
} from "@/lib/whatsNew";

/**
 * 重啟套用新 bundle 後的第一次執行，顯示一次「本次更新」。
 *
 * 文案來自這份 bundle 自己的 `app.json` → `expo.extra.whatsNew`（`extra` 不是原
 * 生欄位，改它走 OTA 即可，不需要重新打包）。顯示與否的規則全部在
 * `lib/whatsNew.ts` 的 `shouldShowWhatsNew()`，這裡只負責讀 storage 與畫面。
 *
 * 沿用 ReinvestSheet 的 bottom-sheet 視覺，不另創一套。
 *
 * 文案分區塊（新功能／優化／立即重啟）呈現，區塊標題與順序完全由 `app.json`
 * 決定，這裡不寫死任何一個標題 —— 沒有內容的區塊在解析階段就被丟掉了。
 */
export default function WhatsNewSheet() {
  const { isTablet } = useResponsive();
  const bottomPad = useSheetBottomPadding();
  const { currentlyRunning } = Updates.useUpdates();
  const [content, setContent] = useState<WhatsNew | null>(null);

  useEffect(() => {
    let active = true;
    const whatsNew = parseWhatsNew(Constants.expoConfig?.extra?.whatsNew);

    (async () => {
      let lastShownId: string | null = null;
      try {
        lastShownId = await AsyncStorage.getItem(WHATS_NEW_STORAGE_KEY);
      } catch {
        // 讀不到就當作沒看過 —— 最壞的情況是同一份文案多顯示一次。
      }
      if (!active) return;
      const show = shouldShowWhatsNew({
        whatsNew,
        lastShownId,
        isEnabled: Updates.isEnabled,
        isEmbeddedLaunch: currentlyRunning.isEmbeddedLaunch,
      });
      if (show) setContent(whatsNew);
    })();
    return () => {
      active = false;
    };
    // 只在掛載時判斷一次：`currentlyRunning` 在整個 App 生命週期內是固定的。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    const id = content?.id;
    setContent(null);
    // 寫入放在關閉時而不是顯示時：使用者真的看到了才算數。失敗就下次再顯示一次。
    if (id) AsyncStorage.setItem(WHATS_NEW_STORAGE_KEY, id).catch(() => {});
  };

  if (!content) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable style={[s.sheet, isTablet && s.sheetTablet]} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>本次更新</Text>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
            {content.sections.map((section) => (
              <View key={section.title} style={s.section}>
                <Text style={s.sectionTitle}>{section.title}</Text>
                {section.items.map((item) => (
                  <View key={item} style={s.row}>
                    <Text style={s.bullet}>・</Text>
                    <Text style={s.line}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={[s.actions, { paddingBottom: bottomPad }]}>
            <Pressable onPress={handleClose} style={[s.btn, s.btnPrimary]}>
              <Text style={s.btnPrimaryText}>知道了</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d1d6",
    alignSelf: "center",
    marginTop: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1c1e",
    textAlign: "center",
    marginVertical: 14,
  },
  // 文案長度不受控（發版時想寫幾行就幾行），所以給一個上限並讓它自己捲動，
  // 不讓 sheet 長到把按鈕推出畫面外。
  body: { paddingHorizontal: 20, maxHeight: 320 },
  bodyContent: { gap: 18, paddingBottom: 4 },
  // 區塊之間留 18，區塊內的項目只留 6 —— 靠間距而不是分隔線來分組，標題才不會
  // 看起來像跟著上一組的最後一行。
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#8e8e93", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  bullet: { fontSize: 14, color: "#8e8e93", lineHeight: 21 },
  line: { flex: 1, fontSize: 14, color: "#1c1c1e", lineHeight: 21 },
  // `row` 是必要的，不是排版偏好：btn 用 flex: 1 佔滿寬度，放在預設的 column
  // 容器裡會被當成 flexBasis: 0 壓掉高度，按鈕文字就整個被裁掉。
  actions: { flexDirection: "row", padding: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 15, color: "#fff", fontWeight: "600" },
});
