"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
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
} from "lucide-react";
import { useFinanceStore } from "../../store/useFinanceStore";
import { z } from "zod";

const StoredParamsSchema = z
  .object({
    currentAge: z.number().int().positive(),
    retirementAge: z.number().int().positive(),
    monthlyExpense: z.number().nonnegative(),
    inflationRate: z.number().min(0).max(100),
    accRate: z.number().min(0).max(100),
    wdRate: z.number().min(0).max(100),
    swr: z.number().min(0).max(100),
    monthlyContrib: z.number().nonnegative(),
    govPension: z.number().nonnegative(),
  })
  .partial();

const STORAGE_KEY = "retirement_params_v1";

interface Params {
  currentAge: number;
  retirementAge: number;
  monthlyExpense: number;
  inflationRate: number;
  accRate: number;
  wdRate: number;
  swr: number;
  monthlyContrib: number;
  govPension: number;
}

interface ModalContent {
  title: string;
  description: string;
  steps: { label: string; value?: string }[];
  result: { label: string; value: string };
}

const DEFAULTS: Params = {
  currentAge: 30,
  retirementAge: 65,
  monthlyExpense: 50000,
  inflationRate: 2.5,
  accRate: 7.0,
  wdRate: 5.0,
  swr: 4.0,
  monthlyContrib: 10000,
  govPension: 15000,
};

function fmtWan(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}億`;
  if (abs >= 1e4) {
    const wan = abs / 1e4;
    return `${sign}${wan.toLocaleString("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}萬`;
  }
  return `${sign}${Math.round(abs).toLocaleString("zh-TW")}`;
}

function fmtY(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(0)}億`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString("zh-TW")}萬`;
  return v.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

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
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-5 ${onClick ? "cursor-pointer active:opacity-75" : ""}`}
      style={{ background: bg }}
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
      <div className="flex items-baseline gap-1">
        <p className="text-[26px] leading-none font-bold" style={{ color }}>
          {value}
        </p>
        {unit && (
          <span className="text-[13px] font-semibold" style={{ color }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <p className="mt-2 text-[11px]" style={{ color: labelColor }}>
          {sub}
        </p>
      )}
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

const ANIMATION_DURATION = 330;

function InfoModal({ content, onClose }: { content: ModalContent; onClose: () => void }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, ANIMATION_DURATION);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsClosing(true);
        setTimeout(onClose, ANIMATION_DURATION);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const easing = "cubic-bezier(0.32,0.72,0,1)";
  const dur = `${ANIMATION_DURATION}ms`;

  return (
    <div data-testid="modal-backdrop" className="fixed inset-0 z-50" onClick={handleClose}>
      {/* Scrim — fades in/out */}
      <div
        className="absolute inset-0 bg-black/30"
        style={{
          animation: isClosing
            ? `modal-scrim-out ${dur} ${easing} forwards`
            : `modal-scrim-in ${dur} ${easing}`,
        }}
      />

      {/* Full-height bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        className="absolute right-0 bottom-0 left-0 flex flex-col overflow-hidden rounded-t-3xl"
        style={{
          top: "54px",
          overscrollBehavior: "contain",
          animation: isClosing
            ? `modal-slide-down ${dur} ${easing} forwards`
            : `modal-slide-up ${dur} ${easing}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pointer-events-none absolute top-3 right-0 left-0 z-10 flex justify-center">
          <div className="h-1 w-8 rounded-full bg-white/20" />
        </div>

        {/* Block 1 — Hero: darkest, tallest */}
        <div className="flex-shrink-0 bg-[#0e1424] px-6 pt-10 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
              計算說明
            </span>
            <button
              aria-label="關閉"
              onClick={handleClose}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-[17px] leading-none text-white/60"
            >
              ×
            </button>
          </div>
          <h2 className="text-[28px] font-bold text-white">{content.result.label}</h2>
          <p className="mt-5 text-[40px] leading-none font-bold text-[#ff9500]">
            {content.result.value}
          </p>
          <p className="mt-6 text-[13px] leading-relaxed text-white/70">{content.description}</p>
        </div>

        {/* Block 3 — Formula: light gray, fills remaining space */}
        <div className="flex-1 overflow-auto bg-[#f2f2f7] px-5 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="mb-3 text-[16px] font-bold tracking-widest text-[#8e8e93] uppercase">
            計算公式
          </p>
          <div className="space-y-2">
            {content.steps.map((step) => (
              <div
                key={step.label}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5"
              >
                <span className="text-[13px] text-[#8e8e93]">{step.label}</span>
                {step.value && (
                  <span className="ml-3 text-right text-[13px] font-semibold text-[#1c1c1e]">
                    {step.value}
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleClose}
            className="mt-6 w-full rounded-2xl bg-[#1c1c1e] py-3 text-[15px] font-semibold text-white"
          >
            了解了
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Main Component ────────────────────────────────────────────────────────────

export function RetirementPage() {
  const { entries, fetchAll } = useFinanceStore();
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [sensRate, setSensRate] = useState(DEFAULTS.accRate);
  const [sensAge, setSensAge] = useState(DEFAULTS.retirementAge);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const result = StoredParamsSchema.safeParse(JSON.parse(saved));
        if (result.success) {
          const parsed: Params = { ...DEFAULTS, ...(result.data as Partial<Params>) };
          setParams(parsed);
          setSensRate(parsed.accRate);
          setSensAge(parsed.retirementAge);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setInitialized(true);
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    }
  }, [params, initialized]);

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
      const ta = assetEntries.reduce((s, e) => s + e.value, 0);
      const tl = liabEntries.reduce((s, e) => s + e.value, 0);
      return {
        totalAssets: ta,
        totalLiabilities: tl,
        totalInvestment: investEntries.reduce((s, e) => s + e.value, 0),
        liquidAssets: liquidEntries.reduce((s, e) => s + e.value, 0),
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
        base: Math.max(0, Math.round(base)),
        opt: Math.max(0, Math.round(opt)),
        cons: Math.max(0, Math.round(cons)),
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
    calcs.fiAge !== null && calcs.fiAge <= params.retirementAge ? "#ff9500" : "#ff3C7C7D4b30";
  const coverageColor =
    calcs.passiveCoverage >= 100 ? "#ff9500" : calcs.passiveCoverage >= 50 ? "#000000" : "#ffffff";

  return (
    <>
      <div className="space-y-4 px-4 pb-8">
        {/* Header */}
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height: "calc((100dvh - 64px) * 0.5)" }}
        >
          <div className="mb-1 text-center">
            <h1 className="text-[22px] font-bold text-[#1c1c1e]">退休計劃</h1>
            <p className="mt-0.5 text-[13px] text-[#8e8e93]">財務自由追蹤與模擬</p>
          </div>

          {/* Water-fill Piggy Bank */}
          <button
            data-testid="goal-progress-section"
            onClick={() => setOpenModal("goal")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenModal("goal");
              }
            }}
            aria-label="目標達成率"
            className="relative cursor-pointer focus:outline-none active:opacity-70"
            style={{ width: 80, height: 80 }}
          >
            {/* Ghost outline — always full */}
            <PiggyBank size={80} strokeWidth={1.5} className="text-[#e5e5ea]" />
            {/* Water fill — clip sets the level, inner div bobs to mimic waves */}
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(${Math.max(0, 100 - calcs.goalPct)}% 0 0 0)`,
                transition: "clip-path 0.7s ease-in-out",
              }}
            >
              <div style={{ animation: "piggy-water-bob 1.5s ease-in-out infinite alternate" }}>
                <PiggyBank size={80} strokeWidth={2} style={{ color: goalColor }} />
              </div>
            </div>
          </button>

          <div className="text-center">
            <p className="text-[20px] font-bold" style={{ color: goalColor }}>
              {calcs.goalPct.toFixed(1)}%
            </p>
            <p className="text-[12px] text-[#8e8e93]">目標達成率</p>
          </div>
        </div>

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
              <NumberInput
                label="現在年齡"
                value={params.currentAge}
                onChange={(v) => setParam("currentAge", Math.round(v))}
                min={18}
                max={80}
                suffix="歲"
              />
              <NumberInput
                label="預計退休年齡"
                value={params.retirementAge}
                onChange={(v) => setParam("retirementAge", Math.round(v))}
                min={40}
                max={80}
                suffix="歲"
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
                <p className="text-[17px] font-bold" style={{ color: coverageColor }}>
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
                  background: coverageColor,
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
              <XAxis
                dataKey="age"
                ticks={xTicks}
                tick={{ fontSize: 11, fill: "#8e8e93" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
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
                type="monotone"
                dataKey="cons"
                stroke="#ff9500"
                strokeWidth={1}
                fill="url(#rGradCons)"
                dot={false}
                name="保守"
              />
              <Area
                type="monotone"
                dataKey="opt"
                stroke="#0e1424"
                strokeWidth={1}
                fill="url(#rGradOpt)"
                dot={false}
                name="樂觀"
              />
              <Area
                type="monotone"
                dataKey="base"
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
                  {sensCalc.fiYear ? `${sensCalc.fiYear} 年（${sensCalc.fiAge}歲）` : "100歲以上"}
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
                  <p className="text-[13px] font-medium text-[#1c1c1e]">通膨劇增，生活費 ×1.5</p>
                  <p className="mt-0.5 text-[11px] text-[#8e8e93]">退休後每年提領額提高 50%</p>
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
                <p className="py-4 text-center text-[13px] text-[#8e8e93]">請先完成參數設定</p>
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

        {openModal && modalContents[openModal] && (
          <InfoModal content={modalContents[openModal]} onClose={() => setOpenModal(null)} />
        )}
      </div>
    </>
  );
}
