import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Rect } from "react-native-svg";
import type { InvestmentPoint } from "@/lib/chartAggregation";

function formatY(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return `${value}`;
}

function formatFull(v: number): string {
  return (
    "NT$" +
    Math.round(v)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

const COLOR_ASSETS = "#374254";
const COLOR_NET = "#66788E";
const Y_AXIS_W = 36;
const X_AXIS_H = 20;
const TOP_PAD = 10;
const TOOLTIP_W = 148;

function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  let step: number;
  if (n <= 1) step = 1;
  else if (n <= 2) step = 2;
  else if (n <= 2.5) step = 2.5;
  else if (n <= 5) step = 5;
  else step = 10;
  return step * pow;
}

export function InvestmentChart({ data }: { data: InvestmentPoint[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const plotW = Math.max(0, size.w - Y_AXIS_W);
  const plotH = Math.max(0, size.h - X_AXIS_H - TOP_PAD);

  const rawMax = data.reduce((m, d) => Math.max(m, d.totalAssets, d.netWorth), 0);
  const yMax = niceCeil(rawMax);
  const TICKS = 5;
  const tickValues = Array.from({ length: TICKS }, (_, i) => (yMax / (TICKS - 1)) * i);

  const groupW = data.length > 0 ? plotW / data.length : 0;
  const bandW = groupW * 0.65;
  const barGap = 2;
  const barW = Math.max(2, (bandW - barGap) / 2);

  const yFor = (v: number) => TOP_PAD + plotH * (1 - v / yMax);

  // Clamp tooltip so it stays within the chart horizontally
  const tooltipLeft =
    tooltip !== null
      ? Math.min(
          Math.max(Y_AXIS_W, Y_AXIS_W + groupW * tooltip + groupW / 2 - TOOLTIP_W / 2),
          size.w - TOOLTIP_W - 2
        )
      : 0;

  return (
    <View style={s.wrap} onLayout={onLayout}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          {/* Dismiss tooltip when tapping outside a bar group */}
          <Rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            fill="transparent"
            onPress={() => setTooltip(null)}
          />

          {/* Horizontal grid lines */}
          {tickValues.map((v, i) => (
            <Line
              key={`grid-${i}`}
              x1={Y_AXIS_W}
              y1={yFor(v)}
              x2={size.w}
              y2={yFor(v)}
              stroke="#e5e5ea"
              strokeWidth={1}
            />
          ))}

          {/* Bar groups — each wrapped in G for touch */}
          {data.map((d, i) => {
            const groupX = Y_AXIS_W + groupW * i + (groupW - bandW) / 2;
            const aH = plotH * (d.totalAssets / yMax);
            const nH = plotH * (d.netWorth / yMax);
            const isSelected = tooltip === i;
            const dimmed = tooltip !== null && !isSelected;
            return (
              <G key={`bars-${i}`} onPress={() => setTooltip(isSelected ? null : i)}>
                {/* Full-height invisible hit area for easy tapping */}
                <Rect
                  x={Y_AXIS_W + groupW * i}
                  y={TOP_PAD}
                  width={groupW}
                  height={plotH}
                  fill="transparent"
                />
                <Rect
                  x={groupX}
                  y={TOP_PAD + plotH - aH}
                  width={barW}
                  height={Math.max(0, aH)}
                  rx={2}
                  fill={COLOR_ASSETS}
                  opacity={dimmed ? 0.35 : 1}
                />
                <Rect
                  x={groupX + barW + barGap}
                  y={TOP_PAD + plotH - nH}
                  width={barW}
                  height={Math.max(0, nH)}
                  rx={2}
                  fill={COLOR_NET}
                  opacity={dimmed ? 0.35 : 1}
                />
              </G>
            );
          })}
        </Svg>
      )}

      {/* Y axis tick labels — numberOfLines={1} prevents wrapping */}
      {size.w > 0 &&
        tickValues.map((v, i) => (
          <Text
            key={`ylabel-${i}`}
            numberOfLines={1}
            style={[s.yLabel, { top: yFor(v) - 7, width: Y_AXIS_W - 4 }]}
          >
            {formatY(v)}
          </Text>
        ))}

      {/* X axis labels */}
      {size.w > 0 && (
        <View style={[s.xRow, { left: Y_AXIS_W, height: X_AXIS_H }]}>
          {data.map((d, i) => (
            <Text key={`xlabel-${i}`} style={s.xLabel}>
              {d.period}
            </Text>
          ))}
        </View>
      )}

      {/* Tooltip card */}
      {tooltip !== null && data[tooltip] !== undefined && (
        <View style={[s.tooltip, { left: tooltipLeft, top: TOP_PAD + 6 }]} pointerEvents="none">
          <Text style={s.tooltipPeriod}>{data[tooltip]!.period}</Text>
          <View style={s.tooltipRow}>
            <View style={[s.tooltipDot, { backgroundColor: COLOR_ASSETS }]} />
            <Text style={s.tooltipText}>
              {"總資產  "}
              {formatFull(data[tooltip]!.totalAssets)}
            </Text>
          </View>
          <View style={s.tooltipRow}>
            <View style={[s.tooltipDot, { backgroundColor: COLOR_NET }]} />
            <Text style={s.tooltipText}>
              {"淨資產  "}
              {formatFull(data[tooltip]!.netWorth)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#1c1c1e",
  },
  yLabel: {
    position: "absolute",
    left: 0,
    textAlign: "right",
    fontSize: 11,
    color: "#8e8e93",
  },
  xRow: {
    position: "absolute",
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  xLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#8e8e93",
  },

  // Tooltip
  tooltip: {
    position: "absolute",
    width: TOOLTIP_W,
    backgroundColor: "rgba(28,28,30,0.92)",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  tooltipPeriod: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipText: {
    fontSize: 11,
    color: "#e5e5ea",
    fontWeight: "500",
  },
});
