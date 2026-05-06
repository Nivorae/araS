"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import type { LiquidityPoint } from "../../lib/chartAggregation";

function formatY(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return `${value}`;
}

export function PnlChart({
  data,
  height = 220,
}: {
  data: LiquidityPoint[];
  height?: number | `${number}%`;
}) {
  return (
    <div
      style={{
        borderRight: "2px solid #1c1c1e",
        borderBottom: "2px solid #1c1c1e",
        height: "100%",
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap="35%"
          margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
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
          <Legend
            iconType="square"
            iconSize={12}
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            verticalAlign="top"
            align="left"
          />
          <Bar dataKey="income" name="收入" fill="#0e1424" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expense" name="支出" fill="#c7c7cc" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
