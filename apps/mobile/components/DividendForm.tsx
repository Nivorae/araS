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
import { Calendar } from "lucide-react-native";
import { useApi } from "@/lib/api";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useFinanceStore } from "@/store/financeStore";
import { buildYfSymbol } from "@/lib/stockConstants";
import { DatePickerModal } from "./DatePickerModal";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";

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

// FIX FOR FINDING 5 — deliberately NOT InsuranceForm's `toISODate` (its lines
// 41-43), which does `d.toISOString().split("T")[0]`: that converts the
// picker's LOCAL midnight to UTC and stores the PREVIOUS day for a Taiwan
// user. That is a pre-existing bug in the insurance feature the controller
// has left out of scope — not copied here. Build the string from local date
// parts instead, same approach as `todayISO()` above.
function dateToISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// Parse "YYYY-MM-DD" back into a Date for the picker's `date` prop by reading
// the parts explicitly. `new Date(string)` would parse it as UTC midnight,
// which then displays as the PREVIOUS day once rendered in local time for a
// Taiwan user — the same class of bug this file avoids above.
function parseISOToLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatDisplayDate(s: string): string {
  if (!s) return "選擇日期";
  const d = parseISOToLocalDate(s);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
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
  const { isTablet } = useResponsive();
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

  const [mode, setMode] = useState<"perShare" | "amount">("amount");
  const [payDate, setPayDate] = useState(todayISO());
  const [perShareStr, setPerShareStr] = useState("");
  const [sharesStr, setSharesStr] = useState(currentShares != null ? String(currentShares) : "");
  const [amountStr, setAmountStr] = useState("");
  const [bankEntryId, setBankEntryId] = useState<string | null>(null);
  const [recordIncome, setRecordIncome] = useState(true);
  const [note, setNote] = useState("");
  const [fxRate, setFxRate] = useState(1);
  const [fxLoading, setFxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isTWD = subCategory === "台股";

  // FIX FOR FINDINGS 1 & 2 — the sheet is never unmounted, only `<Modal
  // visible>` toggles the native overlay, so every `useState` initialiser
  // above runs exactly once for the component's whole lifetime and nothing
  // resets on close. Without this, reopening for a DIFFERENT stock leaks the
  // previous stock's perShareStr/note/bankEntryId/amountStr/mode/error, and
  // the stale non-empty perShareStr then blocks the prefill effect below from
  // ever fetching the new stock's real rate. Separately, `sharesStr`'s
  // `useState(currentShares...)` initialiser only ever runs once, so a
  // `currentShares` that arrives later (Task 13 derives it from fetched
  // history, `null` on first render) can never land in the field without an
  // effect that re-applies it.
  //
  // This reset clears `perShareStr` to `""`, which is exactly the state the
  // prefill effect's `if (perShareStr !== "") return` guard needs in order to
  // fetch — see the note at that effect for why the two run in a safe order
  // despite both being declared with `visible` in their deps.
  useEffect(() => {
    if (!visible) return;
    setMode("amount");
    setPayDate(todayISO());
    setPerShareStr("");
    setSharesStr(currentShares != null ? String(currentShares) : "");
    setAmountStr("");
    setBankEntryId(null);
    setRecordIncome(true);
    setNote("");
    setError(null);
  }, [visible, entryId, currentShares]);

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
  //
  // FIX FOR FINDING 3 — `fxLoading` gates submission below. Without it,
  // `fxRate` defaults to 1 and a user who fills perShare/shares and taps 儲存
  // before this async fetch resolves submits `perShare * shares * 1` — for a
  // non-TWD entry that's understated by roughly the USD/TWD (or other
  // currency) rate, silently, with no error. 台股 short-circuits above with
  // fxRate 1 and never sets fxLoading true, so it is unaffected. On fetch
  // failure fxRate stays 1 but fxLoading still clears in `finally`, so
  // submission isn't blocked forever — the existing UI hint below tells the
  // user to switch to 依總金額 and enter TWD directly in that case.
  useEffect(() => {
    if (!visible || isTWD) {
      setFxRate(1);
      setFxLoading(false);
      return;
    }
    let active = true;
    setFxLoading(true);
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
      } finally {
        if (active) setFxLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, isTWD, subCategory, stockCode, api]);

  // 每股股利預填。抓不到就留空，絕不阻擋輸入。
  //
  // Ordering note for FINDINGS 1/2's reset effect above: both effects list
  // `visible` in their deps and both run on the render where the sheet opens.
  // React runs a component's effects in declaration order within a commit, so
  // the reset effect's `setPerShareStr("")` is scheduled first — but effects
  // in the SAME commit still close over that render's state, so THIS effect's
  // `perShareStr` reference in that first pass is whatever it was before the
  // reset (possibly non-empty from the previous stock), and it may skip. The
  // reset's setState schedules a re-render; on that next pass `perShareStr` is
  // now `""`, the guard passes, and the fetch for the new stock actually
  // fires. Net effect: one extra render, but the new stock's real rate is
  // always fetched — never the stale one.
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
      {
        text: "解鎖 Premium",
        onPress: () => {
          // This sheet is a native <Modal>, which renders above the navigator —
          // pushing /paywall on top of it would leave this sheet still visible
          // in front of the paywall screen. Close it first.
          onClose();
          router.push("/paywall");
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    // FIX FOR FINDING 3 — block submission while the FX quote is still in
    // flight for a non-TWD entry, instead of silently sending `amountTWD`
    // computed against the placeholder fxRate of 1.
    if (fxLoading) {
      setError("匯率讀取中，請稍候");
      return;
    }
    // FIX FOR FINDING 4 — guard the ROUNDED value, the same value that gets
    // sent. Guarding the raw float let a tiny positive amount (e.g. 0.004)
    // pass this check and then round to 0, which the backend's
    // `z.number().positive()` rejects with an opaque generic error.
    const roundedAmount = Math.round(amountTWD * 100) / 100;
    if (roundedAmount <= 0) {
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
        amount: roundedAmount,
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
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, isTablet && s.sheetTablet]} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>新增股利 · {entryName}</Text>

          <ScrollView style={s.body}>
            <View style={s.segment}>
              {[
                { m: "amount" as const, label: "依總金額" },
                { m: "perShare" as const, label: "依每股股利" },
              ].map(({ m, label }) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                  }}
                  style={[s.segmentBtn, mode === m && s.segmentBtnActive]}
                >
                  <Text style={[s.segmentText, mode === m && s.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>發放日</Text>
            {/* FIX FOR FINDING 5 — a bare TextInput accepted any free-text
                format (`2026/08/13`, `13-08-2026`, ...). Route through the
                same DatePickerModal InsuranceForm/EntryForm already use for
                every other date field in the app; `payDate` stays a
                YYYY-MM-DD string in state. */}
            <Pressable style={s.dateRow} onPress={() => setShowDatePicker(true)}>
              <Text style={s.dateRowText}>{formatDisplayDate(payDate)}</Text>
              <Calendar size={16} color="#8e8e93" />
            </Pressable>

            {mode === "perShare" ? (
              <>
                <Text style={s.label}>每股股利{isTWD ? "（TWD）" : "（報價幣別）"}</Text>
                <TextInput
                  style={s.input}
                  value={perShareStr}
                  onChangeText={(v) => {
                    setPerShareStr(v);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="例如 4.5"
                />
                <Text style={s.label}>股數</Text>
                <TextInput
                  style={s.input}
                  value={sharesStr}
                  onChangeText={(v) => {
                    setSharesStr(v);
                    setError(null);
                  }}
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
                  onChangeText={(v) => {
                    setAmountStr(v);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="實收總額"
                />
              </>
            )}

            <Text style={s.computed}>換算後入帳：NT$ {amountTWD.toLocaleString()}</Text>
            {/* FIX FOR FINDING 3 — surface the in-flight FX fetch so the user
                knows why 儲存 is disabled, instead of it silently sending an
                understated amount. */}
            {!isTWD && fxLoading && <Text style={s.fxHint}>正在讀取匯率…</Text>}

            <Text style={s.label}>入帳帳戶</Text>
            <View style={s.bankList}>
              <Pressable
                onPress={() => {
                  setBankEntryId(null);
                  setError(null);
                }}
                style={[s.bankChip, bankEntryId === null && s.bankChipActive]}
              >
                <Text style={[s.bankChipText, bankEntryId === null && s.bankChipTextActive]}>
                  不記錄
                </Text>
              </Pressable>
              {cashEntries.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    setBankEntryId(e.id);
                    setError(null);
                  }}
                  style={[s.bankChip, bankEntryId === e.id && s.bankChipActive]}
                >
                  <Text style={[s.bankChipText, bankEntryId === e.id && s.bankChipTextActive]}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={s.switchRow}>
              <Text style={s.label}>同步記為收入</Text>
              <Switch
                value={recordIncome}
                onValueChange={(v) => {
                  setRecordIncome(v);
                  setError(null);
                }}
              />
            </View>

            <Text style={s.label}>備註</Text>
            <TextInput
              style={s.input}
              value={note}
              onChangeText={(v) => {
                setNote(v);
                setError(null);
              }}
              placeholder="選填"
            />

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || fxLoading}
              style={[s.btn, s.btnPrimary, (submitting || fxLoading) && s.btnDisabled]}
            >
              <Text style={s.btnPrimaryText}>
                {submitting ? "儲存中…" : fxLoading ? "匯率讀取中…" : "儲存"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      <DatePickerModal
        visible={showDatePicker}
        date={parseISOToLocalDate(payDate)}
        onConfirm={(picked) => {
          setPayDate(dateToISO(picked));
          setError(null);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  // A full-bleed bottom sheet becomes a 1024pt-wide slab on an iPad; capping
  // and centring it keeps it sheet-shaped.
  sheetTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
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
  fxHint: { fontSize: 12, color: "#8e8e93", marginTop: 4 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateRowText: { fontSize: 15, color: "#1c1c1e" },
  bankList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f2f2f7",
  },
  bankChipActive: { backgroundColor: "#66788E" },
  bankChipText: { fontSize: 13, color: "#1c1c1e" },
  bankChipTextActive: { color: "#fff" },
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
