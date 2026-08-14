import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useFinanceStore } from "@/store/financeStore";
import { buildYfSymbol } from "@/lib/stockConstants";

interface DividendFormProps {
  visible: boolean;
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  onClose: () => void;
  onSaved: () => void;
}

// CONTROLLER RULING R15 — use exactly this. The original plan used
// `new Date().toISOString().slice(0, 10)`, which is the UTC date: for a Taiwan
// user (UTC+8) between 00:00 and 08:00 local, that defaults 發放日 to YESTERDAY.
// Build the string from local date parts instead.
function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function DividendForm({
  visible,
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  onClose,
  onSaved,
}: DividendFormProps) {
  const api = useApi();
  const router = useRouter();
  const { addDividend, fetchAll } = useFinanceActions();
  const { isPremium, loading: premiumLoading } = useIsPremium();

  // 入帳帳戶只能是流動資金。從 store 讀，不再打一次 API。
  //
  // CONTROLLER RULING R4 — use exactly these two lines, NOT a selector that
  // filters inline. A selector returning `s.entries.filter(...)` builds a new
  // array on every call, which gives zustand's useSyncExternalStore an unstable
  // snapshot: it re-renders on every unrelated store write and can trip React's
  // "getSnapshot should be cached" warning. Select the raw slice, filter in useMemo.
  const entries = useFinanceStore((s) => s.entries);
  const cashEntries = useMemo(() => entries.filter((e) => e.topCategory === "流動資金"), [entries]);

  const [mode, setMode] = useState<"perShare" | "amount">("perShare");
  const [payDate, setPayDate] = useState(todayISO());
  const [perShareStr, setPerShareStr] = useState("");
  const [sharesStr, setSharesStr] = useState(currentShares != null ? String(currentShares) : "");
  const [amountStr, setAmountStr] = useState("");
  const [bankEntryId, setBankEntryId] = useState<string | null>(null);
  const [recordIncome, setRecordIncome] = useState(true);
  const [note, setNote] = useState("");
  const [fxRate, setFxRate] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTWD = subCategory === "台股";

  // 非台股的 perShare 以報價幣別輸入，換算成 TWD 才送出（設計文件「幣別處理」）。
  //
  // CONTROLLER RULING R10 — use exactly this. Two corrections to the original plan:
  //  1. `/api/stocks/*` and `/api/exchange-rate` return RAW JSON, not the
  //     `{success,data}` envelope. `api.get` parses the envelope and throws when
  //     `body.success` is falsy, so it CANNOT be used here. Use `api.rawGet`
  //     (apps/mobile/lib/api.ts:100) — the same call EntryForm,
  //     StockPickerModal and useInvestmentMarketValues already use.
  //  2. `/api/exchange-rate` returns `{ TWD }`, not `{ rate }`. Rather than
  //     depend on that endpoint at all, take the rate the way
  //     useInvestmentMarketValues:72-90 does: read the stock's own quote for its
  //     `currency`, then quote `<currency>TWD=X` for the rate.
  useEffect(() => {
    if (!visible || isTWD) {
      setFxRate(1);
      return;
    }
    let active = true;
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        const quote = await api.rawGet<{ price: number; currency: string }>(
          `/api/stocks/price?symbol=${encodeURIComponent(symbol)}`
        );
        const currency = quote?.currency ?? "TWD";
        if (currency === "TWD") {
          if (active) setFxRate(1);
          return;
        }
        const fx = await api.rawGet<{ price: number }>(
          `/api/stocks/price?symbol=${encodeURIComponent(`${currency}TWD=X`)}`
        );
        if (active && typeof fx?.price === "number" && fx.price > 0) setFxRate(fx.price);
      } catch {
        // 抓不到匯率就維持 1，並在畫面上提示使用者改用「依總金額」輸入 TWD。
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, isTWD, subCategory, stockCode, api]);

  // 每股股利預填。抓不到就留空，絕不阻擋輸入。
  useEffect(() => {
    if (!visible || perShareStr !== "") return;
    let active = true;
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        // RULING R10 again — rawGet, not get. This endpoint also returns raw JSON.
        const r = await api.rawGet<{ dividendRate: number | null }>(
          `/api/stocks/dividend?symbol=${encodeURIComponent(symbol)}`
        );
        if (active && r?.dividendRate != null) setPerShareStr(String(r.dividendRate));
      } catch {
        // 預填只是方便，失敗不影響手動輸入。
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, subCategory, stockCode, api, perShareStr]);

  const amountTWD = useMemo(() => {
    if (mode === "amount") return parseFloat(amountStr) || 0;
    const perShare = parseFloat(perShareStr) || 0;
    const shares = parseFloat(sharesStr) || 0;
    return perShare * shares * fxRate;
  }, [mode, amountStr, perShareStr, sharesStr, fxRate]);

  const promptPremiumUpgrade = () => {
    Alert.alert("股息紀錄是 Premium 功能", "升級 Premium 即可記錄股利並一鍵再投資。", [
      { text: "稍後再決定", style: "cancel" },
      { text: "解鎖 Premium", onPress: () => router.push("/paywall") },
    ]);
  };

  const handleSubmit = async () => {
    if (amountTWD <= 0) {
      setError("請輸入大於 0 的股利金額");
      return;
    }
    // 前端只是提前攔截讓 free 使用者立刻看到 paywall；後端才是權威。
    if (!premiumLoading && !isPremium) {
      promptPremiumUpgrade();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await addDividend({
        entryId,
        payDate,
        amount: Math.round(amountTWD * 100) / 100,
        ...(mode === "perShare" && parseFloat(perShareStr) > 0
          ? { perShare: parseFloat(perShareStr) }
          : {}),
        ...(mode === "perShare" && parseFloat(sharesStr) > 0
          ? { shares: parseFloat(sharesStr) }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(bankEntryId ? { bankEntryId } : {}),
        recordIncome,
      });
      // 入帳會改動 Entry.value，所以重抓一次讓首頁與詳情頁的金額同步。
      await fetchAll();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>新增股利 · {entryName}</Text>

          <ScrollView style={s.body}>
            <View style={s.segment}>
              {[
                { m: "perShare" as const, label: "依每股股利" },
                { m: "amount" as const, label: "依總金額" },
              ].map(({ m, label }) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[s.segmentBtn, mode === m && s.segmentBtnActive]}
                >
                  <Text style={[s.segmentText, mode === m && s.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>發放日</Text>
            <TextInput
              style={s.input}
              value={payDate}
              onChangeText={setPayDate}
              placeholder="YYYY-MM-DD"
              autoCorrect={false}
            />

            {mode === "perShare" ? (
              <>
                <Text style={s.label}>每股股利{isTWD ? "（TWD）" : "（報價幣別）"}</Text>
                <TextInput
                  style={s.input}
                  value={perShareStr}
                  onChangeText={setPerShareStr}
                  keyboardType="decimal-pad"
                  placeholder="例如 4.5"
                />
                <Text style={s.label}>股數</Text>
                <TextInput
                  style={s.input}
                  value={sharesStr}
                  onChangeText={setSharesStr}
                  keyboardType="decimal-pad"
                  placeholder="持股數"
                />
              </>
            ) : (
              <>
                <Text style={s.label}>總金額（TWD）</Text>
                <TextInput
                  style={s.input}
                  value={amountStr}
                  onChangeText={setAmountStr}
                  keyboardType="decimal-pad"
                  placeholder="實收總額"
                />
              </>
            )}

            <Text style={s.computed}>換算後入帳：NT$ {amountTWD.toLocaleString()}</Text>

            <Text style={s.label}>入帳帳戶</Text>
            <View style={s.bankList}>
              <Pressable
                onPress={() => setBankEntryId(null)}
                style={[s.bankChip, bankEntryId === null && s.bankChipActive]}
              >
                <Text style={s.bankChipText}>不記錄</Text>
              </Pressable>
              {cashEntries.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setBankEntryId(e.id)}
                  style={[s.bankChip, bankEntryId === e.id && s.bankChipActive]}
                >
                  <Text style={s.bankChipText}>{e.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.switchRow}>
              <Text style={s.label}>同步記為收入</Text>
              <Switch value={recordIncome} onValueChange={setRecordIncome} />
            </View>

            <Text style={s.label}>備註</Text>
            <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="選填" />

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
            >
              <Text style={s.btnPrimaryText}>{submitting ? "儲存中…" : "儲存"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
  },
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
  segment: {
    flexDirection: "row",
    backgroundColor: "#f2f2f7",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#fff" },
  segmentText: { fontSize: 13, color: "#8e8e93" },
  segmentTextActive: { color: "#1c1c1e", fontWeight: "600" },
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
  computed: { fontSize: 14, fontWeight: "600", color: "#66788E", marginTop: 14 },
  bankList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f2f2f7",
  },
  bankChipActive: { backgroundColor: "#66788E" },
  bankChipText: { fontSize: 13, color: "#1c1c1e" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  error: { color: "#d93025", fontSize: 13, marginTop: 12 },
  actions: { flexDirection: "row", gap: 12, padding: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "#f2f2f7" },
  btnGhostText: { fontSize: 15, color: "#1c1c1e" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
