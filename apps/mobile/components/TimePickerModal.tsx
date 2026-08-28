import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";

// ─── Pure-JS time picker (no native module → OTA-safe) ───────────────────────
// The sibling of DatePickerModal, same geometry and colours: two 5-row columns
// instead of three. Minutes step by 5 — a monthly reminder does not need
// minute-level precision, and 60 rows makes the column a scroll marathon.

const _TP_HOURS = Array.from({ length: 24 }, (_, i) => i);
const _TP_MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const _TP_ROW_H = 44;
const _TP_VISIBLE_ROWS = 5;

/** 07:05 —— 顯示與儲存都用兩位數，排序與比對才不會出錯。 */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePickerModal({
  visible,
  hour,
  minute,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  hour: number;
  minute: number;
  onConfirm: (hour: number, minute: number) => void;
  onClose: () => void;
}) {
  const { isTablet } = useResponsive();
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  useEffect(() => {
    if (visible) {
      setH(hour);
      // 從外面傳進來的分鐘不一定落在 5 的倍數上（例如舊版存的值），對齊到最近
      // 的可選項，否則畫面上不會有任何一列是選中的。
      setM(Math.round(minute / 5) * 5 === 60 ? 55 : Math.round(minute / 5) * 5);
    }
  }, [visible, hour, minute]);

  const getItemLayout = (_: unknown, index: number) => ({
    length: _TP_ROW_H,
    offset: _TP_ROW_H * index,
    index,
  });
  const centreOffset = Math.floor(_TP_VISIBLE_ROWS / 2);
  const hourIndex = Math.max(0, h - centreOffset);
  const minuteIndex = Math.max(0, _TP_MINUTES.indexOf(m) - centreOffset);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={tpS.backdrop} onPress={onClose} />
      <View style={[tpS.sheet, isTablet && tpS.sheetTablet]}>
        <View style={tpS.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={tpS.cancel}>取消</Text>
          </TouchableOpacity>
          <Text style={tpS.title}>選擇提醒時間</Text>
          <TouchableOpacity
            onPress={() => {
              onConfirm(h, m);
              onClose();
            }}
          >
            <Text style={tpS.done}>完成</Text>
          </TouchableOpacity>
        </View>
        <View style={tpS.cols}>
          <FlatList
            style={tpS.col}
            data={_TP_HOURS}
            keyExtractor={(item) => `h${item}`}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialScrollIndex={hourIndex}
            renderItem={({ item }) => (
              <TouchableOpacity style={tpS.itemRow} onPress={() => setH(item)}>
                <Text style={[tpS.item, item === h && tpS.active]}>
                  {String(item).padStart(2, "0")} 時
                </Text>
              </TouchableOpacity>
            )}
          />
          <FlatList
            style={tpS.col}
            data={_TP_MINUTES}
            keyExtractor={(item) => `m${item}`}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialScrollIndex={minuteIndex}
            renderItem={({ item }) => (
              <TouchableOpacity style={tpS.itemRow} onPress={() => setM(item)}>
                <Text style={[tpS.item, item === m && tpS.active]}>
                  {String(item).padStart(2, "0")} 分
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const tpS = StyleSheet.create({
  sheetTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  title: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  cancel: { fontSize: 16, color: "#8e8e93" },
  done: { fontSize: 16, fontWeight: "600", color: "#374254" },
  cols: { flexDirection: "row", height: _TP_ROW_H * _TP_VISIBLE_ROWS },
  col: { flex: 1 },
  itemRow: { height: _TP_ROW_H, alignItems: "center", justifyContent: "center" },
  item: { fontSize: 16, color: "#8e8e93" },
  active: { fontSize: 18, fontWeight: "700", color: "#1c1c1e" },
});
