import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// ─── Pure-JS date picker (no native module → OTA-safe) ───────────────────────
// Replaces @react-native-community/datetimepicker. Year range spans all past
// years (down to 1950) up to next year so historical records can be dated.

const _YEAR_NOW = new Date().getFullYear();
const _DP_YEAR_MIN = 1950;
const _DP_YEARS = Array.from(
  { length: _YEAR_NOW + 1 - _DP_YEAR_MIN + 1 },
  (_, i) => _DP_YEAR_MIN + i
);
const _DP_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const _DP_ROW_H = 44;
const _DP_VISIBLE_ROWS = 5;

export function DatePickerModal({
  visible,
  date,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  date: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const [y, setY] = useState(date.getFullYear());
  const [m, setM] = useState(date.getMonth() + 1);
  const [d, setD] = useState(date.getDate());

  useEffect(() => {
    if (visible) {
      setY(date.getFullYear());
      setM(date.getMonth() + 1);
      setD(date.getDate());
    }
  }, [visible, date]);

  const daysInMonth = new Date(y, m, 0).getDate();
  const pickerDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const clampedDay = Math.min(d, daysInMonth);

  // Centre the selected value in each 5-row column.
  const getItemLayout = (_: unknown, index: number) => ({
    length: _DP_ROW_H,
    offset: _DP_ROW_H * index,
    index,
  });
  const centreOffset = Math.floor(_DP_VISIBLE_ROWS / 2);
  const yearIndex = Math.max(0, _DP_YEARS.indexOf(y) - centreOffset);
  const monthIndex = Math.max(0, m - 1 - centreOffset);
  const dayIndex = Math.max(0, clampedDay - 1 - centreOffset);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={dpS.backdrop} onPress={onClose} />
      <View style={dpS.sheet}>
        <View style={dpS.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={dpS.cancel}>取消</Text>
          </TouchableOpacity>
          <Text style={dpS.title}>選擇日期</Text>
          <TouchableOpacity
            onPress={() => {
              onConfirm(new Date(y, m - 1, clampedDay));
              onClose();
            }}
          >
            <Text style={dpS.done}>完成</Text>
          </TouchableOpacity>
        </View>
        <View style={dpS.cols}>
          <FlatList
            style={dpS.col}
            data={_DP_YEARS}
            keyExtractor={(item) => `y${item}`}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialScrollIndex={yearIndex}
            renderItem={({ item }) => (
              <TouchableOpacity style={dpS.itemRow} onPress={() => setY(item)}>
                <Text style={[dpS.item, item === y && dpS.active]}>{item}年</Text>
              </TouchableOpacity>
            )}
          />
          <FlatList
            style={dpS.col}
            data={_DP_MONTHS}
            keyExtractor={(item) => `m${item}`}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialScrollIndex={monthIndex}
            renderItem={({ item }) => (
              <TouchableOpacity style={dpS.itemRow} onPress={() => setM(item)}>
                <Text style={[dpS.item, item === m && dpS.active]}>
                  {String(item).padStart(2, "0")}月
                </Text>
              </TouchableOpacity>
            )}
          />
          <FlatList
            style={dpS.col}
            data={pickerDays}
            keyExtractor={(item) => `d${item}`}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialScrollIndex={dayIndex}
            renderItem={({ item }) => (
              <TouchableOpacity style={dpS.itemRow} onPress={() => setD(item)}>
                <Text style={[dpS.item, item === clampedDay && dpS.active]}>
                  {String(item).padStart(2, "0")}日
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const dpS = StyleSheet.create({
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
  cols: { flexDirection: "row", height: _DP_ROW_H * _DP_VISIBLE_ROWS },
  col: { flex: 1 },
  itemRow: { height: _DP_ROW_H, alignItems: "center", justifyContent: "center" },
  item: { fontSize: 16, color: "#8e8e93" },
  active: { fontSize: 18, fontWeight: "700", color: "#1c1c1e" },
});
