import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useIsPremium } from "@/hooks/useIsPremium";
import { buildYfSymbol } from "@/lib/stockConstants";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";

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
  const { isTablet } = useResponsive();
  const bottomPad = useSheetBottomPadding();
  const api = useApi();
  const router = useRouter();
  const { reinvestDividend, fetchAll } = useFinanceActions();
  const { isPremium, loading: premiumLoading } = useIsPremium();

  const [amountStr, setAmountStr] = useState(String(dividendAmount));
  const [priceStr, setPriceStr] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [currency, setCurrency] = useState("TWD");
  // FIX FOR FINDING 1 — mirrors DividendForm.tsx's fxLoading: true while the
  // price + FX quote are in flight for a non-TWD holding, gating submission so
  // a user can't confirm against a foreign-currency price that hasn't been
  // converted to TWD yet.
  const [fxLoading, setFxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTWD = subCategory === "台股";

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
    setCurrency("TWD");
    setError(null);
  }, [visible, dividendAmount, stockCode]);

  // 現價只是預填。台股報價本來就會有抓不到的情況 —— 那時把價格欄留空讓使用者
  // 手填，而不是讓整個再投資失敗。
  //
  // FIX FOR FINDING 1 — the sheet used to prefill `priceStr` from the raw
  // quote `price` regardless of `currency`. The backend computes
  // `units = amount / price` (dividends.service.ts `reinvest()`) against an
  // `amount` that is always TWD, so for any non-台股 holding (美股/加密貨幣/
  // 貴金屬) that wrote a foreign-currency price paired with a TWD amount —
  // inflating the derived units by roughly the FX rate and permanently
  // writing the wrong share count to EntryHistory.units. Mirrors
  // DividendForm.tsx's fx effect: fetch `{price, currency}`, and when
  // `currency !== "TWD"`, fetch `${currency}TWD=X` and convert before
  // prefilling. On fetch/FX failure, fall back to leaving the field for
  // manual entry rather than blocking forever (fxLoading always clears in
  // `finally`).
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setPriceLoading(true);
    // 台股沒有幣別換算，維持原本行為：不設 fxLoading，不擋送出。
    if (!isTWD) setFxLoading(true);
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
        const r = await api.rawGet<{ price: number; currency: string }>(
          `/api/stocks/price?symbol=${encodeURIComponent(symbol)}`
        );
        if (!active || typeof r?.price !== "number") return;
        const cur = r.currency ?? "TWD";
        if (active) setCurrency(cur);
        if (isTWD || cur === "TWD") {
          setPriceStr(String(r.price));
          return;
        }
        const fx = await api.rawGet<{ price: number }>(
          `/api/stocks/price?symbol=${encodeURIComponent(`${cur}TWD=X`)}`
        );
        if (active && typeof fx?.price === "number" && fx.price > 0) {
          setPriceStr(String(r.price * fx.price));
        }
        // 抓不到匯率就留空讓使用者手填 —— 手填的是 TWD 價格，見下方幣別提示。
      } catch {
        // 留空，使用者手填。
      } finally {
        if (active) {
          setPriceLoading(false);
          setFxLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, subCategory, stockCode, api, isTWD]);

  const amount = parseFloat(amountStr) || 0;
  const price = parseFloat(priceStr) || 0;
  const units = useMemo(() => (price > 0 ? amount / price : 0), [amount, price]);

  const handleSubmit = async () => {
    // FIX FOR FINDING 1 — block submission while the FX quote is still in
    // flight for a non-台股 holding, matching DividendForm.tsx's fxLoading
    // gate, so a prefilled-but-unconverted foreign price can never be sent.
    if (fxLoading) return setError("匯率讀取中，請稍候");
    if (amount <= 0) return setError("請輸入大於 0 的再投資金額");
    if (amount > dividendAmount) return setError("再投資金額不可超過股利金額");
    if (price <= 0) return setError("請輸入價格（抓不到現價時可手動填入）");
    if (!premiumLoading && !isPremium) {
      Alert.alert("股息紀錄是 Premium 功能", "升級 Premium 即可一鍵再投資。", [
        { text: "稍後再決定", style: "cancel" },
        {
          text: "解鎖 Premium",
          onPress: () => {
            // Same fix as DividendForm.tsx — this sheet is a native <Modal>
            // rendered above the navigator, so it must close before pushing
            // /paywall or it stays visible in front of that screen.
            onClose();
            router.push("/paywall");
          },
        },
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

  // 送出期間鎖住關閉：原本 backdrop 點擊與 Android 返回鍵在 submitting 時仍可
  // 關閉 Sheet，使用者容易在等待 API 回應時誤觸關掉，看不到任何處理中的回饋。
  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable style={[s.sheet, isTablet && s.sheetTablet]} onPress={() => {}}>
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

            <Text style={s.label}>
              買入價格{!isTWD ? `（${currency}）` : ""}
              {priceLoading ? "（讀取現價中…）" : ""}
            </Text>
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
            {/* FIX FOR FINDING 1 — surface the in-flight FX fetch, same as
                DividendForm.tsx, so the user knows why 確認再投資 is disabled. */}
            {!isTWD && fxLoading && <Text style={s.fxHint}>正在讀取匯率…</Text>}

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
                {units > 0 ? units.toFixed(2) : "—"} 股
              </Text>
            </View>

            {error && <Text style={s.error}>{error}</Text>}
          </View>

          <View style={[s.actions, { paddingBottom: bottomPad }]}>
            <Pressable
              onPress={handleClose}
              disabled={submitting}
              style={[s.btn, s.btnGhost, submitting && s.btnDisabled]}
            >
              <Text style={s.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || fxLoading}
              style={[s.btn, s.btnPrimary, (submitting || fxLoading) && s.btnDisabled]}
            >
              <Text style={s.btnPrimaryText}>
                {submitting ? "處理中…" : fxLoading ? "匯率讀取中…" : "確認再投資"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  // A full-bleed bottom sheet becomes a 1024pt-wide slab on an iPad; capping
  // and centring it keeps it sheet-shaped.
  sheetTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
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
  fxHint: { fontSize: 12, color: "#8e8e93", marginTop: 4 },
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
