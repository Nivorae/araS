import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import type { CoverageOption } from "@repo/shared";

interface Props {
  visible: boolean;
  options: CoverageOption[];
  onClose: () => void;
  onSelect: (option: CoverageOption) => void;
}

export function CoverageItemPicker({ visible, options, onClose, onSelect }: Props) {
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
          <Text style={s.title}>選擇保障項目</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={options}
          keyExtractor={(item) => item.key}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>已選滿保障項目</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={s.row}
              activeOpacity={0.7}
            >
              <Text style={s.rowLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
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
  list: { paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e5ea",
    marginHorizontal: 16,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  rowLabel: { fontSize: 15, color: "#1c1c1e" },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#8e8e93" },
});
