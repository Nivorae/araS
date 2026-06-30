import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { BankLogo } from "./BankLogo";

const COLS = 4;
const CELL_SIZE = (Dimensions.get("window").width - 32 - (COLS - 1) * 12) / COLS;

export interface BankItem {
  code: string;
  name: string;
}

export const BANKS: BankItem[] = [
  { code: "bot", name: "台灣銀行" },
  { code: "ctbc", name: "中國信託" },
  { code: "cathay", name: "國泰世華" },
  { code: "esun", name: "玉山銀行" },
  { code: "fubon", name: "台北富邦" },
  { code: "mega", name: "兆豐銀行" },
  { code: "tcb", name: "合作金庫" },
  { code: "firstbank", name: "第一銀行" },
  { code: "hana", name: "華南銀行" },
  { code: "chb", name: "彰化銀行" },
  { code: "landbank", name: "台灣土地銀行" },
  { code: "sinopac", name: "永豐銀行" },
  { code: "taishin", name: "台新銀行" },
  { code: "post", name: "中華郵政" },
  { code: "hsbc", name: "匯豐銀行" },
  { code: "dbs", name: "星展銀行" },
  { code: "line", name: "Line Bank" },
  { code: "ubot", name: "聯邦銀行" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bank: BankItem) => void;
  selectedCode?: string | null;
}

export function BankPickerModal({ visible, onClose, onSelect, selectedCode }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#1c1c1e" />
          </TouchableOpacity>
          <Text style={s.title}>選擇銀行</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={BANKS}
          keyExtractor={(item) => item.code}
          numColumns={COLS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={[s.cell, selectedCode === item.code && s.cellSelected]}
              activeOpacity={0.7}
            >
              <BankLogo code={item.code} name={item.name} size={CELL_SIZE * 0.55} />
              <Text style={s.bankName} numberOfLines={1}>
                {item.name}
              </Text>
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
  grid: { padding: 16, gap: 12 },
  row: { gap: 12 },
  cell: {
    width: CELL_SIZE,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: "#fff",
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: "#374254",
  },
  bankName: { fontSize: 11, fontWeight: "500", color: "#1c1c1e", textAlign: "center" },
});
