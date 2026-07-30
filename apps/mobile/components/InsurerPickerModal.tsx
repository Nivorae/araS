import { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Search } from "lucide-react-native";
import { INSURER_LIST } from "@repo/shared";

const OTHER_LABEL = "其他（自行填寫）";

interface Props {
  visible: boolean;
  selected?: string | null;
  onClose: () => void;
  onSelect: (insurer: string) => void;
}

export function InsurerPickerModal({ visible, selected, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    const q = query.trim();
    const filtered = q ? INSURER_LIST.filter((name) => name.includes(q)) : INSURER_LIST;
    return [...filtered, OTHER_LABEL];
  }, [query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#1c1c1e" />
          </TouchableOpacity>
          <Text style={s.title}>選擇保險公司</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.searchRow}>
          <Search size={16} color="#8e8e93" />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="搜尋保險公司"
            placeholderTextColor="#c7c7cc"
          />
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => {
            const isOther = item === OTHER_LABEL;
            const isSelected = !isOther && item === selected;
            return (
              <TouchableOpacity
                onPress={() => {
                  onSelect(isOther ? "" : item);
                  onClose();
                }}
                style={s.row}
                activeOpacity={0.7}
              >
                <Text style={[s.rowLabel, isSelected && s.rowLabelActive, isOther && s.otherLabel]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1c1c1e" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1c1c1e" },
  list: { paddingTop: 12, paddingBottom: 24 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e5ea",
    marginHorizontal: 16,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  rowLabel: { fontSize: 15, color: "#1c1c1e" },
  rowLabelActive: { fontWeight: "700", color: "#374254" },
  otherLabel: { color: "#374254", fontWeight: "600" },
});
