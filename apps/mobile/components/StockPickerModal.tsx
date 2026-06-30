import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Search } from "lucide-react-native";
import { useApi } from "@/lib/api";
import { PRECIOUS_METALS, type StockItem } from "@/lib/stockConstants";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (stock: StockItem) => void;
  subCategory: string;
  existingHoldings?: StockItem[];
}

export function StockPickerModal({
  visible,
  onClose,
  onSelect,
  subCategory,
  existingHoldings = [],
}: Props) {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) {
      setSearch("");
      return;
    }
    setLoading(true);
    setStocks([]);

    const load = async () => {
      try {
        if (subCategory === "台股") {
          const data = await apiRef.current.rawGet<Record<string, string>[]>("/api/stocks/tw");
          setStocks(
            data
              .map((item) => ({
                code: item["公司代號"] ?? "",
                name: item["公司簡稱"] ?? item["公司名稱"] ?? "",
              }))
              .filter((s) => s.code && s.name)
          );
        } else if (subCategory === "美股") {
          const data = await apiRef.current.rawGet<StockItem[]>("/api/stocks/us");
          setStocks(data);
        } else if (subCategory === "加密貨幣") {
          const data = await apiRef.current.rawGet<StockItem[]>("/api/stocks/crypto");
          setStocks(data);
        } else if (subCategory === "貴金屬") {
          setStocks(PRECIOUS_METALS);
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [visible, subCategory]);

  const q = search.trim().toLowerCase();

  const filteredHoldings = useMemo(
    () =>
      q
        ? existingHoldings.filter(
            (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
          )
        : existingHoldings,
    [existingHoldings, q]
  );

  const filteredStocks = useMemo(
    () =>
      q
        ? stocks.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
        : stocks,
    [stocks, q]
  );

  const handleSelect = (stock: StockItem) => {
    onSelect(stock);
    onClose();
  };

  const renderItem = ({ item }: { item: StockItem }) => (
    <TouchableOpacity onPress={() => handleSelect(item)} style={s.item} activeOpacity={0.7}>
      <Text style={s.code}>{item.code}</Text>
      <Text style={s.stockName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const hasHoldings = filteredHoldings.length > 0 && !q;

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
          <Text style={s.title}>選擇股票</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.searchBox}>
          <Search size={16} color="#8e8e93" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="搜尋代碼或名稱"
            placeholderTextColor="#c7c7cc"
            autoCapitalize="none"
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#374254" />
            <Text style={s.loadingText}>載入中…</Text>
          </View>
        ) : (
          <FlatList
            data={filteredStocks}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            ListHeaderComponent={
              hasHoldings ? (
                <View>
                  <Text style={s.sectionLabel}>已持有</Text>
                  {filteredHoldings.map((h) => (
                    <TouchableOpacity
                      key={h.code}
                      onPress={() => handleSelect(h)}
                      style={[s.item, s.holdingItem]}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.code, { color: "#374254" }]}>{h.code}</Text>
                      <Text style={s.stockName} numberOfLines={1}>
                        {h.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {filteredStocks.length > 0 && <Text style={s.sectionLabel}>全部</Text>}
                </View>
              ) : null
            }
            ItemSeparatorComponent={() => <View style={s.div} />}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading ? (
                <View style={s.center}>
                  <Text style={s.emptyText}>{q ? "找不到符合的股票" : "暫無資料"}</Text>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#1c1c1e" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8e8e93",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#f2f2f7",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    gap: 12,
  },
  holdingItem: { backgroundColor: "#f8f8fa" },
  code: { fontSize: 15, fontWeight: "700", color: "#1c1c1e", minWidth: 64 },
  stockName: { flex: 1, fontSize: 14, color: "#8e8e93" },
  div: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#8e8e93" },
  emptyText: { fontSize: 14, color: "#8e8e93" },
});
