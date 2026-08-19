"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

// Structurally compatible with both `InvestmentPoint` (local aggregation) and
// `NetWorthPoint` (server-backed range fetch, which also carries `date` and
// `totalLiabilities`) — either can be passed in as-is.
export interface ChartPoint {
  period: string;
  totalAssets: number;
  netWorth: number;
}

function formatY(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return `${value}`;
}

export function InvestmentChart({
  data,
  height = 220,
}: {
  data: ChartPoint[];
  height?: number | `${number}%`;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-[14px] font-semibold text-[#8e8e93]">尚無足夠的歷史資料</p>
        <p className="text-[11px] text-[#c7c7cc]">新增或更新資產後，這裡會畫出淨資產的變化</p>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRight: "2px solid #1c1c1e",
        borderBottom: "2px solid #1c1c1e",
        height: "100%",
        minHeight: 0,
      }}
    >
      <ResponsiveContainer width="100%" height={height} minHeight={0}>
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap="35%"
          margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
        >
          <CartesianGrid vertical={false} stroke="#e5e5ea" />
          <XAxis
            dataKey="period"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8e8e93" }}
          />
          <YAxis
            tickFormatter={formatY}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8e8e93" }}
            width={36}
          />
          {/* <Legend
            iconType="square"
            iconSize={12}
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            verticalAlign="top"
            align="left"
          /> */}
          <Bar dataKey="totalAssets" name="資產總值" fill="#374254" radius={[2, 2, 0, 0]} />
          <Bar dataKey="netWorth" name="帳面損益" fill="#66788E" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
