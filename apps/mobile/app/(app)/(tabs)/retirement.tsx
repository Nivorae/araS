import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { useFinanceStore } from "@/store/financeStore";
import {
  DEFAULTS,
  STORAGE_KEY,
  fmtWan,
  sanitizeParams,
  type ModalContent,
  type Params,
} from "@/lib/retirement";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";
import { ProjectionChart, type ProjRow } from "@/components/retirement/ProjectionChart";
import { InfoModal } from "@/components/retirement/InfoModal";

const SCREEN_H = Dimensions.get("window").height;

// ── Small components ────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  color = "#1c1c1e",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  suffix,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
}) {
  const [str, setStr] = useState(String(value));
  useEffect(() => setStr(String(value)), [value]);

  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.inputRight}>
        {prefix && <Text style={s.affix}>{prefix}</Text>}
        <TextInput
          style={s.input}
          value={str}
          keyboardType="numeric"
          onChangeText={(t) => {
            setStr(t);
            const v = parseFloat(t);
            if (!isNaN(v)) onChange(v);
          }}
          onBlur={() => {
            if (isNaN(parseFloat(str))) setStr(String(value));
          }}
        />
        {suffix && <Text style={s.affix}>{suffix}</Text>}
      </View>
    </View>
  );
}

const PICKER_ROW_H = 48;

function NumberPickerInput({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min: number;
  max: number;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max]
  );

  return (
    <>
      <Pressable style={s.row} onPress={() => setOpen(true)}>
        <Text style={s.rowLabel}>{label}</Text>
        <View style={s.inputRight}>
          <Text style={s.input}>{value}</Text>
          {suffix && <Text style={s.affix}>{suffix}</Text>}
          <ChevronDown size={14} color="#c7c7cc" />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.pickerBackdrop} onPress={() => setOpen(false)} />
        <View style={s.pickerSheet}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={s.pickerDone}>完成</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(n) => String(n)}
            getItemLayout={(_, i) => ({ length: PICKER_ROW_H, offset: PICKER_ROW_H * i, index: i })}
            initialScrollIndex={Math.max(0, options.indexOf(value))}
            showsVerticalScrollIndicator={false}
            style={s.pickerList}
            renderItem={({ item }) => {
              const active = item === value;
              return (
                <TouchableOpacity
                  style={s.pickerItemRow}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[s.pickerItem, active && s.pickerItemActive]}>
                    {item}
                    {suffix ? ` ${suffix}` : ""}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  color = "#1c1c1e",
  bg = "#ffffff",
  labelColor = "#8e8e93",
  iconColor = "#8e8e93",
  icon: Icon,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  color?: string;
  bg?: string;
  labelColor?: string;
  iconColor?: string;
  icon: LucideIcon;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[s.metricCard, { backgroundColor: bg }]} onPress={onPress}>
      <View style={s.metricTop}>
        <Text style={[s.metricLabel, { color: labelColor }]}>{label}</Text>
        <Icon size={13} color={iconColor} />
      </View>
      <View style={s.metricValueRow}>
        <Text style={[s.metricValue, { color }]}>{value}</Text>
        {unit && <Text style={[s.metricUnit, { color }]}>{unit}</Text>}
      </View>
      {sub && <Text style={[s.metricSub, { color: labelColor }]}>{sub}</Text>}
    </Pressable>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function WaterPiggy({ pct, color }: { pct: number; color: string }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: Math.max(0, Math.min(100, pct)),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct, fill]);

  const height = fill.interpolate({ inputRange: [0, 100], outputRange: [0, 80] });

  return (
    <View style={{ width: 80, height: 80 }}>
      <View style={StyleSheet.absoluteFill}>
        <PiggyBank size={80} strokeWidth={1.5} color="#e5e5ea" />
      </View>
      <Animated.View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, overflow: "hidden" }}
      >
        <View style={{ position: "absolute", bottom: 0 }}>
          <PiggyBank size={80} strokeWidth={2} color={color} />
        </View>
      </Animated.View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function RetirementScreen() {
  const entries = useFinanceStore((st) => st.entries);
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [sensRate, setSensRate] = useState(DEFAULTS.accRate);
  const [sensAge, setSensAge] = useState(DEFAULTS.retirementAge);

  const currentYear = new Date().getFullYear();

  // Load persisted params
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = sanitizeParams(JSON.parse(saved));
          setParams(parsed);
          setSensRate(parsed.accRate);
          setSensAge(parsed.retirementAge);
        }
      } catch {
        /* ignore */
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (initialized) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(params)).catch(() => {});
  }, [params, initialized]);

  // sync sensitivity sliders when params change
  useEffect(() => setSensRate(params.accRate), [params.accRate]);
  useEffect(() => setSensAge(params.retirementAge), [params.retirementAge]);

  function setParam<K extends keyof Params>(key: K, value: Params[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  // Asset summary
  const { netAssets, totalAssets, totalLiabilities, totalInvestment, liquidAssets } =
    useMemo(() => {
      // Entry values arrive from /api/entries as a plain cast with no runtime
      // validation, so a null / NaN / mistyped value can slip through. It MUST
      // be coerced to a finite number here: a non-finite value propagates into
      // <ProjectionChart> and produces an SVG path with "NaN" coordinates, which
      // hard-crashes react-native-svg natively on iOS.
      const num = (v: unknown) => {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const assetEntries = entries.filter((e) => e.topCategory !== "負債");
      const liabEntries = entries.filter((e) => e.topCategory === "負債");
      const investEntries = entries.filter((e) => e.topCategory === "投資");
      const liquidEntries = entries.filter((e) => e.topCategory === "流動資金");
      const ta = assetEntries.reduce((sum, e) => sum + num(e.value), 0);
      const tl = liabEntries.reduce((sum, e) => sum + num(e.value), 0);
      return {
        totalAssets: ta,
        totalLiabilities: tl,
        totalInvestment: investEntries.reduce((sum, e) => sum + num(e.value), 0),
        liquidAssets: liquidEntries.reduce((sum, e) => sum + num(e.value), 0),
        netAssets: ta - tl,
      };
    }, [entries]);

  // Core calcs
  const calcs = useMemo(() => {
    const ytr = Math.max(0, params.retirementAge - params.currentAge);
    const fme = params.monthlyExpense * Math.pow(1 + params.inflationRate / 100, ytr);
    const aw = Math.max(0, fme - params.govPension) * 12;
    const tt = params.swr > 0 ? aw / (params.swr / 100) : 0;
    const gap = Math.max(0, tt - netAssets);
    const goalPct = tt > 0 ? Math.max(0, Math.min(100, (netAssets / tt) * 100)) : 0;
    const monthlyPassive = (totalInvestment * 0.04) / 12;
    const passiveCoverage = fme > 0 ? Math.min(100, (monthlyPassive / fme) * 100) : 0;

    let proj = Math.max(0, netAssets);
    let fiAge: number | null = null;
    for (let age = params.currentAge; age <= 100; age++) {
      if (proj >= tt && fiAge === null) fiAge = age;
      if (age < params.retirementAge) {
        proj = proj * (1 + params.accRate / 100) + params.monthlyContrib * 12;
      }
    }
    const fiYear = fiAge !== null ? currentYear + (fiAge - params.currentAge) : null;
    return { ytr, fme, aw, tt, gap, goalPct, monthlyPassive, passiveCoverage, fiAge, fiYear };
  }, [params, netAssets, totalInvestment, currentYear]);

  // Projection data
  const projData = useMemo<ProjRow[]>(() => {
    const rows: ProjRow[] = [];
    let base = Math.max(0, netAssets);
    let opt = Math.max(0, netAssets);
    let cons = Math.max(0, netAssets);
    const aw = calcs.aw;
    // Never emit a non-finite point — it becomes a "NaN"/"Infinity" SVG path
    // coordinate downstream and crashes react-native-svg on iOS.
    const safe = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0);
    for (let age = params.currentAge; age <= 90; age++) {
      rows.push({ age, base: safe(base), opt: safe(opt), cons: safe(cons) });
      if (age < params.retirementAge) {
        const c = params.monthlyContrib * 12;
        base = base * (1 + params.accRate / 100) + c;
        opt = opt * (1 + (params.accRate + 2) / 100) + c;
        cons = cons * (1 + Math.max(0, params.accRate - 2) / 100) + c;
      } else {
        base = Math.max(0, base * (1 + params.wdRate / 100) - aw);
        opt = Math.max(0, opt * (1 + (params.wdRate + 1) / 100) - aw);
        cons = Math.max(0, cons * (1 + Math.max(0, params.wdRate - 1) / 100) - aw);
      }
    }
    return rows;
  }, [netAssets, params, calcs.aw]);

  // Schedule
  const schedule = useMemo(() => {
    const retRow = projData.find((r) => r.age === params.retirementAge);
    if (!retRow) return [];
    const rows: {
      age: number;
      year: number;
      returns: number;
      withdrawal: number;
      balance: number;
    }[] = [];
    let bal = retRow.base;
    for (let i = 0; i < 35 && bal > 0; i++) {
      const age = params.retirementAge + i;
      const year = currentYear + (age - params.currentAge);
      const ret = bal * (params.wdRate / 100);
      bal = Math.max(0, bal + ret - calcs.aw);
      rows.push({
        age,
        year,
        returns: Math.round(ret),
        withdrawal: Math.round(calcs.aw),
        balance: Math.round(bal),
      });
    }
    return rows;
  }, [projData, params, calcs.aw, currentYear]);

  // Stress test
  const stress = useMemo(() => {
    const retRow = projData.find((r) => r.age === params.retirementAge);
    if (!retRow || retRow.base === 0 || calcs.aw === 0) return { crash20: 60, highInfl: 60 };
    let b1 = retRow.base * 0.8,
      y1 = 0;
    while (b1 > 0 && y1 < 60) {
      b1 = Math.max(0, b1 * (1 + params.wdRate / 100) - calcs.aw);
      y1++;
    }
    let b2 = retRow.base,
      y2 = 0;
    while (b2 > 0 && y2 < 60) {
      b2 = Math.max(0, b2 * (1 + params.wdRate / 100) - calcs.aw * 1.5);
      y2++;
    }
    return { crash20: y1, highInfl: y2 };
  }, [projData, params, calcs.aw]);

  // Sensitivity
  const sensCalc = useMemo(() => {
    const ytr = Math.max(0, sensAge - params.currentAge);
    const fme = params.monthlyExpense * Math.pow(1 + params.inflationRate / 100, ytr);
    const aw = Math.max(0, fme - params.govPension) * 12;
    const tt = params.swr > 0 ? aw / (params.swr / 100) : 0;
    let proj = Math.max(0, netAssets),
      fia: number | null = null;
    for (let age = params.currentAge; age <= 100; age++) {
      if (proj >= tt && fia === null) fia = age;
      if (age < sensAge) proj = proj * (1 + sensRate / 100) + params.monthlyContrib * 12;
    }
    const fiYear = fia !== null ? currentYear + (fia - params.currentAge) : null;
    const delta = fia !== null && calcs.fiAge !== null ? fia - calcs.fiAge : null;
    return { fiAge: fia, fiYear, delta, target: tt };
  }, [sensRate, sensAge, params, netAssets, calcs.fiAge, currentYear]);

  const modalContents = useMemo<Record<string, ModalContent>>(
    () => ({
      target: {
        title: "目標總額",
        description:
          "依 SWR 法則，退休後每年需自行提領的金額除以安全提領率，反推退休時所需累積的總資產。",
        steps: [
          { label: "退休後月支出（通膨調整）", value: `NT$ ${fmtWan(Math.round(calcs.fme))} ／月` },
          { label: "扣除政府退休金", value: `NT$ ${fmtWan(params.govPension)} ／月` },
          { label: "年提領額 × 12", value: `NT$ ${fmtWan(Math.round(calcs.aw))} ／年` },
          { label: `÷ SWR (${params.swr}%)` },
        ],
        result: { label: "目標總額", value: `NT$ ${fmtWan(Math.round(calcs.tt))}` },
      },
      gap: {
        title: "退休缺口",
        description: "退休目標總額與現有淨資產之間的差距，即目前尚需繼續累積的金額。",
        steps: [
          { label: "退休目標總額", value: `NT$ ${fmtWan(Math.round(calcs.tt))}` },
          { label: "− 現有淨資產", value: `NT$ ${fmtWan(netAssets)}` },
        ],
        result: {
          label: "退休缺口",
          value: calcs.gap === 0 ? "已達標 ✓" : `NT$ ${fmtWan(Math.round(calcs.gap))}`,
        },
      },
      fi: {
        title: "財務自由預測",
        description:
          "從現在起，每年將資產以積累期報酬率複利成長，並持續加入每月投入，模擬何時首次達到退休目標總額。",
        steps: [
          { label: "起始淨資產", value: `NT$ ${fmtWan(netAssets)}` },
          { label: "每月定期投入 × 12", value: `NT$ ${fmtWan(params.monthlyContrib * 12)} ／年` },
          { label: "積累期年化報酬", value: `${params.accRate}%` },
          { label: "目標總額", value: `NT$ ${fmtWan(Math.round(calcs.tt))}` },
        ],
        result: {
          label: "財務自由預測",
          value: calcs.fiAge ? `${calcs.fiAge} 歲（${calcs.fiYear} 年）` : "100 歲以上",
        },
      },
      passive: {
        title: "被動收入覆蓋",
        description:
          "以現有投資資產假設 4% 年化股息率，計算每月能產生多少被動收入，並衡量可覆蓋退休後月支出的比例。",
        steps: [
          { label: "投資資產", value: `NT$ ${fmtWan(totalInvestment)}` },
          { label: "× 4% 股息假設 ÷ 12" },
          { label: "月被動收入", value: `NT$ ${fmtWan(Math.round(calcs.monthlyPassive))}` },
          { label: "退休後月支出（通膨後）", value: `NT$ ${fmtWan(Math.round(calcs.fme))}` },
        ],
        result: { label: "被動收入覆蓋", value: `${calcs.passiveCoverage.toFixed(1)}%` },
      },
      goal: {
        title: "目標達成率",
        description: "現有淨資產佔退休目標總額的百分比，反映目前距離退休目標的累積進度。",
        steps: [
          { label: "現有淨資產", value: `NT$ ${fmtWan(netAssets)}` },
          { label: "退休目標總額", value: `NT$ ${fmtWan(Math.round(calcs.tt))}` },
        ],
        result: { label: "目標達成率", value: `${calcs.goalPct.toFixed(1)}%` },
      },
    }),
    [calcs, params, netAssets, totalInvestment]
  );

  const goalColor = calcs.goalPct >= 70 ? "#ff9500" : calcs.goalPct >= 30 ? "#66788E" : "#C7C7D4";
  const fiColor =
    calcs.fiAge !== null && calcs.fiAge <= params.retirementAge ? "#ff9500" : "#ff3b30";
  const coverageColor =
    calcs.passiveCoverage >= 100 ? "#ff9500" : calcs.passiveCoverage >= 50 ? "#000000" : "#ffffff";

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[s.header, { height: SCREEN_H * 0.42 }]}>
          <View style={{ alignItems: "center", marginBottom: 4 }}>
            <Text style={s.h1}>退休計劃</Text>
            <Text style={s.h1sub}>財務自由追蹤與模擬</Text>
          </View>
          <Pressable onPress={() => setOpenModal("goal")}>
            <WaterPiggy pct={calcs.goalPct} color={goalColor} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={[s.goalPct, { color: goalColor }]}>{calcs.goalPct.toFixed(1)}%</Text>
            <Text style={s.goalLabel}>目標達成率</Text>
          </View>
        </View>

        {/* 2×2 metric cards */}
        <View style={s.grid}>
          <MetricCard
            label="目標總額"
            value={fmtWan(calcs.tt)}
            unit="元"
            sub={`${params.swr}% SWR 法則`}
            color="#ffffff"
            bg="#0e1424"
            labelColor="rgba(255,255,255,0.45)"
            iconColor="rgba(255,255,255,0.25)"
            icon={Target}
            onPress={() => setOpenModal("target")}
          />
          <MetricCard
            label="退休缺口"
            value={calcs.gap === 0 ? "已達標" : fmtWan(calcs.gap)}
            {...(calcs.gap === 0 ? {} : { unit: "元" })}
            sub={calcs.gap === 0 ? "恭喜達成！" : "尚需累積"}
            color={calcs.gap === 0 ? "#0e1424" : "#ff3b30"}
            bg="#ffffff"
            icon={AlertTriangle}
            onPress={() => setOpenModal("gap")}
          />
          <MetricCard
            label="財務自由預測"
            value={calcs.fiYear ? String(calcs.fiYear) : "100歲+"}
            {...(calcs.fiYear ? { unit: "年" } : {})}
            sub={
              calcs.fiAge
                ? `${calcs.fiAge}歲 · 距今${calcs.fiAge - params.currentAge}年`
                : "尚未達標"
            }
            color={fiColor}
            bg="#374254"
            labelColor="rgba(255,255,255,0.45)"
            iconColor="rgba(255,255,255,0.25)"
            icon={Calendar}
            onPress={() => setOpenModal("fi")}
          />
          <MetricCard
            label="被動收入覆蓋"
            value={calcs.passiveCoverage.toFixed(1)}
            unit="%"
            sub={`月 ${fmtWan(calcs.monthlyPassive)} 元`}
            color={coverageColor}
            bg="#C7C7D4"
            icon={TrendingUp}
            onPress={() => setOpenModal("passive")}
          />
        </View>

        {/* 參數設定 */}
        <View style={s.collapseCard}>
          <Pressable style={s.collapseHead} onPress={() => setShowParams((v) => !v)}>
            <Text style={s.collapseTitle}>參數設定</Text>
            {showParams ? (
              <ChevronUp size={16} color="#8e8e93" />
            ) : (
              <ChevronDown size={16} color="#8e8e93" />
            )}
          </Pressable>
          {showParams && (
            <View style={s.collapseBody}>
              <Text style={s.groupLabel}>退休規劃</Text>
              <NumberPickerInput
                label="現在年齡"
                value={params.currentAge}
                onChange={(v) => setParam("currentAge", v)}
                suffix="歲"
                min={18}
                max={80}
              />
              <NumberPickerInput
                label="預計退休年齡"
                value={params.retirementAge}
                onChange={(v) => setParam("retirementAge", v)}
                suffix="歲"
                min={40}
                max={85}
              />
              <NumberInput
                label="退休後每月生活費"
                value={params.monthlyExpense}
                onChange={(v) => setParam("monthlyExpense", v)}
                prefix="NT$"
              />
              <NumberInput
                label="政府退休金（月）"
                value={params.govPension}
                onChange={(v) => setParam("govPension", v)}
                prefix="NT$"
              />

              <Text style={s.groupLabel}>通膨與報酬假設</Text>
              <NumberInput
                label="長期通膨率"
                value={params.inflationRate}
                onChange={(v) => setParam("inflationRate", v)}
                suffix="%"
              />
              <NumberInput
                label="積累期年化報酬"
                value={params.accRate}
                onChange={(v) => setParam("accRate", v)}
                suffix="%"
              />
              <NumberInput
                label="提領期年化報酬"
                value={params.wdRate}
                onChange={(v) => setParam("wdRate", v)}
                suffix="%"
              />
              <NumberInput
                label="安全提領率（SWR）"
                value={params.swr}
                onChange={(v) => setParam("swr", v)}
                suffix="%"
              />

              <Text style={s.groupLabel}>持續投入</Text>
              <NumberInput
                label="每月定期投入"
                value={params.monthlyContrib}
                onChange={(v) => setParam("monthlyContrib", v)}
                prefix="NT$"
              />
            </View>
          )}
        </View>

        {/* 資產整合 */}
        <SectionCard title="資產整合與淨值計算">
          <Row label="生息資產（投資）" value={`NT$ ${fmtWan(totalInvestment)}`} />
          <Row label="流動資金" value={`NT$ ${fmtWan(liquidAssets)}`} />
          <Row label="總資產" value={`NT$ ${fmtWan(totalAssets)}`} />
          <Row label="負債（房貸等）" value={`NT$ ${fmtWan(totalLiabilities)}`} color="#ff3b30" />
          <Row
            label="淨資產"
            value={`NT$ ${fmtWan(netAssets)}`}
            color={netAssets >= 0 ? "#0e1424" : "#ff3b30"}
          />
          <Row label="退休目標總額" value={`NT$ ${fmtWan(calcs.tt)}`} />
          <Row
            label="退休缺口"
            value={calcs.gap === 0 ? "已達標 ✓" : `NT$ ${fmtWan(calcs.gap)}`}
            color={calcs.gap === 0 ? "#0e1424" : "#ff3b30"}
          />
          <Text style={s.footnote}>
            通膨調整後退休月支出：NT$ {fmtWan(Math.round(calcs.fme))} ／月 （今日購買力 NT${" "}
            {fmtWan(params.monthlyExpense)}）
          </Text>
        </SectionCard>

        {/* 動態追蹤指標 */}
        <SectionCard title="動態追蹤指標">
          <View style={s.trackRow}>
            <View>
              <Text style={s.trackLabel}>財務自由日預測</Text>
              <Text style={s.trackValue}>
                {calcs.fiYear ? `${calcs.fiYear} 年（${calcs.fiAge}歲）` : "超過 100 歲"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.trackTag, { color: fiColor }]}>
                {calcs.fiAge !== null && calcs.fiAge <= params.retirementAge
                  ? "退休前可達標"
                  : "退休前未達標"}
              </Text>
              <Text style={s.trackHint}>
                {calcs.fiAge !== null ? `距今 ${calcs.fiAge - params.currentAge} 年` : "—"}
              </Text>
            </View>
          </View>
          <View style={{ paddingVertical: 8 }}>
            <View style={s.trackRowFlat}>
              <View>
                <Text style={s.trackLabel}>被動收入覆蓋率</Text>
                <Text style={s.trackValue}>
                  月收 NT$ {fmtWan(Math.round(calcs.monthlyPassive))}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    s.coverPct,
                    { color: coverageColor === "#ffffff" ? "#1c1c1e" : coverageColor },
                  ]}
                >
                  {calcs.passiveCoverage.toFixed(1)}%
                </Text>
                <Text style={s.trackHint}>4% 股息假設</Text>
              </View>
            </View>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${calcs.passiveCoverage}%`,
                    backgroundColor: coverageColor === "#ffffff" ? "#C7C7D4" : coverageColor,
                  },
                ]}
              />
            </View>
          </View>
        </SectionCard>

        {/* 資產成長趨勢圖 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>資產成長趨勢圖</Text>
          <Text style={s.sectionSub}>三種報酬情境下的資產路徑</Text>
          <ProjectionChart data={projData} target={calcs.tt} retirementAge={params.retirementAge} />
        </View>

        {/* 敏感度分析 */}
        <SectionCard title="敏感度分析">
          <Text style={s.sectionSub}>
            調整假設情境，即時觀察對財務自由年份的影響（不影響主要參數）
          </Text>

          <View style={{ marginTop: 12 }}>
            <View style={s.sliderHead}>
              <Text style={s.rowLabel}>年化報酬率</Text>
              <Text style={s.sliderVal}>{sensRate.toFixed(1)}%</Text>
            </View>
            <Slider
              minimumValue={1}
              maximumValue={15}
              step={0.5}
              value={sensRate}
              onValueChange={setSensRate}
              minimumTrackTintColor="#374254"
              maximumTrackTintColor="#e5e5ea"
              thumbTintColor="#374254"
            />
            <View style={s.sliderEnds}>
              <Text style={s.sliderEnd}>1%</Text>
              <Text style={s.sliderEnd}>15%</Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <View style={s.sliderHead}>
              <Text style={s.rowLabel}>退休年齡</Text>
              <Text style={s.sliderVal}>{sensAge} 歲</Text>
            </View>
            <Slider
              minimumValue={40}
              maximumValue={75}
              step={1}
              value={sensAge}
              onValueChange={(v) => setSensAge(Math.round(v))}
              minimumTrackTintColor="#374254"
              maximumTrackTintColor="#e5e5ea"
              thumbTintColor="#374254"
            />
            <View style={s.sliderEnds}>
              <Text style={s.sliderEnd}>40歲</Text>
              <Text style={s.sliderEnd}>75歲</Text>
            </View>
          </View>

          <View style={s.sensResult}>
            <View style={{ flex: 1 }}>
              <Text style={s.trackHint}>假設情境財務自由</Text>
              <Text style={s.sensValue}>
                {sensCalc.fiYear ? `${sensCalc.fiYear} 年（${sensCalc.fiAge}歲）` : "100歲以上"}
              </Text>
              <Text style={s.trackHint}>目標：NT$ {fmtWan(Math.round(sensCalc.target))}</Text>
            </View>
            {sensCalc.delta !== null && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.trackHint}>vs 基準</Text>
                <Text
                  style={[
                    s.sensDelta,
                    {
                      color:
                        sensCalc.delta === 0
                          ? "#8e8e93"
                          : sensCalc.delta < 0
                            ? "#0e1424"
                            : "#ff3b30",
                    },
                  ]}
                >
                  {sensCalc.delta === 0
                    ? "相同"
                    : `${sensCalc.delta > 0 ? "+" : ""}${sensCalc.delta}年`}
                </Text>
              </View>
            )}
          </View>
        </SectionCard>

        {/* 壓力測試 */}
        <SectionCard title="壓力測試">
          <Text style={s.sectionSub}>模擬退休時發生意外事件，評估退休金可支撐年限</Text>
          <View
            style={[
              s.stressCard,
              { borderColor: "rgba(255,59,48,0.2)", backgroundColor: "rgba(255,59,48,0.05)" },
            ]}
          >
            <AlertTriangle size={14} color="#ff3b30" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.stressTitle}>市場崩盤 −20%</Text>
              <Text style={s.stressDesc}>退休當年資產縮水 20%，之後正常提領</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  s.stressYears,
                  {
                    color:
                      stress.crash20 >= 30
                        ? "#0e1424"
                        : stress.crash20 >= 20
                          ? "#ff9500"
                          : "#ff3b30",
                  },
                ]}
              >
                {stress.crash20 >= 60 ? "60年+" : `${stress.crash20}年`}
              </Text>
              <Text style={s.trackHint}>可支撐</Text>
            </View>
          </View>
          <View
            style={[
              s.stressCard,
              { borderColor: "rgba(255,149,0,0.2)", backgroundColor: "rgba(255,149,0,0.05)" },
            ]}
          >
            <Activity size={14} color="#ff9500" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.stressTitle}>通膨劇增，生活費 ×1.5</Text>
              <Text style={s.stressDesc}>退休後每年提領額提高 50%</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  s.stressYears,
                  {
                    color:
                      stress.highInfl >= 30
                        ? "#0e1424"
                        : stress.highInfl >= 20
                          ? "#ff9500"
                          : "#ff3b30",
                  },
                ]}
              >
                {stress.highInfl >= 60 ? "60年+" : `${stress.highInfl}年`}
              </Text>
              <Text style={s.trackHint}>可支撐</Text>
            </View>
          </View>
        </SectionCard>

        {/* 退休金流排程表 */}
        <View style={s.collapseCard}>
          <Pressable style={s.collapseHead} onPress={() => setShowSchedule((v) => !v)}>
            <View>
              <Text style={s.collapseTitle}>退休金流排程表</Text>
              <Text style={s.sectionSub}>退休後每年提領與剩餘明細</Text>
            </View>
            {showSchedule ? (
              <ChevronUp size={16} color="#8e8e93" />
            ) : (
              <ChevronDown size={16} color="#8e8e93" />
            )}
          </Pressable>
          {showSchedule && (
            <View style={s.collapseBody}>
              {schedule.length === 0 ? (
                <Text style={s.scheduleEmpty}>請先完成參數設定</Text>
              ) : (
                <>
                  <View style={s.tableHead}>
                    <Text style={[s.th, { flex: 1.2, textAlign: "left" }]}>年齡</Text>
                    <Text style={[s.th, { flex: 1.4 }]}>年份</Text>
                    <Text style={[s.th, { flex: 1.4 }]}>投報</Text>
                    <Text style={[s.th, { flex: 1.4 }]}>提領</Text>
                    <Text style={[s.th, { flex: 1.6 }]}>餘額</Text>
                  </View>
                  {schedule.map((row) => (
                    <View key={row.age} style={s.tableRow}>
                      <Text style={[s.td, { flex: 1.2, textAlign: "left", color: "#1c1c1e" }]}>
                        {row.age}歲
                      </Text>
                      <Text style={[s.td, { flex: 1.4, color: "#8e8e93" }]}>{row.year}</Text>
                      <Text style={[s.td, { flex: 1.4, color: "#0e1424" }]}>
                        +{fmtWan(row.returns)}
                      </Text>
                      <Text style={[s.td, { flex: 1.4, color: "#ff3b30" }]}>
                        -{fmtWan(row.withdrawal)}
                      </Text>
                      <Text
                        style={[
                          s.td,
                          {
                            flex: 1.6,
                            fontWeight: "600",
                            color: row.balance > 0 ? "#1c1c1e" : "#ff3b30",
                          },
                        ]}
                      >
                        {fmtWan(row.balance)}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <InfoModal
        visible={openModal !== null}
        content={openModal ? (modalContents[openModal] ?? null) : null}
        onClose={() => setOpenModal(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  scroll: { paddingHorizontal: 16, paddingTop: NAV_CLEARANCE, paddingBottom: 32, gap: 16 },

  header: { alignItems: "center", justifyContent: "center", gap: 8 },
  h1: { fontSize: 22, fontWeight: "700", color: "#1c1c1e" },
  h1sub: { fontSize: 13, color: "#8e8e93", marginTop: 2 },
  goalPct: { fontSize: 20, fontWeight: "700" },
  goalLabel: { fontSize: 12, color: "#8e8e93" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: {
    width: "47.5%",
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 0.5 },
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  metricValue: { fontSize: 24, fontWeight: "700", lineHeight: 28 },
  metricUnit: { fontSize: 13, fontWeight: "600" },
  metricSub: { fontSize: 11, marginTop: 8 },

  collapseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    ...cardShadow(),
  },
  collapseHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  collapseTitle: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  collapseBody: { paddingHorizontal: 16, paddingBottom: 16 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#8e8e93",
    marginTop: 16,
    marginBottom: 4,
  },

  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...cardShadow(),
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#1c1c1e", marginBottom: 4 },
  sectionSub: { fontSize: 12, color: "#8e8e93", marginBottom: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f2f7",
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 13, color: "#8e8e93" },
  rowValue: { fontSize: 14, fontWeight: "500" },
  inputRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  affix: { fontSize: 13, color: "#8e8e93" },
  input: {
    minWidth: 80,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "500",
    color: "#1c1c1e",
    padding: 0,
  },

  // Number picker (bottom sheet)
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  pickerTitle: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  pickerDone: { fontSize: 16, fontWeight: "600", color: "#374254" },
  pickerList: { maxHeight: PICKER_ROW_H * 6 },
  pickerItemRow: { height: PICKER_ROW_H, alignItems: "center", justifyContent: "center" },
  pickerItem: { fontSize: 17, color: "#8e8e93" },
  pickerItemActive: { fontSize: 19, fontWeight: "700", color: "#1c1c1e" },

  footnote: {
    fontSize: 11,
    color: "#8e8e93",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f2f2f7",
  },

  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f2f7",
    paddingVertical: 8,
  },
  trackRowFlat: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trackLabel: { fontSize: 13, color: "#8e8e93" },
  trackValue: { fontSize: 14, fontWeight: "500", color: "#1c1c1e", marginTop: 2 },
  trackTag: { fontSize: 12, fontWeight: "500" },
  trackHint: { fontSize: 11, color: "#8e8e93" },
  coverPct: { fontSize: 17, fontWeight: "700" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f2f2f7",
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: "100%", borderRadius: 3 },

  sliderHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sliderVal: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  sliderEnds: { flexDirection: "row", justifyContent: "space-between" },
  sliderEnd: { fontSize: 10, color: "#8e8e93" },
  sensResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f2f2f7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  sensValue: { fontSize: 15, fontWeight: "600", color: "#1c1c1e", marginVertical: 2 },
  sensDelta: { fontSize: 17, fontWeight: "700" },

  stressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  stressTitle: { fontSize: 13, fontWeight: "500", color: "#1c1c1e" },
  stressDesc: { fontSize: 11, color: "#8e8e93", marginTop: 2 },
  stressYears: { fontSize: 15, fontWeight: "700" },

  scheduleEmpty: { fontSize: 13, color: "#8e8e93", textAlign: "center", paddingVertical: 16 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f2f7",
    paddingVertical: 8,
  },
  th: { fontSize: 12, fontWeight: "500", color: "#8e8e93", textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f2f7",
    paddingVertical: 6,
  },
  td: { fontSize: 12, textAlign: "right" },
});

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  } as const;
}
