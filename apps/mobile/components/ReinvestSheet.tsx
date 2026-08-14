import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useIsPremium } from "@/hooks/useIsPremium";
import { buildYfSymbol } from "@/lib/stockConstants";

interface ReinvestSheetProps {
  visible: boolean;
  dividendId: string;
  dividendAmount: number;
  entryName: string;
  subCategory: string;
  stockCode: string;
  bankName: string | null;
  onClose: () => void;
  onDone: () => void;
}

export default function ReinvestSheet({
  visible,
  dividendId,
  dividendAmount,
  entryName,
  subCategory,
  stockCode,
  bankName,
  onClose,
  onDone,
}: ReinvestSheetProps) {
  const api = useApi();
  const router = useRouter();
  const { reinvestDividend, fetchAll } = useFinanceActions();
  const { isPremium, loading: premiumLoading } = useIsPremium();

  const [amountStr, setAmountStr] = useState(String(dividendAmount));
  const [priceStr, setPriceStr] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CONTROLLER RULING R24 — `setPriceStr("")` added to this reset. The original
  // plan reset only the amount and the error, leaving a previously fetched price in
  // the field. Task 13 mounts this sheet conditionally so it usually unmounts
  // between uses, but the reset must not DEPEND on that: if the sheet is ever
  // reused while mounted, or the price fetch fails on the second open, a stale
  // price from another holding would be used to derive the share count.
  useEffect(() => {
    if (!visible) return;
    setAmountStr(String(dividendAmount));
    setPriceStr("");
    setError(null);
  }, [visible, dividendAmount, stockCode]);

  // 現價只是預填。台股報價本來就會有抓不到的情況 —— 那時把價格欄留空讓使用者
  // 手填，而不是讓整個再投資失敗。
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setPriceLoading(true);
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        // CONTROLLER RULING R10 — `api.rawGet`, NOT `api.get`. `/api/stocks/*`
        // returns raw JSON, not the `{success,data}` envelope; `api.get` parses the
        // envelope and throws when `body.success` is falsy, so it would fail every
        // time. `rawGet` (apps/mobile/lib/api.ts:100) is what EntryForm and
        // useInvestmentMarketValues already use against this exact endpoint. The
        // response field IS `price` — verified in apps/web/app/api/stocks/price/route.ts.
        const r = await api.rawGet<{ price: number }>(
          `/api/stocks/price?symbol=${encodeURIComponent(symbol)}`
        );
        if (active && typeof r?.price === "number") setPriceStr(String(r.price));
      } catch {
        // 留空，使用者手填。
      } finally {
        if (active) setPriceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, subCategory, stockCode, api]);

  const amount = parseFloat(amountStr) || 0;
  const price = parseFloat(priceStr) || 0;
  const units = useMemo(() => (price > 0 ? amount / price : 0), [amount, price]);

  const handleSubmit = async () => {
    if (amount <= 0) return setError("請輸入大於 0 的再投資金額");
    if (amount > dividendAmount) return setError("再投資金額不可超過股利金額");
    if (price <= 0) return setError("請輸入價格（抓不到現價時可手動填入）");
    if (!premiumLoading && !isPremium) {
      Alert.alert("股息紀錄是 Premium 功能", "升級 Premium 即可一鍵再投資。", [
        { text: "稍後再決定", style: "cancel" },
        { text: "解鎖 Premium", onPress: () => router.push("/paywall") },
      ]);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await reinvestDividend(dividendId, { amount, price });
      await fetchAll();
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "再投資失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>再投資 · {entryName}</Text>

          <View style={s.body}>
            <Text style={s.label}>再投資金額（TWD）</Text>
            <TextInput
              style={s.input}
              value={amountStr}
              onChangeText={(v) => {
                setAmountStr(v);
                setError(null);
              }}
              keyboardType="decimal-pad"
            />

            <Text style={s.label}>買入價格{priceLoading ? "（讀取現價中…）" : ""}</Text>
            <TextInput
              style={s.input}
              value={priceStr}
              onChangeText={(v) => {
                setPriceStr(v);
                setError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="抓不到現價時請手動填入"
            />

            <View style={s.summary}>
              {bankName ? (
                <Text style={s.summaryLine}>
                  {bankName}
                  {"　"}−NT$ {amount.toLocaleString()}
                </Text>
              ) : (
                <Text style={s.summaryMuted}>這筆股利未記錄入帳帳戶，不會扣款</Text>
              )}
              <Text style={s.summaryLine}>
                {entryName}
                {"　"}+NT$ {amount.toLocaleString()}
              </Text>
              <Text style={s.summaryLine}>
                增加{"　"}
                {units > 0 ? units.toFixed(4) : "—"} 股
              </Text>
            </View>

            {error && <Text style={s.error}>{error}</Text>}
          </View>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
            >
              <Text style={s.btnPrimaryText}>{submitting ? "處理中…" : "確認再投資"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
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
  label: { fontSize: 13, color: "#8e8e93", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1c1c1e",
  },
  summary: { backgroundColor: "#f2f2f7", borderRadius: 12, padding: 14, marginTop: 18, gap: 6 },
  summaryLine: { fontSize: 14, color: "#1c1c1e" },
  summaryMuted: { fontSize: 13, color: "#8e8e93" },
  error: { color: "#d93025", fontSize: 13, marginTop: 12 },
  actions: { flexDirection: "row", gap: 12, padding: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "#f2f2f7" },
  btnGhostText: { fontSize: 15, color: "#1c1c1e" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
