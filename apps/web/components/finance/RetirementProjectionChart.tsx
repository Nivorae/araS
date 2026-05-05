"use client";

import { useMemo, useState } from "react";
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
  getLiveValue,
  projectFutureGrowth,
  type Insurance,
  type ProjectionRow,
} from "@repo/shared";

interface Props {
  insurance: Insurance;
  exchangeRate: number; // TWD per 1 USD
}

interface ChartRow extends ProjectionRow {
  displayValue: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  showTWD: boolean;
}

function CustomTooltip({ active, payload, showTWD }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  const formatted = showTWD
    ? `${(row.displayValue / 10000).toFixed(1)}萬 TWD`
    : `$${row.displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD`;

  return (
    <div className="rounded-xl bg-white px-3 py-2 text-[12px] shadow-md">
      <p className="font-semibold text-[#1c1c1e]">
        {row.age}歲 ({row.year})
      </p>
      <p className="text-[#0e1424]">{formatted}</p>
    </div>
  );
}

export default function RetirementProjectionChart({ insurance, exchangeRate }: Props) {
  const [declaredRate, setDeclaredRate] = useState(insurance.declaredRate);
  const [showTWD, setShowTWD] = useState(false);

  const chartData = useMemo<ChartRow[]>(() => {
    const currentValue = getLiveValue(insurance.cashValueData, insurance.startDate, new Date());
    const projectionData = projectFutureGrowth(currentValue, declaredRate, insurance.currentAge);
    return projectionData.map((row) => ({
      ...row,
      displayValue: showTWD ? row.projectedValue * exchangeRate : row.projectedValue,
    }));
  }, [
    insurance.cashValueData,
    insurance.startDate,
    insurance.currentAge,
    declaredRate,
    showTWD,
    exchangeRate,
  ]);

  const age65Row = chartData.find((row) => row.age === 65);

  const yAxisFormatter = (v: number) =>
    showTWD ? `${(v / 10000).toFixed(0)}萬` : `$${(v / 1000).toFixed(0)}k`;

  // Only tick every 5 years on the X axis
  const xTicks = chartData.filter((row) => row.age % 5 === 0).map((row) => row.age);

  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
      <p className="mb-3 text-[15px] font-semibold text-[#1c1c1e]">退休預測</p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="retirementGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0e1424" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#0e1424" stopOpacity={0} />
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
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: "#8e8e93" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip showTWD={showTWD} />} />
          <ReferenceLine
            x={65}
            stroke="#ff9500"
            strokeDasharray="4 4"
            label={{
              value: "65歲",
              position: "top",
              fill: "#ff9500",
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="displayValue"
            stroke="#0e1424"
            strokeWidth={2}
            fill="url(#retirementGreen)"
            dot={false}
            activeDot={{ r: 4, fill: "#0e1424" }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Controls */}
      <div className="mt-3">
        {/* Rate slider */}
        <div>
          <label className="text-[12px] text-[#8e8e93]">宣告利率 {declaredRate.toFixed(2)}%</label>
          <input
            type="range"
            min={1}
            max={6}
            step={0.25}
            value={declaredRate}
            onChange={(e) => setDeclaredRate(parseFloat(e.target.value))}
            className="w-full accent-[#0e1424]"
          />
          <div className="flex justify-between text-[10px] text-[#8e8e93]">
            <span>1%</span>
            <span>6%</span>
          </div>
        </div>

        {/* Currency toggle */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setShowTWD(false)}
            className={`rounded-full px-3 py-1 text-[12px] ${
              !showTWD ? "bg-[#0e1424] text-white" : "bg-[#f2f2f7] text-[#8e8e93]"
            }`}
          >
            USD
          </button>
          <button
            onClick={() => setShowTWD(true)}
            className={`rounded-full px-3 py-1 text-[12px] ${
              showTWD ? "bg-[#0e1424] text-white" : "bg-[#f2f2f7] text-[#8e8e93]"
            }`}
          >
            TWD
          </button>
        </div>

        {/* Age 65 annotation */}
        {age65Row && (
          <div className="mt-3 rounded-xl bg-[#f2f2f7] px-3 py-2">
            <p className="text-[12px] text-[#8e8e93]">
              退休預估 (65歲):{" "}
              <span className="font-semibold text-[#1c1c1e]">
                $
                {age65Row.projectedValue.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}{" "}
                USD
              </span>{" "}
              /{" "}
              <span className="text-[#1c1c1e]">
                ≈ TWD{" "}
                {(age65Row.projectedValue * exchangeRate).toLocaleString("zh-TW", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
