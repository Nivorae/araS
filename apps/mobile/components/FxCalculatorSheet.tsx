import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { BottomSheet } from "@/components/BottomSheet";
import { useApi } from "@/lib/api";
import { calculatorCurrencies, fetchTwdRate } from "@/lib/fx";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";

const GRID_COLUMNS = 4;
const GRID_GAP = 8;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 這檔股票的報價幣別，例如 "GBP"。 */
  quoteCurrency: string;
  /** 表單已經抓到的報價幣別匯率；沒有就是 null，打開時自己抓。 */
  quoteFxRate: number | null;
  onApply: (twdAmount: number) => void;
}

/**
 * 換匯計算機。App 只記台幣成本，用美元或當地貨幣付款的人在這裡換算成台幣
 * 再帶回「投入金額」。輸入的外幣金額與匯率都不保存。
 */
export function FxCalculatorSheet({
  visible,
  onClose,
  quoteCurrency,
  quoteFxRate,
  onApply,
}: Props) {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const { isTablet } = useResponsive();
  const bottomPad = useSheetBottomPadding();

  const [currency, setCurrency] = useState(quoteCurrency);
  const [amountStr, setAmountStr] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateFailed, setRateFailed] = useState(false);

  const options = calculatorCurrencies(quoteCurrency);
  const selected = options.find((c) => c.code === currency) ?? options[0]!;
  // 幣別格子平常收起來，畫面上只看得到目前選的那一個。
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth =
    gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS) : 0;

  // 每次打開都從報價幣別、空白金額開始。
  useEffect(() => {
    if (!visible) return;
    setCurrency(quoteCurrency);
    setAmountStr("");
    setPickerOpen(false);
  }, [visible, quoteCurrency]);

  // 帶入所選幣別的即時匯率。切換幣別會蓋掉手動改過的匯率（換了幣別，舊匯率
  // 本來就不適用）。抓不到就留空讓使用者自己填，絕不退回 1。
  useEffect(() => {
    if (!visible) return;
    if (currency === quoteCurrency && quoteFxRate != null && quoteFxRate > 0) {
      setRateStr(String(quoteFxRate));
      setRateFailed(false);
      setRateLoading(false);
      return;
    }
    let active = true;
    setRateStr("");
    setRateFailed(false);
    setRateLoading(true);
    fetchTwdRate(apiRef.current.rawGet, currency).then((rate) => {
      if (!active) return;
      setRateLoading(false);
      if (rate == null) setRateFailed(true);
      else setRateStr(String(rate));
    });
    return () => {
      active = false;
    };
  }, [visible, currency, quoteCurrency, quoteFxRate]);

  const amount = parseFloat(amountStr);
  const rate = parseFloat(rateStr);
  const valid = amount > 0 && rate > 0;
  const twd = valid ? Math.round(amount * rate) : null;

  const handleApply = () => {
    if (twd == null) return;
    onApply(twd);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[s.sheet, isTablet && s.sheetTablet]}
    >
      <View style={s.handle} />
      <Text style={s.title}>換算成台幣</Text>

      <View style={s.body}>
        <Text style={[s.label, s.labelFirst]}>外幣金額</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, s.flex]}
            value={amountStr}
            onChangeText={setAmountStr}
            onFocus={() => setPickerOpen(false)}
            placeholder="0"
            placeholderTextColor="#c7c7cc"
            keyboardType="decimal-pad"
            autoFocus
          />
          <Pressable
            onPress={() => {
              // 收起鍵盤，整片幣別格子才看得到。
              Keyboard.dismiss();
              setPickerOpen((o) => !o);
            }}
            style={[s.currencyBtn, pickerOpen && s.currencyBtnOpen]}
            accessibilityLabel={`付款幣別：${selected.name}，點擊更換`}
          >
            <Text style={s.currencyCode}>{selected.code}</Text>
            {selected.name !== selected.code && <Text style={s.currencyName}>{selected.name}</Text>}
            {pickerOpen ? (
              <ChevronUp size={14} color="#8e8e93" />
            ) : (
              <ChevronDown size={14} color="#8e8e93" />
            )}
          </Pressable>
        </View>

        {pickerOpen && (
          <View style={s.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {cellWidth > 0 &&
              options.map((c) => {
                const active = c.code === currency;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCurrency(c.code);
                      setPickerOpen(false);
                    }}
                    style={[s.cell, { width: cellWidth }, active && s.cellActive]}
                  >
                    <Text style={[s.cellCode, active && s.cellTextActive]}>{c.code}</Text>
                    <Text style={[s.cellName, active && s.cellTextActive]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        )}

        <Text style={s.label}>匯率（1 {currency} = ? TWD）</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, s.flex]}
            value={rateStr}
            onChangeText={(v) => {
              setRateStr(v);
              setRateFailed(false);
            }}
            placeholder="請輸入匯率"
            placeholderTextColor="#c7c7cc"
            keyboardType="decimal-pad"
            editable={!rateLoading}
          />
          {rateLoading && <ActivityIndicator size="small" color="#8e8e93" />}
        </View>
        <Text style={s.hint}>
          {rateFailed ? "抓不到即時匯率，請手動輸入" : "即時匯率，可改成實際成交匯率"}
        </Text>

        <View style={s.result}>
          <Text style={s.resultText}>= NT$ {twd != null ? twd.toLocaleString() : "--"}</Text>
        </View>
      </View>

      <View style={[s.actions, { paddingBottom: bottomPad }]}>
        <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
          <Text style={s.btnGhostText}>取消</Text>
        </Pressable>
        <Pressable
          onPress={handleApply}
          disabled={!valid}
          style={[s.btn, s.btnPrimary, !valid && s.btnDisabled]}
        >
          <Text style={s.btnPrimaryText}>帶入</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  sheetTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
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
  body: { paddingHorizontal: 20 },
  label: { fontSize: 13, color: "#8e8e93", marginBottom: 6, marginTop: 14 },
  labelFirst: { marginTop: 0 },
  currencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f2f2f7",
  },
  currencyBtnOpen: { backgroundColor: "#e5e5ea" },
  currencyCode: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  currencyName: { fontSize: 13, color: "#8e8e93" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginTop: 10 },
  cell: {
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f2f2f7",
  },
  cellActive: { backgroundColor: "#66788E" },
  cellCode: { fontSize: 14, fontWeight: "600", color: "#1c1c1e" },
  cellName: { fontSize: 11, color: "#8e8e93", marginTop: 2 },
  cellTextActive: { color: "#fff" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1c1c1e",
  },
  hint: { fontSize: 12, color: "#8e8e93", marginTop: 4 },
  result: { backgroundColor: "#f2f2f7", borderRadius: 12, padding: 14, marginTop: 18 },
  resultText: { fontSize: 20, fontWeight: "700", color: "#1c1c1e", textAlign: "right" },
  actions: { flexDirection: "row", gap: 12, padding: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "#f2f2f7" },
  btnGhostText: { fontSize: 15, color: "#1c1c1e" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
