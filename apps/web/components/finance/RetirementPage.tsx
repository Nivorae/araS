"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  Target,
  TrendingUp,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { useFinanceStore } from "../../store/useFinanceStore";
import { useIsPremium } from "../../hooks/useIsPremium";
import { promptMobileApp } from "../../lib/mobileAppPrompt";
import { getAccountItem, setAccountItem } from "../../lib/accountStorage";
import {
  DEFAULTS,
  STORAGE_KEY,
  fmtNtd,
  fmtWan,
  fmtY,
  niceMax,
  sanitizeParams,
  type ModalContent,
  type Params,
} from "../../lib/retirement";
import { FitText } from "../ui/FitText";
import { InfoModal } from "./retirement/InfoModal";
import { ModeToggle, useModeTransition, type PlanMode } from "./retirement/ModeSwitch";
import { SalaryCalculator, useSalary } from "./retirement/SalaryCalculator";

/** Non-finite values (NaN from a bad entry) would poison every total and chart point. */
const fin = (n: number) => (Number.isFinite(n) ? n : 0);

// ── Sub-components ────────────────────────────────────────────────────────────

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
    <div className="flex items-center justify-between border-b border-[#f2f2f7] py-2 last:border-0">
      <span className="text-[13px] text-[#8e8e93]">{label}</span>
      <span className="text-[14px] font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [str, setStr] = useState(String(value));

  useEffect(() => {
    setStr(String(value));
  }, [value]);

  return (
    <div className="flex items-center justify-between border-b border-[#f2f2f7] py-2 last:border-0">
      <label className="text-[13px] text-[#8e8e93]">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[13px] text-[#8e8e93]">{prefix}</span>}
        <input
          type="number"
          value={str}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setStr(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          onBlur={() => {
            if (isNaN(parseFloat(str))) setStr(String(value));
          }}
          className="w-24 [appearance:textfield] bg-transparent text-right text-[14px] font-medium text-[#1c1c1e] outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && <span className="ml-0.5 text-[13px] text-[#8e8e93]">{suffix}</span>}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  color = "#1c1c1e",
  bg = "white",
  labelColor = "#8e8e93",
  iconColor = "#8e8e93",
  icon: Icon,
  onClick,
  index = 0,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  sub?: string | undefined;
  color?: string | undefined;
  bg?: string | undefined;
  labelColor?: string | undefined;
  iconColor?: string | undefined;
  icon: React.ElementType;
  onClick?: (() => void) | undefined;
  index?: number;
}) {
  return (
    <div
      className={`animate-enter-down rounded-2xl px-4 py-5 ${onClick ? "cursor-pointer active:opacity-75" : ""}`}
      style={{ background: bg, animationDelay: `${60 + index * 50}ms` }}
      role={onClick ? "button" : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
      data-testid={onClick ? `metric-${label}` : undefined}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide" style={{ color: labelColor }}>
          {label}
        </span>
        <Icon size={13} style={{ color: iconColor }} />
      </div>
      {/* One line that shrinks to fit (down to 0.6×), like mobile's adjustsFontSizeToFit. */}
      <FitText fontSize={24} className="leading-[28px] font-bold" style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-[0.54em] font-semibold">{unit}</span>}
      </FitText>
      {sub && (
        <p className="mt-2 text-[11px]" style={{ color: labelColor }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Whole-number picker for ages — mobile opens a wheel-style sheet; a native select is the web equivalent. */
function AgeSelect({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const options = useMemo(() => {
    const list = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    // A value saved outside the range must still be shown, not silently replaced.
    if (!list.includes(value)) list.push(value);
    return list.sort((a, b) => a - b);
  }, [min, max, value]);
  const id = `age-${label}`;
  return (
    <div className="flex items-center justify-between border-b border-[#f2f2f7] py-2 last:border-0">
      <label htmlFor={id} className="text-[13px] text-[#8e8e93]">
        {label}
      </label>
      <div className="relative flex items-center gap-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="cursor-pointer appearance-none bg-transparent text-right text-[14px] font-medium text-[#1c1c1e] outline-none"
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="ml-0.5 text-[13px] text-[#8e8e93]">歲</span>
        <ChevronDown size={14} className="pointer-events-none text-[#c7c7cc]" />
      </div>
    </div>
  );
}

/** Piggy outline with a coloured fill that rises from 0 to `pct` on mount and on change. */
function WaterPiggy({ pct, color }: { pct: number; color: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, pct))));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className="relative" style={{ width: 80, height: 80 }}>
      <PiggyBank size={80} strokeWidth={1.5} className="text-[#e5e5ea]" />
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(${100 - shown}% 0 0 0)`,
          transition: "clip-path 0.7s ease-in-out",
        }}
      >
        <PiggyBank size={80} strokeWidth={2} style={{ color }} />
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
      <p className="mb-3 text-[15px] font-semibold text-[#1c1c1e]">{title}</p>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RetirementPage() {
  const { entries, fetchAll } = useFinanceStore();
  const { userId } = useAuth();
  const { isPremium, loading: premiumLoading } = useIsPremium();
  const { selected, mode, style: modeStyle, select } = useModeTransition("retirement");
  const salary = useSalary();
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [sensRate, setSensRate] = useState(DEFAULTS.accRate);
  const [sensAge, setSensAge] = useState(DEFAULTS.retirementAge);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Load persisted params, per account (lib/accountStorage.ts). Signed-out
  // guests browse demo data and get nothing persisted.
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = getAccountItem(STORAGE_KEY, userId);
      if (saved) {
        const parsed = sanitizeParams(JSON.parse(saved));
        setParams(parsed);
        setSensRate(parsed.accRate);
        setSensAge(parsed.retirementAge);
      }
    } catch {
      /* corrupt JSON — keep defaults */
    }
    setInitialized(true);
  }, [userId]);

  useEffect(() => {
    if (initialized && userId) setAccountItem(STORAGE_KEY, userId, JSON.stringify(params));
  }, [params, initialized, userId]);

  // 理財規劃是 Premium 功能：免費帳號提示下載手機版（web 沒有付費頁），停在退休計劃。
  // Every mode switch starts the new mode from the top of the page.
  const selectMode = (next: PlanMode) => {
    if (next === "finance" && !isPremium) {
      if (!premiumLoading)
        promptMobileApp("理財規劃是 Premium 功能，如果要使用該功能，請下載手機版本。");
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    select(next);
  };

  function setParam<K extends keyof Params>(key: K, value: Params[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  // Sync sensitivity sliders when params change
  useEffect(() => {
    setSensRate(params.accRate);
  }, [params.accRate]);
  useEffect(() => {
    setSensAge(params.retirementAge);
  }, [params.retirementAge]);

  // Asset summary from finance store
  const { netAssets, totalAssets, totalLiabilities, totalInvestment, liquidAssets } =
    useMemo(() => {
      const assetEntries = entries.filter((e) => e.topCategory !== "負債");
      const liabEntries = entries.filter((e) => e.topCategory === "負債");
      const investEntries = entries.filter((e) => e.topCategory === "投資");
      const liquidEntries = entries.filter((e) => e.topCategory === "流動資金");
      const ta = assetEntries.reduce((s, e) => s + fin(e.value), 0);
      const tl = liabEntries.reduce((s, e) => s + fin(e.value), 0);
      return {
        totalAssets: ta,
        totalLiabilities: tl,
        totalInvestment: investEntries.reduce((s, e) => s + fin(e.value), 0),
        liquidAssets: liquidEntries.reduce((s, e) => s + fin(e.value), 0),
        netAssets: ta - tl,
      };
    }, [entries]);

  // Core retirement calculations
  const calcs = useMemo(() => {
    const ytr = Math.max(0, params.retirementAge - params.currentAge);
    const fme = params.monthlyExpense * Math.pow(1 + params.inflationRate / 100, ytr);
    const aw = Math.max(0, fme - params.govPension) * 12;
    const tt = params.swr > 0 ? aw / (params.swr / 100) : 0;
    const gap = Math.max(0, tt - netAssets);
    const goalPct = tt > 0 ? Math.max(0, Math.min(100, (netAssets / tt) * 100)) : 0;
    const monthlyPassive = (totalInvestment * 0.04) / 12;
    const passiveCoverage = fme > 0 ? Math.min(100, (monthlyPassive / fme) * 100) : 0;

    // Project to FI date
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

  // Projection chart data (base / optimistic +2% / conservative -2%)
  const projData = useMemo(() => {
    const rows: { age: number; base: number; opt: number; cons: number }[] = [];
    let base = Math.max(0, netAssets);
    let opt = Math.max(0, netAssets);
    let cons = Math.max(0, netAssets);
    const aw = calcs.aw;

    for (let age = params.currentAge; age <= 90; age++) {
      rows.push({
        age,
        base: Math.max(0, Math.round(fin(base))),
        opt: Math.max(0, Math.round(fin(opt))),
        cons: Math.max(0, Math.round(fin(cons))),
      });
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

  const xTicks = projData.filter((r) => r.age % 5 === 0).map((r) => r.age);
  // Same axis as mobile's ProjectionChart: max rounded up to a nice number
  // (covering the target line too), five evenly spaced ticks.
  const yMax = useMemo(
    () => niceMax(projData.reduce((m, d) => Math.max(m, d.base, d.opt, d.cons), fin(calcs.tt))),
    [projData, calcs.tt]
  );
  const yTicks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);

  // Retirement cash-flow schedule
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

  // Sensitivity calc (independent from main params)
  const sensCalc = useMemo(() => {
    const ytr = Math.max(0, sensAge - params.currentAge);
    const fme = params.monthlyExpense * Math.pow(1 + params.inflationRate / 100, ytr);
    const aw = Math.max(0, fme - params.govPension) * 12;
    const tt = params.swr > 0 ? aw / (params.swr / 100) : 0;

    let proj = Math.max(0, netAssets),
      fia: number | null = null;
    for (let age = params.currentAge; age <= 100; age++) {
      if (proj >= tt && fia === null) fia = age;
      if (age < sensAge) {
        proj = proj * (1 + sensRate / 100) + params.monthlyContrib * 12;
      }
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
          {
            label: "退休後月支出（通膨調整）",
            value: `NT$ ${fmtWan(Math.round(calcs.fme))} ／月`,
          },
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
          {
            label: "每月定期投入 × 12",
            value: `NT$ ${fmtWan(params.monthlyContrib * 12)} ／年`,
          },
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
          {
            label: "月被動收入",
            value: `NT$ ${fmtWan(Math.round(calcs.monthlyPassive))}`,
          },
          {
            label: "退休後月支出（通膨後）",
            value: `NT$ ${fmtWan(Math.round(calcs.fme))}`,
          },
        ],
        result: {
          label: "被動收入覆蓋",
          value: `${calcs.passiveCoverage.toFixed(1)}%`,
        },
      },
      goal: {
        title: "目標達成率",
        description: "現有淨資產佔退休目標總額的百分比，反映目前距離退休目標的累積進度。",
        steps: [
          { label: "現有淨資產", value: `NT$ ${fmtWan(netAssets)}` },
          { label: "退休目標總額", value: `NT$ ${fmtWan(Math.round(calcs.tt))}` },
        ],
        result: {
          label: "目標達成率",
          value: `${calcs.goalPct.toFixed(1)}%`,
        },
      },
    }),
    [calcs, params, netAssets, totalInvestment]
  );

  // Derived colors
  const goalColor = calcs.goalPct >= 70 ? "#ff9500" : calcs.goalPct >= 30 ? "#66788E" : "#C7C7D4";
  const fiColor =
    calcs.fiAge !== null && calcs.fiAge <= params.retirementAge ? "#ff9500" : "#ff3b30";
  const coverageColor =
    calcs.passiveCoverage >= 100 ? "#ff9500" : calcs.passiveCoverage >= 50 ? "#000000" : "#ffffff";
  // coverageColor is white below 50% — readable on the grey metric card, but
  // invisible on the white 動態追蹤 card, so those spots swap in dark/grey.
  const coverageTextOnWhite = coverageColor === "#ffffff" ? "#1c1c1e" : coverageColor;
  const coverageBarOnWhite = coverageColor === "#ffffff" ? "#C7C7D4" : coverageColor;

  return (
    <>
      <div className="space-y-4 px-4 pb-8">
        {/* Header — same height in both modes so switching doesn't shift the page */}
        <div style={modeStyle}>
          {mode === "retirement" ? (
            <div
              className="flex flex-col items-center justify-center gap-2"
              style={{ height: "42dvh" }}
            >
              <div className="mb-1 text-center">
                <h1 className="text-[22px] font-bold text-[#1c1c1e] md:text-[26px]">退休計劃</h1>
                <p className="mt-0.5 text-[13px] text-[#8e8e93] md:text-[15px]">
                  財務自由追蹤與模擬
                </p>
              </div>

              {/* Water-fill Piggy Bank */}
              <button
                data-testid="goal-progress-section"
                onClick={() => setOpenModal("goal")}
                aria-label="目標達成率"
                className="relative cursor-pointer focus:outline-none active:opacity-70 md:scale-125"
              >
                <WaterPiggy pct={calcs.goalPct} color={goalColor} />
              </button>

              <div className="text-center">
                <p className="text-[20px] font-bold" style={{ color: goalColor }}>
                  {calcs.goalPct.toFixed(1)}%
                </p>
                <p className="text-[12px] text-[#8e8e93]">目標達成率</p>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2"
              style={{ height: "42dvh" }}
            >
              <div className="mb-1 text-center">
                <h1 className="text-[22px] font-bold text-[#1c1c1e] md:text-[26px]">理財規劃</h1>
                <p className="mt-0.5 text-[13px] text-[#8e8e93] md:text-[15px]">
                  依月薪規劃儲蓄與開支
                </p>
              </div>
              <div className="animate-enter-zoom md:scale-125" style={{ animationDelay: "80ms" }}>
                <Wallet
                  size={80}
                  strokeWidth={1.5}
                  style={{ color: salary.total > 0 ? "#374254" : "#e5e5ea" }}
                />
              </div>
              <div className="text-center">
                <p className="text-[20px] font-bold text-[#374254]">{fmtNtd(salary.total)}</p>
                <p className="text-[12px] text-[#8e8e93]">每月總收入</p>
              </div>
            </div>
          )}
        </div>

        <ModeToggle value={selected} onChange={selectMode} />

        <div style={modeStyle}>
          {mode === "finance" ? (
            <SalaryCalculator
              salaryStr={salary.salaryStr}
              onChangeSalary={salary.setSalaryStr}
              passiveStr={salary.passiveStr}
              onChangePassive={salary.setPassiveStr}
              rules={salary.rules}
            />
          ) : (
            <div className="space-y-4">
              {/* Summary metric cards 2×2 — diagonal dark/light pattern */}
              <div className="grid grid-cols-2 gap-3">
                {/* Top-left: darkest — authoritative weight */}
                <MetricCard
                  label="目標總額"
                  value={fmtWan(calcs.tt)}
                  unit="元"
                  sub={`${params.swr}% SWR 法則`}
                  color="white"
                  bg="#0e1424"
                  labelColor="rgba(255,255,255,0.45)"
                  iconColor="rgba(255,255,255,0.25)"
                  icon={Target}
                  onClick={() => setOpenModal("target")}
                />
                {/* Top-right: white — clean contrast */}
                <MetricCard
                  label="退休缺口"
                  value={calcs.gap === 0 ? "已達標" : fmtWan(calcs.gap)}
                  unit={calcs.gap === 0 ? undefined : "元"}
                  sub={calcs.gap === 0 ? "恭喜達成！" : "尚需累積"}
                  color={calcs.gap === 0 ? "#0e1424" : "#ff3b30"}
                  bg="white"
                  icon={AlertTriangle}
                  index={1}
                  onClick={() => setOpenModal("gap")}
                />
                {/* Bottom-left: navy — aspirational */}
                <MetricCard
                  label="財務自由預測"
                  value={calcs.fiYear ? String(calcs.fiYear) : "100歲+"}
                  unit={calcs.fiYear ? "年" : undefined}
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
                  index={2}
                  onClick={() => setOpenModal("fi")}
                />
                {/* Bottom-right: light gray — supporting metric */}
                <MetricCard
                  label="被動收入覆蓋"
                  value={calcs.passiveCoverage.toFixed(1)}
                  unit="%"
                  sub={`月 ${fmtWan(calcs.monthlyPassive)} 元`}
                  color={coverageColor}
                  bg="#C7C7D4"
                  icon={TrendingUp}
                  index={3}
                  onClick={() => setOpenModal("passive")}
                />
              </div>

              {/* 1. 參數設定 (collapsible) */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button
                  onClick={() => setShowParams((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-4"
                >
                  <p className="text-[15px] font-semibold text-[#1c1c1e]">參數設定</p>
                  {showParams ? (
                    <ChevronUp size={16} className="text-[#8e8e93]" />
                  ) : (
                    <ChevronDown size={16} className="text-[#8e8e93]" />
                  )}
                </button>
                {showParams && (
                  <div className="px-4 pb-4">
                    <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#8e8e93] uppercase">
                      退休規劃
                    </p>
                    <AgeSelect
                      label="現在年齡"
                      value={params.currentAge}
                      onChange={(v) => setParam("currentAge", v)}
                      min={18}
                      max={80}
                    />
                    <AgeSelect
                      label="預計退休年齡"
                      value={params.retirementAge}
                      onChange={(v) => setParam("retirementAge", v)}
                      min={40}
                      max={85}
                    />
                    <NumberInput
                      label="退休後每月生活費"
                      value={params.monthlyExpense}
                      onChange={(v) => setParam("monthlyExpense", v)}
                      min={0}
                      step={1000}
                      prefix="NT$"
                    />
                    <NumberInput
                      label="政府退休金（月）"
                      value={params.govPension}
                      onChange={(v) => setParam("govPension", v)}
                      min={0}
                      step={1000}
                      prefix="NT$"
                    />

                    <p className="mt-4 mb-1 text-[11px] font-semibold tracking-wide text-[#8e8e93] uppercase">
                      通膨與報酬假設
                    </p>
                    <NumberInput
                      label="長期通膨率"
                      value={params.inflationRate}
                      onChange={(v) => setParam("inflationRate", v)}
                      min={0}
                      max={10}
                      step={0.1}
                      suffix="%"
                    />
                    <NumberInput
                      label="積累期年化報酬"
                      value={params.accRate}
                      onChange={(v) => setParam("accRate", v)}
                      min={0}
                      max={20}
                      step={0.1}
                      suffix="%"
                    />
                    <NumberInput
                      label="提領期年化報酬"
                      value={params.wdRate}
                      onChange={(v) => setParam("wdRate", v)}
                      min={0}
                      max={15}
                      step={0.1}
                      suffix="%"
                    />
                    <NumberInput
                      label="安全提領率（SWR）"
                      value={params.swr}
                      onChange={(v) => setParam("swr", v)}
                      min={1}
                      max={10}
                      step={0.1}
                      suffix="%"
                    />

                    <p className="mt-4 mb-1 text-[11px] font-semibold tracking-wide text-[#8e8e93] uppercase">
                      持續投入
                    </p>
                    <NumberInput
                      label="每月定期投入"
                      value={params.monthlyContrib}
                      onChange={(v) => setParam("monthlyContrib", v)}
                      min={0}
                      step={1000}
                      prefix="NT$"
                    />
                  </div>
                )}
              </div>

              {/* 2. 資產整合 */}
              <SectionCard title="資產整合與淨值計算">
                <Row label="生息資產（投資）" value={`NT$ ${fmtWan(totalInvestment)}`} />
                <Row label="流動資金" value={`NT$ ${fmtWan(liquidAssets)}`} />
                <Row label="總資產" value={`NT$ ${fmtWan(totalAssets)}`} />
                <Row
                  label="負債（房貸等）"
                  value={`NT$ ${fmtWan(totalLiabilities)}`}
                  color="#ff3b30"
                />
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
                <div className="mt-2 border-t border-[#f2f2f7] pt-2 text-[11px] text-[#8e8e93]">
                  通膨調整後退休月支出：NT$ {fmtWan(Math.round(calcs.fme))} ／月 （今日購買力 NT${" "}
                  {fmtWan(params.monthlyExpense)}）
                </div>
              </SectionCard>

              {/* 3. 動態追蹤指標 */}
              <SectionCard title="動態追蹤指標">
                {/* FI date */}
                <div className="flex items-center justify-between border-b border-[#f2f2f7] py-2">
                  <div>
                    <p className="text-[13px] text-[#8e8e93]">財務自由日預測</p>
                    <p className="mt-0.5 text-[14px] font-medium text-[#1c1c1e]">
                      {calcs.fiYear ? `${calcs.fiYear} 年（${calcs.fiAge}歲）` : "超過 100 歲"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-medium" style={{ color: fiColor }}>
                      {calcs.fiAge !== null && calcs.fiAge <= params.retirementAge
                        ? "退休前可達標"
                        : "退休前未達標"}
                    </p>
                    <p className="text-[11px] text-[#8e8e93]">
                      {calcs.fiAge !== null ? `距今 ${calcs.fiAge - params.currentAge} 年` : "—"}
                    </p>
                  </div>
                </div>

                {/* Passive income coverage */}
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] text-[#8e8e93]">被動收入覆蓋率</p>
                      <p className="mt-0.5 text-[14px] font-medium text-[#1c1c1e]">
                        月收 NT$ {fmtWan(Math.round(calcs.monthlyPassive))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[17px] font-bold" style={{ color: coverageTextOnWhite }}>
                        {calcs.passiveCoverage.toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-[#8e8e93]">4% 股息假設</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f2f2f7]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${calcs.passiveCoverage}%`,
                        background: coverageBarOnWhite,
                      }}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* 4. 資產成長趨勢圖 */}
              <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <p className="mb-1 text-[15px] font-semibold text-[#1c1c1e]">資產成長趨勢圖</p>
                <p className="mb-3 text-[12px] text-[#8e8e93]">三種報酬情境下的資產路徑</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={projData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rGradBase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#374254" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#374254" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rGradOpt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0e1424" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#0e1424" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rGradCons" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff9500" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#ff9500" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#f2f2f7" />
                    <XAxis
                      dataKey="age"
                      ticks={xTicks}
                      tick={{ fontSize: 11, fill: "#8e8e93" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, yMax]}
                      ticks={yTicks}
                      tickFormatter={fmtY}
                      tick={{ fontSize: 11, fill: "#8e8e93" }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const age = label as number;
                        const year = currentYear + (age - params.currentAge);
                        return (
                          <div className="rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[12px] shadow-md">
                            <p className="mb-1 font-semibold text-[#1c1c1e]">
                              {age}歲 ({year})
                            </p>
                            {payload.map((p) => (
                              <p key={p.name} style={{ color: p.color as string }}>
                                {p.name}：NT$ {fmtWan(p.value as number)}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {calcs.tt > 0 && (
                      <ReferenceLine
                        y={calcs.tt}
                        stroke="#0e1424"
                        strokeDasharray="4 3"
                        label={{
                          value: "目標",
                          position: "insideTopRight",
                          fill: "#0e1424",
                          fontSize: 10,
                        }}
                      />
                    )}
                    <ReferenceLine
                      x={params.retirementAge}
                      stroke="#ff9500"
                      strokeDasharray="4 3"
                      label={{
                        value: "退休",
                        position: "top",
                        fill: "#ff9500",
                        fontSize: 10,
                      }}
                    />
                    <Area
                      type="linear"
                      dataKey="cons"
                      isAnimationActive={false}
                      stroke="#ff9500"
                      strokeWidth={1}
                      fill="url(#rGradCons)"
                      dot={false}
                      name="保守"
                    />
                    <Area
                      type="linear"
                      dataKey="opt"
                      isAnimationActive={false}
                      stroke="#0e1424"
                      strokeWidth={1}
                      fill="url(#rGradOpt)"
                      dot={false}
                      name="樂觀"
                    />
                    <Area
                      type="linear"
                      dataKey="base"
                      isAnimationActive={false}
                      stroke="#374254"
                      strokeWidth={2}
                      fill="url(#rGradBase)"
                      dot={false}
                      name="基準"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-center gap-4">
                  {(
                    [
                      { color: "#0e1424", label: `樂觀 (+2%)` },
                      { color: "#374254", label: "基準" },
                      { color: "#ff9500", label: `保守 (-2%)` },
                    ] as const
                  ).map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className="h-0.5 w-4 rounded" style={{ background: color }} />
                      <span className="text-[11px] text-[#8e8e93]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. 敏感度分析 */}
              <SectionCard title="敏感度分析">
                <p className="mb-4 text-[12px] text-[#8e8e93]">
                  調整假設情境，即時觀察對財務自由年份的影響（不影響主要參數）
                </p>

                <div className="mb-4">
                  <div className="mb-1 flex justify-between">
                    <label className="text-[13px] text-[#8e8e93]">年化報酬率</label>
                    <span className="text-[13px] font-semibold text-[#1c1c1e]">
                      {sensRate.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={sensRate}
                    onChange={(e) => setSensRate(parseFloat(e.target.value))}
                    className="w-full accent-[#374254]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8e8e93]">
                    <span>1%</span>
                    <span>15%</span>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-1 flex justify-between">
                    <label className="text-[13px] text-[#8e8e93]">退休年齡</label>
                    <span className="text-[13px] font-semibold text-[#1c1c1e]">{sensAge} 歲</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={75}
                    step={1}
                    value={sensAge}
                    onChange={(e) => setSensAge(parseInt(e.target.value))}
                    className="w-full accent-[#374254]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8e8e93]">
                    <span>40歲</span>
                    <span>75歲</span>
                  </div>
                </div>

                <div className="mt-1 rounded-xl bg-[#f2f2f7] px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-[#8e8e93]">假設情境財務自由</p>
                      <p className="text-[15px] font-semibold text-[#1c1c1e]">
                        {sensCalc.fiYear
                          ? `${sensCalc.fiYear} 年（${sensCalc.fiAge}歲）`
                          : "100歲以上"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                        目標：NT$ {fmtWan(Math.round(sensCalc.target))}
                      </p>
                    </div>
                    {sensCalc.delta !== null && (
                      <div className="text-right">
                        <p className="text-[11px] text-[#8e8e93]">vs 基準</p>
                        <p
                          className="text-[17px] font-bold"
                          style={{
                            color:
                              sensCalc.delta === 0
                                ? "#8e8e93"
                                : sensCalc.delta < 0
                                  ? "#0e1424"
                                  : "#ff3b30",
                          }}
                        >
                          {sensCalc.delta === 0
                            ? "相同"
                            : `${sensCalc.delta > 0 ? "+" : ""}${sensCalc.delta}年`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* 6. 壓力測試 */}
              <SectionCard title="壓力測試">
                <p className="mb-3 text-[12px] text-[#8e8e93]">
                  模擬退休時發生意外事件，評估退休金可支撐年限
                </p>

                <div className="space-y-3">
                  <div className="rounded-xl border border-[#ff3b30]/20 bg-[#ff3b30]/5 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-[#ff3b30]" />
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#1c1c1e]">市場崩盤 −20%</p>
                        <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                          退休當年資產縮水 20%，之後正常提領
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p
                          className="text-[15px] font-bold"
                          style={{
                            color:
                              stress.crash20 >= 30
                                ? "#0e1424"
                                : stress.crash20 >= 20
                                  ? "#ff9500"
                                  : "#ff3b30",
                          }}
                        >
                          {stress.crash20 >= 60 ? "60年+" : `${stress.crash20}年`}
                        </p>
                        <p className="text-[11px] text-[#8e8e93]">可支撐</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#ff9500]/20 bg-[#ff9500]/5 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Activity size={14} className="mt-0.5 flex-shrink-0 text-[#ff9500]" />
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#1c1c1e]">
                          通膨劇增，生活費 ×1.5
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                          退休後每年提領額提高 50%
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p
                          className="text-[15px] font-bold"
                          style={{
                            color:
                              stress.highInfl >= 30
                                ? "#0e1424"
                                : stress.highInfl >= 20
                                  ? "#ff9500"
                                  : "#ff3b30",
                          }}
                        >
                          {stress.highInfl >= 60 ? "60年+" : `${stress.highInfl}年`}
                        </p>
                        <p className="text-[11px] text-[#8e8e93]">可支撐</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* 7. 退休金流排程表 (collapsible) */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button
                  onClick={() => setShowSchedule((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-4"
                >
                  <div className="text-left">
                    <p className="text-[15px] font-semibold text-[#1c1c1e]">退休金流排程表</p>
                    <p className="mt-0.5 text-[12px] text-[#8e8e93]">退休後每年提領與剩餘明細</p>
                  </div>
                  {showSchedule ? (
                    <ChevronUp size={16} className="flex-shrink-0 text-[#8e8e93]" />
                  ) : (
                    <ChevronDown size={16} className="flex-shrink-0 text-[#8e8e93]" />
                  )}
                </button>
                {showSchedule && (
                  <div className="overflow-x-auto px-4 pb-4">
                    {schedule.length === 0 ? (
                      <p className="py-4 text-center text-[13px] text-[#8e8e93]">
                        請先完成參數設定
                      </p>
                    ) : (
                      <table className="w-full min-w-[280px] text-[12px]">
                        <thead>
                          <tr className="border-b border-[#f2f2f7] text-[#8e8e93]">
                            <th className="py-2 pr-2 text-left font-medium">年齡</th>
                            <th className="py-2 pr-2 text-right font-medium">年份</th>
                            <th className="py-2 pr-2 text-right font-medium">投報</th>
                            <th className="py-2 pr-2 text-right font-medium">提領</th>
                            <th className="py-2 text-right font-medium">餘額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((row) => (
                            <tr key={row.age} className="border-b border-[#f2f2f7] last:border-0">
                              <td className="py-1.5 pr-2 text-[#1c1c1e]">{row.age}歲</td>
                              <td className="py-1.5 pr-2 text-right text-[#8e8e93]">{row.year}</td>
                              <td className="py-1.5 pr-2 text-right text-[#0e1424]">
                                +{fmtWan(row.returns)}
                              </td>
                              <td className="py-1.5 pr-2 text-right text-[#ff3b30]">
                                -{fmtWan(row.withdrawal)}
                              </td>
                              <td
                                className="py-1.5 text-right font-medium"
                                style={{
                                  color: row.balance > 0 ? "#1c1c1e" : "#ff3b30",
                                }}
                              >
                                {fmtWan(row.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {openModal && modalContents[openModal] && (
          <InfoModal content={modalContents[openModal]} onClose={() => setOpenModal(null)} />
        )}
      </div>
    </>
  );
}
