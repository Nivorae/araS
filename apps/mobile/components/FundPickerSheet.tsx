import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search } from "lucide-react-native";
import { useApi, ApiError } from "@/lib/api";
import { searchFunds, type FundSearchResult } from "@/lib/funds";
import { useResponsive } from "@/hooks/useResponsive";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";

interface FundPickerSheetProps {
  visible: boolean;
  /** 使用者自己記的名稱，開啟時當作第一次搜尋的關鍵字。 */
  initialQuery: string;
  onClose: () => void;
  onSelect: (fund: FundSearchResult) => void;
}

/**
 * 把使用者自己打的基金名稱綁到官方代碼上。
 *
 * 只在「還沒綁過」或使用者要換一檔時出現 —— 綁定後代碼寫回
 * `Entry.stockCode`，之後查淨值都直接用代碼，不會再走到這裡。
 */
export default function FundPickerSheet({
  visible,
  initialQuery,
  onClose,
  onSelect,
}: FundPickerSheetProps) {
  const api = useApi();
  const { isTablet, contentWidth } = useResponsive();
  const bottomPad = useSheetBottomPadding();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 「按了搜尋但沒有結果」和「還沒搜過」在畫面上要長得不一樣。
  const [searched, setSearched] = useState(false);

  async function run(term: string) {
    const q = term.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchFunds(api, q));
      setSearched(true);
    } catch (e) {
      setResults([]);
      setSearched(true);
      setError(
        e instanceof ApiError && e.code === "NETWORK"
          ? "網路連線中斷，請稍後再試"
          : "查詢失敗，請稍後再試"
      );
    } finally {
      setLoading(false);
    }
  }

  // 開啟時就用 entry 名稱搜一次 —— 多數情況第一次搜尋就找得到，使用者不用再打字。
  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery);
    setResults([]);
    setSearched(false);
    setError(null);
    void run(initialQuery);
    // run 依賴 api（穩定 ref），故意不列進 deps：只在開啟時跑一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialQuery]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[
            s.sheet,
            { paddingBottom: bottomPad },
            isTablet && { width: contentWidth, alignSelf: "center" },
          ]}
          onPress={() => {}}
        >
          <Text style={s.title}>選擇基金</Text>
          <Text style={s.subtitle}>
            從投信投顧公會（境內）與集保（境外）的每日淨值資料中比對，選定後就會記住代碼。
          </Text>

          <View style={s.searchRow}>
            <Search size={18} color="#8e8e93" />
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="輸入基金名稱"
              placeholderTextColor="#c7c7cc"
              returnKeyType="search"
              onSubmitEditing={() => void run(query)}
            />
            <Pressable
              onPress={() => void run(query)}
              disabled={loading || !query.trim()}
              style={({ pressed }) => [
                s.searchBtn,
                { opacity: loading || !query.trim() ? 0.5 : pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={s.searchBtnLabel}>搜尋</Text>
            </Pressable>
          </View>

          <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ActivityIndicator style={s.state} />
            ) : error ? (
              <Text style={s.state}>{error}</Text>
            ) : results.length === 0 ? (
              <Text style={s.state}>
                {searched ? "查不到符合的基金，換個關鍵字試試" : "輸入名稱後按搜尋"}
              </Text>
            ) : (
              results.map((fund) => (
                <Pressable
                  key={`${fund.source}:${fund.code}`}
                  onPress={() => onSelect(fund)}
                  style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={s.rowName}>{fund.name}</Text>
                  <Text style={s.rowMeta}>
                    {fund.source === "onshore" ? "境內" : "境外"} · {fund.currency} · {fund.code}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={s.cancel}>
            <Text style={s.cancelLabel}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "85%",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#1c1c1e" },
  subtitle: { fontSize: 13, color: "#8e8e93", marginTop: 6, lineHeight: 18 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f2f2f7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  input: { flex: 1, fontSize: 15, color: "#1c1c1e", paddingVertical: 4 },
  searchBtn: {
    backgroundColor: "#374254",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchBtnLabel: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  list: { marginTop: 12, flexGrow: 0 },
  state: { textAlign: "center", color: "#8e8e93", fontSize: 14, paddingVertical: 24 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  rowName: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  rowMeta: { fontSize: 12, color: "#8e8e93", marginTop: 4 },
  cancel: { alignItems: "center", paddingVertical: 16 },
  cancelLabel: { fontSize: 15, fontWeight: "600", color: "#8e8e93" },
});
